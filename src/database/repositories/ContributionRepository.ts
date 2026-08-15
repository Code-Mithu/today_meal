import { queryAll, queryFirst, execute } from '@/database/db';
import { Contribution } from '@/types';

export const ContributionRepository = {
  async upsert(contribution: Partial<Contribution> & { id: string }): Promise<void> {
    await execute(
      `INSERT OR REPLACE INTO contributions
        (id, group_id, member_id, member_name, amount, date, payment_method,
         note, added_by_name, updated_by_name, updated_by, version,
         client_operation_id, deleted_at, deleted_by, created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contribution.id,
        contribution.group_id,
        contribution.member_id || null,
        contribution.member_name,
        contribution.amount || 0,
        contribution.date,
        contribution.payment_method || 'cash',
        contribution.note || null,
        contribution.added_by_name || null,
        contribution.updated_by_name || null,
        contribution.updated_by || null,
        contribution.version || 1,
        contribution.client_operation_id || null,
        contribution.deleted_at || null,
        contribution.deleted_by || null,
        contribution.created_date || new Date().toISOString(),
        contribution.updated_date || new Date().toISOString(),
      ]
    );
  },

  async getById(id: string): Promise<Contribution | null> {
    const row = await queryFirst<any>(
      `SELECT * FROM contributions WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return row ? this.deserialize(row) : null;
  },

  async getByGroupId(groupId: string, options?: {
    startDate?: string;
    endDate?: string;
    memberId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Contribution[]> {
    let sql = `SELECT * FROM contributions WHERE group_id = ? AND deleted_at IS NULL`;
    const params: any[] = [groupId];

    if (options?.startDate) {
      sql += ` AND date >= ?`;
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ` AND date <= ?`;
      params.push(options.endDate);
    }
    if (options?.memberId) {
      sql += ` AND member_id = ?`;
      params.push(options.memberId);
    }
    sql += ` ORDER BY date DESC, created_date DESC`;
    if (options?.limit) {
      sql += ` LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset || 0);
    }

    const rows = await queryAll<any>(sql, params);
    return rows.map((r) => this.deserialize(r));
  },

  async getByMemberId(groupId: string, memberId: string): Promise<Contribution[]> {
    const rows = await queryAll<any>(
      `SELECT * FROM contributions WHERE group_id = ? AND member_id = ? AND deleted_at IS NULL ORDER BY date DESC`,
      [groupId, memberId]
    );
    return rows.map((r) => this.deserialize(r));
  },

  async softDelete(id: string, deletedBy?: string): Promise<void> {
    await execute(
      `UPDATE contributions SET deleted_at = ?, deleted_by = ? WHERE id = ?`,
      [new Date().toISOString(), deletedBy || null, id]
    );
  },

  async hardDelete(id: string): Promise<void> {
    await execute('DELETE FROM contributions WHERE id = ?', [id]);
  },

  async deleteByGroupId(groupId: string): Promise<void> {
    await execute('DELETE FROM contributions WHERE group_id = ?', [groupId]);
  },

  deserialize(row: any): Contribution {
    return {
      ...row,
      amount: Number(row.amount) || 0,
      version: Number(row.version) || 1,
    };
  },
};
