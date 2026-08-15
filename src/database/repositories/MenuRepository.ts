import { queryAll, queryFirst, execute } from '@/database/db';
import { DailyMenu } from '@/types';

export const MenuRepository = {
  async upsert(menu: Partial<DailyMenu> & { id: string }): Promise<void> {
    await execute(
      `INSERT OR REPLACE INTO daily_menus
        (id, group_id, date, month, breakfast_items, lunch_items, dinner_items,
         special_items, status, version, published_by, published_by_name, published_at,
         updated_by, updated_by_name, change_note, client_operation_id, deleted_at, deleted_by,
         created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        menu.id,
        menu.group_id,
        menu.date,
        menu.month || null,
        JSON.stringify(menu.breakfast_items || []),
        JSON.stringify(menu.lunch_items || []),
        JSON.stringify(menu.dinner_items || []),
        JSON.stringify(menu.special_items || []),
        menu.status || 'published',
        menu.version || 1,
        menu.published_by || null,
        menu.published_by_name || null,
        menu.published_at || null,
        menu.updated_by || null,
        menu.updated_by_name || null,
        menu.change_note || null,
        menu.client_operation_id || null,
        menu.deleted_at || null,
        menu.deleted_by || null,
        menu.created_date || new Date().toISOString(),
        menu.updated_date || new Date().toISOString(),
      ]
    );
  },

  async getById(id: string): Promise<DailyMenu | null> {
    const row = await queryFirst<any>(
      `SELECT * FROM daily_menus WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return row ? this.deserialize(row) : null;
  },

  async getByDate(groupId: string, date: string): Promise<DailyMenu | null> {
    const row = await queryFirst<any>(
      `SELECT * FROM daily_menus WHERE group_id = ? AND date = ? AND deleted_at IS NULL ORDER BY version DESC LIMIT 1`,
      [groupId, date]
    );
    return row ? this.deserialize(row) : null;
  },

  async getByGroupId(groupId: string, options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<DailyMenu[]> {
    let sql = `SELECT * FROM daily_menus WHERE group_id = ? AND deleted_at IS NULL`;
    const params: any[] = [groupId];

    if (options?.startDate) {
      sql += ` AND date >= ?`;
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ` AND date <= ?`;
      params.push(options.endDate);
    }
    sql += ` ORDER BY date DESC`;
    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = await queryAll<any>(sql, params);
    return rows.map((r) => this.deserialize(r));
  },

  async softDelete(id: string, deletedBy?: string): Promise<void> {
    await execute(
      `UPDATE daily_menus SET deleted_at = ?, deleted_by = ? WHERE id = ?`,
      [new Date().toISOString(), deletedBy || null, id]
    );
  },

  async hardDelete(id: string): Promise<void> {
    await execute('DELETE FROM daily_menus WHERE id = ?', [id]);
  },

  async deleteByGroupId(groupId: string): Promise<void> {
    await execute('DELETE FROM daily_menus WHERE group_id = ?', [groupId]);
  },

  deserialize(row: any): DailyMenu {
    return {
      ...row,
      breakfast_items: typeof row.breakfast_items === 'string' ? JSON.parse(row.breakfast_items) : row.breakfast_items || [],
      lunch_items: typeof row.lunch_items === 'string' ? JSON.parse(row.lunch_items) : row.lunch_items || [],
      dinner_items: typeof row.dinner_items === 'string' ? JSON.parse(row.dinner_items) : row.dinner_items || [],
      special_items: typeof row.special_items === 'string' ? JSON.parse(row.special_items) : row.special_items || [],
      version: Number(row.version) || 1,
    };
  },
};
