import { queryAll, queryFirst, execute } from '@/database/db';
import { Vendor } from '@/types';

export const VendorRepository = {
  async upsert(vendor: Partial<Vendor> & { id: string }): Promise<void> {
    await execute(
      `INSERT OR REPLACE INTO vendors
        (id, group_id, name, contact_info, active, sort_order, updated_by, version,
         client_operation_id, deleted_at, deleted_by, created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendor.id,
        vendor.group_id,
        vendor.name,
        vendor.contact_info || null,
        vendor.active ? 1 : 0,
        vendor.sort_order || 0,
        vendor.updated_by || null,
        vendor.version || 1,
        vendor.client_operation_id || null,
        vendor.deleted_at || null,
        vendor.deleted_by || null,
        vendor.created_date || new Date().toISOString(),
        vendor.updated_date || new Date().toISOString(),
      ]
    );
  },

  async getByGroupId(groupId: string, activeOnly: boolean = true): Promise<Vendor[]> {
    const sql = activeOnly
      ? `SELECT * FROM vendors WHERE group_id = ? AND active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`
      : `SELECT * FROM vendors WHERE group_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC`;
    const rows = await queryAll<any>(sql, [groupId]);
    return rows.map((r) => this.deserialize(r));
  },

  async getById(id: string): Promise<Vendor | null> {
    const row = await queryFirst<any>('SELECT * FROM vendors WHERE id = ?', [id]);
    return row ? this.deserialize(row) : null;
  },

  async softDelete(id: string): Promise<void> {
    await execute('UPDATE vendors SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  },

  async deleteByGroupId(groupId: string): Promise<void> {
    await execute('DELETE FROM vendors WHERE group_id = ?', [groupId]);
  },

  deserialize(row: any): Vendor {
    return {
      ...row,
      active: !!row.active,
      sort_order: Number(row.sort_order) || 0,
      version: Number(row.version) || 1,
    };
  },
};
