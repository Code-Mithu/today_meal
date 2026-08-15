import { queryAll, execute } from '@/database/db';
import { AuditLog } from '@/types';

export const AuditLogRepository = {
  async upsert(log: Partial<AuditLog> & { id: string }): Promise<void> {
    await execute(
      `INSERT OR REPLACE INTO audit_logs
        (id, group_id, expense_id, action, actor_id, actor_name, changed_fields,
         entity_type, previous_value, new_value, snapshot, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.group_id || null,
        log.expense_id || null,
        log.action,
        log.actor_id,
        log.actor_name || null,
        JSON.stringify(log.changed_fields || []),
        log.entity_type || null,
        log.previous_value || null,
        log.new_value || null,
        JSON.stringify(log.snapshot || {}),
        log.created_date || new Date().toISOString(),
      ]
    );
  },

  async getByGroupId(groupId: string, limit: number = 50): Promise<AuditLog[]> {
    const rows = await queryAll<any>(
      `SELECT * FROM audit_logs WHERE group_id = ? ORDER BY created_date DESC LIMIT ?`,
      [groupId, limit]
    );
    return rows.map((r) => ({
      ...r,
      changed_fields: typeof r.changed_fields === 'string' ? JSON.parse(r.changed_fields) : [],
      snapshot: typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : {},
    }));
  },

  async getByExpenseId(expenseId: string): Promise<AuditLog[]> {
    const rows = await queryAll<any>(
      `SELECT * FROM audit_logs WHERE expense_id = ? ORDER BY created_date DESC`,
      [expenseId]
    );
    return rows.map((r) => ({
      ...r,
      changed_fields: typeof r.changed_fields === 'string' ? JSON.parse(r.changed_fields) : [],
      snapshot: typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : {},
    }));
  },

  async deleteByGroupId(groupId: string): Promise<void> {
    await execute('DELETE FROM audit_logs WHERE group_id = ?', [groupId]);
  },
};