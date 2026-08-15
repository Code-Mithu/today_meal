import { queryAll, queryFirst, execute } from '@/database/db';
import { MealGroupMember } from '@/types';

export const MemberRepository = {
  async upsert(member: Partial<MealGroupMember> & { id: string }): Promise<void> {
    await execute(
      `INSERT OR REPLACE INTO members
        (id, group_id, user_id, member_name, role, permissions, start_date,
         active, status, frozen_at, frozen_by, updated_by, version,
         created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member.id,
        member.group_id,
        member.user_id || null,
        member.member_name,
        member.role || 'member',
        JSON.stringify(member.permissions || {}),
        member.start_date,
        member.active ? 1 : 0,
        member.status || 'active',
        member.frozen_at || null,
        member.frozen_by || null,
        member.updated_by || null,
        member.version || 1,
        member.created_date || new Date().toISOString(),
        member.updated_date || new Date().toISOString(),
      ]
    );
  },

  async getById(id: string): Promise<MealGroupMember | null> {
    const row = await queryFirst<any>('SELECT * FROM members WHERE id = ?', [id]);
    return row ? this.deserialize(row) : null;
  },

  async getByGroupId(groupId: string): Promise<MealGroupMember[]> {
    const rows = await queryAll<any>(
      `SELECT * FROM members WHERE group_id = ? AND active = 1 ORDER BY member_name ASC`,
      [groupId]
    );
    return rows.map((r) => this.deserialize(r));
  },

  async getByUserId(userId: string): Promise<MealGroupMember[]> {
    const rows = await queryAll<any>(
      `SELECT * FROM members WHERE user_id = ? AND active = 1`,
      [userId]
    );
    return rows.map((r) => this.deserialize(r));
  },

  async getByGroupIdAndUserId(groupId: string, userId: string): Promise<MealGroupMember | null> {
    const row = await queryFirst<any>(
      `SELECT * FROM members WHERE group_id = ? AND user_id = ? AND active = 1 LIMIT 1`,
      [groupId, userId]
    );
    return row ? this.deserialize(row) : null;
  },

  async softDelete(id: string): Promise<void> {
    await execute('UPDATE members SET active = 0 WHERE id = ?', [id]);
  },

  async delete(id: string): Promise<void> {
    await execute('DELETE FROM members WHERE id = ?', [id]);
  },

  async deleteByGroupId(groupId: string): Promise<void> {
    await execute('DELETE FROM members WHERE group_id = ?', [groupId]);
  },

  async updateStatus(id: string, status: 'active' | 'frozen', frozenBy?: string): Promise<void> {
    if (status === 'frozen') {
      await execute(
        `UPDATE members SET status = 'frozen', frozen_at = ?, frozen_by = ? WHERE id = ?`,
        [new Date().toISOString(), frozenBy || null, id]
      );
    } else {
      await execute(
        `UPDATE members SET status = 'active', frozen_at = NULL, frozen_by = NULL WHERE id = ?`,
        [id]
      );
    }
  },

  deserialize(row: any): MealGroupMember {
    return {
      ...row,
      active: !!row.active,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions || {},
    };
  },
};
