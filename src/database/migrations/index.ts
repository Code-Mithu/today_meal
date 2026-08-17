import { getDb } from '../db';

// Future schema migrations go here.
// Each migration is a function that ALTERs the schema for a specific version.
// The initial schema is created by schema.ts on first open.

const MIGRATIONS: Array<{ version: number; up: (db: any) => Promise<void> }> = [
  {
    version: 2,
    up: async (db) => {
      const expenseColumns = await db.getAllAsync('PRAGMA table_info(expenses)') as Array<{ name: string }>;
      const names = new Set(expenseColumns.map((column) => column.name));
      const additions = [
        ['approval_status', "TEXT DEFAULT 'approved'"], ['reviewed_by', 'TEXT'],
        ['reviewed_at', 'TEXT'], ['rejection_reason', 'TEXT'], ['receipt_uri', 'TEXT'],
        ['currency', "TEXT DEFAULT 'BDT'"], ['exchange_rate', 'REAL DEFAULT 1'],
        ['normalized_amount', 'REAL'],
      ];
      for (const [name, definition] of additions) {
        if (!names.has(name)) await db.execAsync(`ALTER TABLE expenses ADD COLUMN ${name} ${definition}`);
      }
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT, period TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'BDT', start_date TEXT, end_date TEXT, active INTEGER DEFAULT 1, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
        CREATE TABLE IF NOT EXISTS exchange_rates (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, base_currency TEXT NOT NULL, quote_currency TEXT NOT NULL, rate REAL NOT NULL, rate_date TEXT NOT NULL, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
        CREATE TABLE IF NOT EXISTS recurring_rules (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, frequency TEXT NOT NULL, next_run TEXT NOT NULL, active INTEGER DEFAULT 1, expense_template TEXT DEFAULT '{}', version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
        CREATE TABLE IF NOT EXISTS grocery_lists (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'active', linked_expense_id TEXT, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
        CREATE TABLE IF NOT EXISTS grocery_items (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, list_id TEXT NOT NULL, name TEXT NOT NULL, quantity REAL DEFAULT 1, unit TEXT DEFAULT 'item', estimated_cost REAL DEFAULT 0, actual_cost REAL, assignee TEXT, checked INTEGER DEFAULT 0, menu_id TEXT, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
        CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT DEFAULT 'member', status TEXT DEFAULT 'pending', expires_at TEXT, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
        CREATE TABLE IF NOT EXISTS report_deliveries (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL, total REAL DEFAULT 0, currency TEXT, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
        CREATE INDEX IF NOT EXISTS idx_budgets_group_period ON budgets(group_id, period);
        CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_rules(group_id, active, next_run);
        CREATE INDEX IF NOT EXISTS idx_grocery_items_list ON grocery_items(group_id, list_id, checked);
      `);
    },
  },
];

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  // Ensure migration tracking table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = (await db.getAllAsync(
    'SELECT version FROM schema_migrations ORDER BY version'
  )) as Array<{ version: number }>;
  const appliedVersions = new Set(applied.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [migration.version, new Date().toISOString()]
      );
    }
  }
}
