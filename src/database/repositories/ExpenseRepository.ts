import { queryAll, queryFirst, execute } from '@/database/db';
import { Expense } from '@/types';

export const ExpenseRepository = {
  async upsert(expense: Partial<Expense> & { id: string }): Promise<void> {
    await execute(
      `INSERT OR REPLACE INTO expenses
        (id, group_id, month, date, spent_by, meal_manager_name, assistant_meal_manager_name,
         number_of_meals, food_expenses, food_expense_title, category, food_expense_amount,
         vendor_shop_name, notes, other_expenses, other_expense_title, other_expense_amount,
         total_daily_expense, cost_per_meal, approval_status, reviewed_by, reviewed_at,
         rejection_reason, receipt_uri, currency, exchange_rate, normalized_amount,
         created_by_name, updated_by_id, updated_by_name, version, client_operation_id,
         deleted_at, deleted_by, created_date, updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expense.id,
        expense.group_id,
        expense.month,
        expense.date,
        expense.spent_by || null,
        expense.meal_manager_name || null,
        expense.assistant_meal_manager_name || null,
        expense.number_of_meals || 0,
        JSON.stringify(expense.food_expenses || []),
        expense.food_expense_title || null,
        expense.category || null,
        expense.food_expense_amount || 0,
        expense.vendor_shop_name || null,
        expense.notes || null,
        JSON.stringify(expense.other_expenses || []),
        expense.other_expense_title || null,
        expense.other_expense_amount || 0,
        expense.total_daily_expense || 0,
        expense.cost_per_meal || 0,
        expense.approval_status || 'approved',
        expense.reviewed_by || null,
        expense.reviewed_at || null,
        expense.rejection_reason || null,
        expense.receipt_uri || null,
        expense.currency || 'BDT',
        expense.exchange_rate || 1,
        expense.normalized_amount ?? expense.total_daily_expense ?? 0,
        expense.created_by_name || null,
        expense.updated_by_id || null,
        expense.updated_by_name || null,
        expense.version || 1,
        expense.client_operation_id || null,
        expense.deleted_at || null,
        expense.deleted_by || null,
        expense.created_date || new Date().toISOString(),
        expense.updated_date || new Date().toISOString(),
      ]
    );
  },

  async getById(id: string): Promise<Expense | null> {
    const row = await queryFirst<any>(
      `SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return row ? this.deserialize(row) : null;
  },

  async getByGroupId(groupId: string, options?: {
    month?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<Expense[]> {
    let sql = `SELECT * FROM expenses WHERE group_id = ? AND deleted_at IS NULL`;
    const params: any[] = [groupId];

    if (options?.month) {
      sql += ` AND month = ?`;
      params.push(options.month);
    }
    if (options?.startDate) {
      sql += ` AND date >= ?`;
      params.push(options.startDate);
    }
    if (options?.endDate) {
      sql += ` AND date <= ?`;
      params.push(options.endDate);
    }
    sql += ` ORDER BY date DESC, created_date DESC`;
    if (options?.limit) {
      sql += ` LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset || 0);
    }

    const rows = await queryAll<any>(sql, params);
    return rows.map((r) => this.deserialize(r));
  },

  async getByDate(groupId: string, date: string): Promise<Expense[]> {
    const rows = await queryAll<any>(
      `SELECT * FROM expenses WHERE group_id = ? AND date = ? AND deleted_at IS NULL ORDER BY created_date DESC`,
      [groupId, date]
    );
    return rows.map((r) => this.deserialize(r));
  },

  async softDelete(id: string, deletedBy?: string): Promise<void> {
    await execute(
      `UPDATE expenses SET deleted_at = ?, deleted_by = ? WHERE id = ?`,
      [new Date().toISOString(), deletedBy || null, id]
    );
  },

  async hardDelete(id: string): Promise<void> {
    await execute('DELETE FROM expenses WHERE id = ?', [id]);
  },

  async deleteByGroupId(groupId: string): Promise<void> {
    await execute('DELETE FROM expenses WHERE group_id = ?', [groupId]);
  },

  async updateVersion(id: string, version: number): Promise<void> {
    await execute('UPDATE expenses SET version = ? WHERE id = ?', [version, id]);
  },

  deserialize(row: any): Expense {
    return {
      ...row,
      number_of_meals: Number(row.number_of_meals) || 0,
      food_expense_amount: Number(row.food_expense_amount) || 0,
      other_expense_amount: Number(row.other_expense_amount) || 0,
      total_daily_expense: Number(row.total_daily_expense) || 0,
      cost_per_meal: Number(row.cost_per_meal) || 0,
      version: Number(row.version) || 1,
      food_expenses: typeof row.food_expenses === 'string' ? JSON.parse(row.food_expenses) : row.food_expenses || [],
      other_expenses: typeof row.other_expenses === 'string' ? JSON.parse(row.other_expenses) : row.other_expenses || [],
    };
  },
};
