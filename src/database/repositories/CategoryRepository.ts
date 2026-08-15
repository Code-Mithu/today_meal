import { queryAll, queryFirst, execute } from '@/database/db';
import { Category } from '@/types';

export const CategoryRepository = {
  async upsert(category: Partial<Category> & { id: string }): Promise<void> {
    await execute(
      `INSERT OR REPLACE INTO categories
        (id, group_id, name, active, sort_order, updated_by, version,
         client_operation_id, deleted_at, deleted_by, created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category.id,
        category.group_id,
        category.name,
        category.active ? 1 : 0,
        category.sort_order || 0,
        category.updated_by || null,
        category.version || 1,
        category.client_operation_id || null,
        category.deleted_at || null,
        category.deleted_by || null,
        category.created_date || new Date().toISOString(),
        category.updated_date || new Date().toISOString(),
      ]
    );
  },

  async getByGroupId(groupId: string, activeOnly: boolean = true): Promise<Category[]> {
    const sql = activeOnly
      ? `SELECT * FROM categories WHERE group_id = ? AND active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM categories WHERE group_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`;
    const rows = await queryAll<any>(sql, [groupId]);
    return rows.map((r) => this.deserialize(r));
  },

  async getById(id: string): Promise<Category | null> {
    const row = await queryFirst<any>('SELECT * FROM categories WHERE id = ?', [id]);
    return row ? this.deserialize(row) : null;
  },

  async softDelete(id: string): Promise<void> {
    await execute('UPDATE categories SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  },

  async deleteByGroupId(groupId: string): Promise<void> {
    await execute('DELETE FROM categories WHERE group_id = ?', [groupId]);
  },

  deserialize(row: any): Category {
    return {
      ...row,
      active: !!row.active,
      sort_order: Number(row.sort_order) || 0,
      version: Number(row.version) || 1,
    };
  },
};
