import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { auth } from './auth';
import { pool } from './db';
import { pullSchema, pushSchema } from './contracts';

const app = Fastify({ logger: true, bodyLimit: 2_000_000 });
await app.register(cors, { origin: true, credentials: true });

function requestHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return headers;
}

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

async function userId(request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: requestHeaders(request) });
  if (!session?.user?.id) throw httpError(401, 'Authentication required');
  return session.user.id;
}

async function requireMembership(householdId: string, currentUserId: string, write = false) {
  const result = await pool.query(
    'SELECT role FROM household_memberships WHERE household_id = $1 AND user_id = $2',
    [householdId, currentUserId],
  );
  const role = result.rows[0]?.role as string | undefined;
  if (!role) throw httpError(403, 'Household access denied');
  if (write && role === 'viewer') throw httpError(403, 'Viewer access is read-only');
  return role;
}

app.all('/api/auth/*', async (request, reply) => {
  const origin = `${request.protocol}://${request.hostname}`;
  const url = new URL(request.url, origin);
  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : JSON.stringify(request.body ?? {});
  const response = await auth.handler(new Request(url, {
    method: request.method,
    headers: requestHeaders(request),
    body,
  }));
  reply.status(response.status);
  response.headers.forEach((value, key) => reply.header(key, value));
  return reply.send(response.body ? await response.text() : undefined);
});

app.get('/health', async () => ({ ok: true }));

app.get('/api/households', async (request) => {
  const currentUserId = await userId(request);
  const result = await pool.query(
    `SELECT h.*, hm.role FROM households h
     JOIN household_memberships hm ON hm.household_id = h.id
     WHERE hm.user_id = $1 AND h.deleted_at IS NULL ORDER BY h.created_at`,
    [currentUserId],
  );
  return { households: result.rows };
});

app.post('/api/households', async (request) => {
  const currentUserId = await userId(request);
  const name = typeof (request.body as { name?: unknown })?.name === 'string'
    ? (request.body as { name: string }).name.trim()
    : '';
  if (!name || name.length > 80) throw httpError(400, 'A household name is required');
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO households (id, name, created_by) VALUES ($1, $2, $3)', [id, name, currentUserId]);
    await client.query("INSERT INTO household_memberships (household_id, user_id, role) VALUES ($1, $2, 'admin')", [id, currentUserId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { household: { id, name, role: 'admin' } };
});

app.post('/api/sync/push', async (request) => {
  const currentUserId = await userId(request);
  const input = pushSchema.parse(request.body);
  await requireMembership(input.householdId, currentUserId, true);
  const client = await pool.connect();
  const accepted: string[] = [];
  const conflicts: Array<{ operationId: string; server: unknown }> = [];
  try {
    await client.query('BEGIN');
    for (const operation of input.operations) {
      const duplicate = await client.query('SELECT operation_id FROM sync_changes WHERE operation_id = $1', [operation.operationId]);
      if (duplicate.rowCount) { accepted.push(operation.operationId); continue; }
      const existing = await client.query(
        'SELECT payload, version, deleted_at FROM sync_records WHERE household_id = $1 AND entity_type = $2 AND entity_id = $3 FOR UPDATE',
        [input.householdId, operation.entityType, operation.entityId],
      );
      const current = existing.rows[0];
      if (current && Number(current.version) !== operation.baseVersion) {
        conflicts.push({ operationId: operation.operationId, server: current });
        continue;
      }
      const version = (current?.version ?? 0) + 1;
      const deletedAt = operation.deleted ? new Date() : null;
      await client.query(
        `INSERT INTO sync_records (household_id, entity_type, entity_id, payload, version, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, now(), $6)
         ON CONFLICT (household_id, entity_type, entity_id) DO UPDATE
         SET payload = EXCLUDED.payload, version = EXCLUDED.version, updated_at = now(), deleted_at = EXCLUDED.deleted_at`,
        [input.householdId, operation.entityType, operation.entityId, JSON.stringify(operation.payload), version, deletedAt],
      );
      await client.query(
        'INSERT INTO sync_changes (household_id, entity_type, entity_id, operation_id, payload, version, deleted_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)',
        [input.householdId, operation.entityType, operation.entityId, operation.operationId, JSON.stringify(operation.payload), version, deletedAt],
      );
      accepted.push(operation.operationId);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { accepted, conflicts };
});

app.get('/api/sync/pull', async (request) => {
  const currentUserId = await userId(request);
  const input = pullSchema.parse(request.query);
  await requireMembership(input.householdId, currentUserId);
  const result = await pool.query(
    `SELECT sequence, entity_type, entity_id, payload, version, deleted_at, changed_at
     FROM sync_changes WHERE household_id = $1 AND sequence > $2 ORDER BY sequence ASC LIMIT $3`,
    [input.householdId, input.cursor, input.limit],
  );
  const cursor = result.rows.length ? Number(result.rows[result.rows.length - 1].sequence) : input.cursor;
  return { changes: result.rows, cursor, hasMore: result.rows.length === input.limit };
});

app.setErrorHandler((error, _request, reply) => {
  const apiError = error as Error & { statusCode?: number; issues?: unknown };
  if (apiError.issues) return reply.status(400).send({ error: 'Invalid request' });
  const status = apiError.statusCode ?? 500;
  return reply.status(status).send({ error: status >= 500 ? 'Internal server error' : apiError.message });
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
