// Authoritative entity types for the on-device SQLite database.

export type GroupRole =
  | 'group_admin'
  | 'creator'
  | 'manager'
  | 'treasurer'
  | 'sub_manager'
  | 'assistant_manager'
  | 'member';

export type MemberStatus = 'active' | 'frozen';

export interface MealGroup {
  id: string;
  created_date: string;
  updated_date: string;
  created_by_id: string;
  month: string; // YYYY-MM
  name: string;
  description?: string;
  group_type?: string;
  currency: string;
  start_date?: string;
  logo_url?: string;
  manager_name?: string;
  manager_member_id?: string;
  sub_manager_name?: string;
  sub_manager_member_id?: string;
  treasurer_name?: string;
  treasurer_member_id?: string;
  assistant_manager_name?: string;
  join_code: string;
  join_code_enabled: boolean;
  member_ids: string[];
  active: boolean;
}

export interface MealGroupMember {
  id: string;
  created_date: string;
  updated_date: string;
  group_id: string;
  user_id?: string;
  member_name: string;
  role: GroupRole;
  permissions: Record<string, boolean>;
  start_date: string;
  active: boolean;
  status: MemberStatus;
  frozen_at?: string;
  frozen_by?: string;
  updated_by?: string;
  version: number;
}

export interface FoodExpenseItem {
  title: string;
  category: string;
  amount: number;
}

export interface OtherExpenseItem {
  title: string;
  amount: number;
}

export interface Expense {
  id: string;
  created_date: string;
  updated_date: string;
  group_id: string;
  month: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  spent_by?: string;
  meal_manager_name?: string;
  assistant_meal_manager_name?: string;
  number_of_meals: number;
  food_expenses: FoodExpenseItem[];
  food_expense_title?: string;
  category?: string;
  food_expense_amount: number;
  vendor_shop_name?: string;
  notes?: string;
  other_expenses: OtherExpenseItem[];
  other_expense_title?: string;
  other_expense_amount: number;
  total_daily_expense: number;
  cost_per_meal: number;
  approval_status?: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  receipt_uri?: string;
  currency?: string;
  exchange_rate?: number;
  normalized_amount?: number;
  created_by_name?: string;
  updated_by_id?: string;
  updated_by_name?: string;
  version: number;
  client_operation_id?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_transfer' | 'cheque' | 'other';

export interface Contribution {
  id: string;
  created_date: string;
  updated_date: string;
  group_id: string;
  member_id?: string;
  member_name: string;
  amount: number;
  date: string;
  payment_method: PaymentMethod;
  note?: string;
  added_by_name?: string;
  updated_by_name?: string;
  updated_by?: string;
  version: number;
  client_operation_id?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface DailyMeal {
  id: string;
  created_date: string;
  updated_date: string;
  group_id: string;
  member_id: string;
  member_name: string;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  extra: number;
  total: number;
  notes?: string;
  updated_by?: string;
  version: number;
  client_operation_id?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface MenuItem {
  name: string;
  description?: string;
  quantity?: string;
  note?: string;
}

export type MenuStatus = 'draft' | 'published';

export interface DailyMenu {
  id: string;
  created_date: string;
  updated_date: string;
  group_id: string;
  date: string;
  month: string;
  breakfast_items: MenuItem[];
  lunch_items: MenuItem[];
  dinner_items: MenuItem[];
  special_items: MenuItem[];
  status: MenuStatus;
  version: number;
  published_by?: string;
  published_by_name?: string;
  published_at?: string;
  updated_by?: string;
  updated_by_name?: string;
  change_note?: string;
  client_operation_id?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Category {
  id: string;
  created_date: string;
  updated_date: string;
  group_id: string;
  name: string;
  active: boolean;
  sort_order: number;
  updated_by?: string;
  version: number;
  client_operation_id?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Vendor {
  id: string;
  created_date: string;
  updated_date: string;
  group_id: string;
  name: string;
  contact_info?: string;
  active: boolean;
  sort_order: number;
  updated_by?: string;
  version: number;
  client_operation_id?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface GroupJoinRequest {
  id: string;
  created_date: string;
  updated_date: string;
  group_id: string;
  group_name?: string;
  requester_user_id?: string;
  requester_name: string;
  requester_email?: string;
  guest_token?: string;
  status: JoinRequestStatus;
  requested_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  rejection_reason?: string;
  created_member_id?: string;
}

export interface AuditLog {
  id: string;
  created_date: string;
  group_id?: string;
  expense_id?: string;
  action: 'create' | 'update' | 'delete';
  actor_id: string;
  actor_name?: string;
  changed_fields?: string[];
  entity_type?: string;
  previous_value?: string;
  new_value?: string;
  snapshot?: Record<string, any>;
}

export interface Budget { id: string; group_id: string; name: string; category?: string; period: string; amount: number; currency: string; start_date?: string; end_date?: string; active: boolean; version: number; created_date: string; updated_date: string; }
export interface ExchangeRate { id: string; group_id: string; base_currency: string; quote_currency: string; rate: number; rate_date: string; version: number; created_date: string; updated_date: string; }
export interface RecurringRule { id: string; group_id: string; name: string; frequency: 'weekly' | 'monthly' | 'yearly'; next_run: string; active: boolean; expense_template: Record<string, unknown>; version: number; created_date: string; updated_date: string; }
export interface GroceryList { id: string; group_id: string; name: string; status: 'active' | 'completed'; linked_expense_id?: string; version: number; created_date: string; updated_date: string; }
export interface GroceryItem { id: string; group_id: string; list_id: string; name: string; quantity: number; unit: string; estimated_cost: number; actual_cost?: number; assignee?: string; checked: boolean; menu_id?: string; version: number; created_date: string; updated_date: string; }
export interface Invitation { id: string; group_id: string; email: string; role: string; status: 'pending' | 'accepted' | 'revoked' | 'failed'; expires_at?: string; created_date: string; updated_date: string; }

export interface GroupSettings {
  id: string;
  group_id: string;
  meal_rate_method: 'food_only' | 'food_and_other';
  breakfast_enabled: boolean;
  lunch_enabled: boolean;
  dinner_enabled: boolean;
  extra_enabled: boolean;
  high_expense_threshold: number;
  default_category?: string;
  default_sort: 'date_asc' | 'date_desc';
  expense_approval_required: boolean;
  allow_members_add_expenses: boolean;
  allow_members_edit_expenses: boolean;
  allow_members_delete_expenses: boolean;
  notify_high_expense: boolean;
  notify_new_contribution: boolean;
  notify_new_expense: boolean;
  notify_expense_edited: boolean;
  notify_expense_deleted: boolean;
  notify_meal_updates: boolean;
  notify_member_added: boolean;
  notify_member_removed: boolean;
  notify_monthly_report: boolean;
  default_report_period: 'month' | 'previous_month' | 'quarter' | 'year';
  default_report_format: 'pdf' | 'csv' | 'print';
  pdf_page_size: 'a4' | 'letter';
  pdf_orientation: 'portrait' | 'landscape';
  print_layout: 'standard' | 'compact' | 'detailed';
  csv_format: 'standard' | 'detailed';
}
