import { queryAll, queryFirst, execute } from '@/database/db';
import { DailyMeal } from '@/types';

export const MealRepository = {
  async upsert(meal: Partial<DailyMeal> & { id: string }): Promise<void> {
    await execute(
      `INSERT OR REPLACE INTO daily_meals
        (id, group_id, member_id, member_name, date, breakfast, lunch, dinner, extra,
         total, notes, updated_by, version, client_operation_id, deleted_at, deleted_by,
         created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meal.id,
        meal.group_id,
        meal.member_id,
        meal.member_name,
        meal.date,
        meal.breakfast || 0,
        meal.lunch || 0,
        meal.dinner || 0,
        meal.extra || 0,
        meal.total || 0,
        meal.notes || null,
        meal.updated_by || null,
        meal.version || 1,
        meal.client_operation_id || null,
        meal.deleted_at || null,
        meal.deleted_by || null,
        meal.created_date || new Date().toISOString(),
        meal.updated_date || new Date().toISOString(),
      ]
    );
  },

  async getById(id: string): Promise<DailyMeal | null> {
    const row = await queryFirst<any>(
      `SELECT * FROM daily_meals WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return row ? this.deserialize(row) : null;
  },

  async getByGroupId(groupId: string, options?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    memberId?: string;
  }): Promise<DailyMeal[]> {
    let sql = `SELECT * FROM daily_meals WHERE group_id = ? AND deleted_at IS NULL`;
    const params: any[] = [groupId];

    if (options?.date) {
      sql += ` AND date = ?`;
      params.push(options.date);
    }
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
    sql += ` ORDER BY date DESC`;

    const rows = await queryAll<any>(sql, params);
    return rows.map((r) => this.deserialize(r));
  },

  async getByMemberAndDate(groupId: string, memberId: string, date: string): Promise<DailyMeal | null> {
    const row = await queryFirst<any>(
      `SELECT * FROM daily_meals WHERE group_id = ? AND member_id = ? AND date = ? AND deleted_at IS NULL LIMIT 1`,
      [groupId, memberId, date]
    );
    return row ? this.deserialize(row) : null;
  },

  async softDelete(id: string, deletedBy?: string): Promise<void> {
    await execute(
      `UPDATE daily_meals SET deleted_at = ?, deleted_by = ? WHERE id = ?`,
      [new Date().toISOString(), deletedBy || null, id]
    );
  },

  async hardDelete(id: string): Promise<void> {
    await execute('DELETE FROM daily_meals WHERE id = ?', [id]);
  },

  async deleteByGroupId(groupId: string): Promise<void> {
    await execute('DELETE FROM daily_meals WHERE group_id = ?', [groupId]);
  },

  deserialize(row: any): DailyMeal {
    return {
      ...row,
      breakfast: Number(row.breakfast) || 0,
      lunch: Number(row.lunch) || 0,
      dinner: Number(row.dinner) || 0,
      extra: Number(row.extra) || 0,
      total: Number(row.total) || 0,
      version: Number(row.version) || 1,
    };
  },
};
