import { execute, queryAll, queryFirst, runInTransaction } from '@/database/db';
import { apiFetch } from './api';

const TABLES = ['groups', 'members', 'expenses', 'contributions', 'daily_meals', 'daily_menus', 'categories', 'vendors', 'group_settings'] as const;
type TableName = typeof TABLES[number];
type OutboxRow = { operation_id: string; entity_type: TableName; entity_id: string; base_version: number; payload: string; deleted: number };
type Change = { sequence: string; entity_type: TableName; entity_id: string; payload: Record<string, unknown>; version: number; deleted_at: string | null };

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const fingerprint = (row: Record<string, unknown>) => JSON.stringify(row);

async function meta(key: string) {
  return (await queryFirst<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key]))?.value ?? null;
}
async function setMeta(key: string, value: string) {
  await execute('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', [key, value]);
}

async function ensureHousehold(name: string) {
  const saved = await meta('cloud_household_id');
  if (saved) return saved;
  const list = await apiFetch<{ households: Array<{ id: string }> }>('/api/households');
  const household = list.households[0] ?? (await apiFetch<{ household: { id: string } }>('/api/households', { method: 'POST', body: JSON.stringify({ name }) })).household;
  await setMeta('cloud_household_id', household.id);
  return household.id;
}

async function stageLocalChanges(householdId: string, localGroupId: string) {
  for (const table of TABLES) {
    const rows = table === 'groups'
      ? await queryAll<Record<string, unknown>>('SELECT * FROM groups WHERE id = ?', [localGroupId])
      : await queryAll<Record<string, unknown>>(`SELECT * FROM ${table} WHERE group_id = ?`, [localGroupId]);
    for (const row of rows) {
      const entityId = String(row.id);
      const print = fingerprint(row);
      const shadow = await queryFirst<{ version: number; fingerprint: string }>('SELECT version, fingerprint FROM sync_shadow WHERE entity_type = ? AND entity_id = ?', [table, entityId]);
      if (shadow?.fingerprint === print) continue;
      const pending = await queryFirst('SELECT operation_id FROM sync_outbox WHERE entity_type = ? AND entity_id = ?', [table, entityId]);
      if (!pending) await execute(
        'INSERT INTO sync_outbox (operation_id, household_id, entity_type, entity_id, base_version, payload, deleted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id(), householdId, table, entityId, shadow?.version ?? 0, JSON.stringify(row), row.deleted_at ? 1 : 0, new Date().toISOString()],
      );
    }
  }
}

async function applyChange(change: Change) {
  if (!TABLES.includes(change.entity_type)) return;
  const table = change.entity_type;
  if (change.deleted_at) {
    if (table === 'groups') await execute('UPDATE groups SET active = 0 WHERE id = ?', [change.entity_id]);
    else await execute(`DELETE FROM ${table} WHERE id = ?`, [change.entity_id]);
  } else {
    const entries = Object.entries(change.payload).filter(([key]) => /^[a-z_]+$/.test(key));
    if (!entries.length) return;
    const columns = entries.map(([key]) => key).join(', ');
    const placeholders = entries.map(() => '?').join(', ');
    await execute(`INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`, entries.map(([, value]) => value as never));
  }
  const row = await queryFirst<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = ?`, [change.entity_id]);
  await execute('INSERT OR REPLACE INTO sync_shadow (entity_type, entity_id, version, fingerprint) VALUES (?, ?, ?, ?)', [table, change.entity_id, change.version, fingerprint(row ?? change.payload)]);
}

export async function synchronize(localGroupId: string, householdName: string) {
  const householdId = await ensureHousehold(householdName);
  await stageLocalChanges(householdId, localGroupId);
  const pending = await queryAll<OutboxRow>('SELECT * FROM sync_outbox ORDER BY created_at LIMIT 250');
  let conflicts = 0;
  if (pending.length) {
    const result = await apiFetch<{ accepted: string[]; conflicts: unknown[] }>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ householdId, operations: pending.map((row) => ({ operationId: row.operation_id, entityType: row.entity_type, entityId: row.entity_id, baseVersion: row.base_version, deleted: Boolean(row.deleted), payload: JSON.parse(row.payload) })) }),
    });
    conflicts = result.conflicts.length;
    for (const operationId of result.accepted) await execute('DELETE FROM sync_outbox WHERE operation_id = ?', [operationId]);
  }
  let cursor = Number(await meta('sync_cursor') ?? 0);
  let hasMore = true;
  while (hasMore) {
    const result = await apiFetch<{ changes: Change[]; cursor: number; hasMore: boolean }>(`/api/sync/pull?householdId=${encodeURIComponent(householdId)}&cursor=${cursor}`);
    await runInTransaction(async () => { for (const change of result.changes) await applyChange(change); });
    cursor = result.cursor; hasMore = result.hasMore;
    await setMeta('sync_cursor', String(cursor));
  }
  await setMeta('last_sync_at', new Date().toISOString());
  return { conflicts, pending: (await queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox'))?.count ?? 0 };
}

export async function getSyncSnapshot() {
  const pending = (await queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox'))?.count ?? 0;
  return { pending, lastSyncAt: await meta('last_sync_at') };
}
