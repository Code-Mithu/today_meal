// SQLite schema definitions for the offline-first local database.
// Every group-scoped table has a group_id column with an index.
// Mutable records carry version + updated_date for optimistic concurrency.

export const SCHEMA_SQL = `
-- Groups (cached from backend)
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  month TEXT,
  currency TEXT DEFAULT 'BDT',
  start_date TEXT,
  logo_url TEXT,
  manager_name TEXT,
  manager_member_id TEXT,
  sub_manager_name TEXT,
  sub_manager_member_id TEXT,
  treasurer_name TEXT,
  treasurer_member_id TEXT,
  assistant_manager_name TEXT,
  join_code TEXT,
  join_code_enabled INTEGER DEFAULT 1,
  member_ids TEXT DEFAULT '[]',
  active INTEGER DEFAULT 1,
  created_date TEXT,
  updated_date TEXT,
  created_by_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(active);

-- Members (group-scoped)
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT,
  member_name TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  permissions TEXT DEFAULT '{}',
  start_date TEXT,
  active INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  frozen_at TEXT,
  frozen_by TEXT,
  updated_by TEXT,
  version INTEGER DEFAULT 1,
  created_date TEXT,
  updated_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);

-- Expenses (group-scoped, mutable)
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  month TEXT NOT NULL,
  date TEXT NOT NULL,
  spent_by TEXT,
  meal_manager_name TEXT,
  assistant_meal_manager_name TEXT,
  number_of_meals INTEGER DEFAULT 0,
  food_expenses TEXT DEFAULT '[]',
  food_expense_title TEXT,
  category TEXT,
  food_expense_amount REAL DEFAULT 0,
  vendor_shop_name TEXT,
  notes TEXT,
  other_expenses TEXT DEFAULT '[]',
  other_expense_title TEXT,
  other_expense_amount REAL DEFAULT 0,
  total_daily_expense REAL DEFAULT 0,
  cost_per_meal REAL DEFAULT 0,
  approval_status TEXT DEFAULT 'approved',
  reviewed_by TEXT,
  reviewed_at TEXT,
  rejection_reason TEXT,
  receipt_uri TEXT,
  currency TEXT DEFAULT 'BDT',
  exchange_rate REAL DEFAULT 1,
  normalized_amount REAL,
  created_by_name TEXT,
  updated_by_id TEXT,
  updated_by_name TEXT,
  version INTEGER DEFAULT 1,
  client_operation_id TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_date TEXT,
  updated_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_month ON expenses(month);
CREATE INDEX IF NOT EXISTS idx_expenses_version ON expenses(version);
CREATE INDEX IF NOT EXISTS idx_expenses_client_op ON expenses(client_operation_id);

-- Contributions (group-scoped, mutable)
CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  member_id TEXT,
  member_name TEXT NOT NULL,
  amount REAL DEFAULT 0,
  date TEXT NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  note TEXT,
  added_by_name TEXT,
  updated_by_name TEXT,
  updated_by TEXT,
  version INTEGER DEFAULT 1,
  client_operation_id TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_date TEXT,
  updated_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_contrib_group ON contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_contrib_date ON contributions(date);
CREATE INDEX IF NOT EXISTS idx_contrib_member ON contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_contrib_version ON contributions(version);

-- Daily Meals (group-scoped, mutable)
CREATE TABLE IF NOT EXISTS daily_meals (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  date TEXT NOT NULL,
  breakfast INTEGER DEFAULT 0,
  lunch INTEGER DEFAULT 0,
  dinner INTEGER DEFAULT 0,
  extra INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  notes TEXT,
  updated_by TEXT,
  version INTEGER DEFAULT 1,
  client_operation_id TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_date TEXT,
  updated_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_meals_group ON daily_meals(group_id);
CREATE INDEX IF NOT EXISTS idx_meals_date ON daily_meals(date);
CREATE INDEX IF NOT EXISTS idx_meals_member ON daily_meals(member_id);
CREATE INDEX IF NOT EXISTS idx_meals_version ON daily_meals(version);

-- Daily Menus (group-scoped, mutable)
CREATE TABLE IF NOT EXISTS daily_menus (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  date TEXT NOT NULL,
  month TEXT,
  breakfast_items TEXT DEFAULT '[]',
  lunch_items TEXT DEFAULT '[]',
  dinner_items TEXT DEFAULT '[]',
  special_items TEXT DEFAULT '[]',
  status TEXT DEFAULT 'published',
  version INTEGER DEFAULT 1,
  published_by TEXT,
  published_by_name TEXT,
  published_at TEXT,
  updated_by TEXT,
  updated_by_name TEXT,
  change_note TEXT,
  client_operation_id TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_date TEXT,
  updated_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_menus_group ON daily_menus(group_id);
CREATE INDEX IF NOT EXISTS idx_menus_date ON daily_menus(date);

-- Categories (group-scoped)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  updated_by TEXT,
  version INTEGER DEFAULT 1,
  client_operation_id TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_date TEXT,
  updated_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_categories_group ON categories(group_id);

-- Vendors (group-scoped)
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_info TEXT,
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  updated_by TEXT,
  version INTEGER DEFAULT 1,
  client_operation_id TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  created_date TEXT,
  updated_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_vendors_group ON vendors(group_id);

-- Group Settings (cached)
CREATE TABLE IF NOT EXISTS group_settings (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  meal_rate_method TEXT DEFAULT 'food_only',
  breakfast_enabled INTEGER DEFAULT 1,
  lunch_enabled INTEGER DEFAULT 1,
  dinner_enabled INTEGER DEFAULT 1,
  extra_enabled INTEGER DEFAULT 1,
  high_expense_threshold REAL DEFAULT 5000,
  default_category TEXT,
  default_sort TEXT DEFAULT 'date_desc',
  expense_approval_required INTEGER DEFAULT 0,
  allow_members_add_expenses INTEGER DEFAULT 1,
  allow_members_edit_expenses INTEGER DEFAULT 0,
  allow_members_delete_expenses INTEGER DEFAULT 0,
  notify_high_expense INTEGER DEFAULT 1,
  notify_new_contribution INTEGER DEFAULT 1,
  notify_new_expense INTEGER DEFAULT 1,
  notify_expense_edited INTEGER DEFAULT 0,
  notify_expense_deleted INTEGER DEFAULT 0,
  notify_meal_updates INTEGER DEFAULT 0,
  notify_member_added INTEGER DEFAULT 1,
  notify_member_removed INTEGER DEFAULT 0,
  notify_monthly_report INTEGER DEFAULT 1,
  default_report_period TEXT DEFAULT 'month',
  default_report_format TEXT DEFAULT 'pdf',
  pdf_page_size TEXT DEFAULT 'a4',
  pdf_orientation TEXT DEFAULT 'portrait',
  print_layout TEXT DEFAULT 'standard',
  csv_format TEXT DEFAULT 'standard'
);
CREATE INDEX IF NOT EXISTS idx_settings_group ON group_settings(group_id);

-- Audit Logs (cached, read-only locally)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  expense_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_name TEXT,
  changed_fields TEXT DEFAULT '[]',
  entity_type TEXT,
  previous_value TEXT,
  new_value TEXT,
  snapshot TEXT DEFAULT '{}',
  created_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_group ON audit_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_audit_expense ON audit_logs(expense_id);

-- Planning and finance extensions (all offline-first and group scoped)
CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT, period TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'BDT', start_date TEXT, end_date TEXT, active INTEGER DEFAULT 1, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
CREATE INDEX IF NOT EXISTS idx_budgets_group_period ON budgets(group_id, period);
CREATE TABLE IF NOT EXISTS exchange_rates (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, base_currency TEXT NOT NULL, quote_currency TEXT NOT NULL, rate REAL NOT NULL, rate_date TEXT NOT NULL, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rates_unique ON exchange_rates(group_id, base_currency, quote_currency, rate_date);
CREATE TABLE IF NOT EXISTS recurring_rules (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, frequency TEXT NOT NULL, next_run TEXT NOT NULL, active INTEGER DEFAULT 1, expense_template TEXT DEFAULT '{}', version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
CREATE INDEX IF NOT EXISTS idx_recurring_due ON recurring_rules(group_id, active, next_run);
CREATE TABLE IF NOT EXISTS grocery_lists (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT 'active', linked_expense_id TEXT, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_group ON grocery_lists(group_id, status);
CREATE TABLE IF NOT EXISTS grocery_items (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, list_id TEXT NOT NULL, name TEXT NOT NULL, quantity REAL DEFAULT 1, unit TEXT DEFAULT 'item', estimated_cost REAL DEFAULT 0, actual_cost REAL, assignee TEXT, checked INTEGER DEFAULT 0, menu_id TEXT, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
CREATE INDEX IF NOT EXISTS idx_grocery_items_list ON grocery_items(group_id, list_id, checked);
CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT DEFAULT 'member', status TEXT DEFAULT 'pending', expires_at TEXT, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
CREATE INDEX IF NOT EXISTS idx_invitations_group ON invitations(group_id, status);
CREATE TABLE IF NOT EXISTS report_deliveries (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL, total REAL DEFAULT 0, currency TEXT, version INTEGER DEFAULT 1, client_operation_id TEXT, deleted_at TEXT, created_date TEXT, updated_date TEXT);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_group ON report_deliveries(group_id, created_date);

-- Offline synchronization state. App records remain authoritative while offline.
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_shadow (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);
CREATE TABLE IF NOT EXISTS sync_outbox (
  operation_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  base_version INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_created ON sync_outbox(created_at);

`;
