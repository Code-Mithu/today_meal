import { queryAll, queryFirst, execute, runInTransaction } from '@/database/db';
import { MealGroup } from '@/types';

export const GroupRepository = {
  async upsert(group: Partial<MealGroup> & { id: string }): Promise<void> {
    const now = new Date().toISOString();
    await execute(
      `INSERT OR REPLACE INTO groups
        (id, name, description, month, currency, start_date, logo_url,
         manager_name, manager_member_id, sub_manager_name, sub_manager_member_id,
         treasurer_name, treasurer_member_id, assistant_manager_name,
         join_code, join_code_enabled, member_ids, active,
         created_date, updated_date, created_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        group.id,
        group.name || '',
        group.description || '',
        group.month || null,
        group.currency || 'BDT',
        group.start_date || null,
        group.logo_url || null,
        group.manager_name || null,
        group.manager_member_id || null,
        group.sub_manager_name || null,
        group.sub_manager_member_id || null,
        group.treasurer_name || null,
        group.treasurer_member_id || null,
        group.assistant_manager_name || null,
        group.join_code || null,
        group.join_code_enabled ? 1 : 0,
        JSON.stringify(group.member_ids || []),
        group.active ? 1 : 0,
        group.created_date || now,
        group.updated_date || now,
        group.created_by_id || null,
      ]
    );
  },

  async getById(id: string): Promise<MealGroup | null> {
    const row = await queryFirst<any>('SELECT * FROM groups WHERE id = ?', [id]);
    return row ? this.deserialize(row) : null;
  },

  async getAll(): Promise<MealGroup[]> {
    const rows = await queryAll<any>('SELECT * FROM groups WHERE active = 1 ORDER BY name ASC');
    return rows.map((r) => this.deserialize(r));
  },

  async getByIds(ids: string[]): Promise<MealGroup[]> {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await queryAll<any>(
      `SELECT * FROM groups WHERE id IN (${placeholders}) AND active = 1 ORDER BY name ASC`,
      ids
    );
    return rows.map((r) => this.deserialize(r));
  },

  async delete(id: string): Promise<void> {
    await execute('DELETE FROM groups WHERE id = ?', [id]);
  },

  async updateMemberIds(id: string, memberIds: string[]): Promise<void> {
    await execute('UPDATE groups SET member_ids = ? WHERE id = ?', [
      JSON.stringify(memberIds),
      id,
    ]);
  },

  deserialize(row: any): MealGroup {
    return {
      ...row,
      join_code_enabled: !!row.join_code_enabled,
      active: !!row.active,
      member_ids: typeof row.member_ids === 'string' ? JSON.parse(row.member_ids) : row.member_ids || [],
    };
  },
};
