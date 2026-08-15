import { queryFirst } from './db';
import { GroupRepository } from './repositories/GroupRepository';
import { MemberRepository } from './repositories/MemberRepository';
import { CategoryRepository } from './repositories/CategoryRepository';
import { VendorRepository } from './repositories/VendorRepository';
import { ExpenseRepository } from './repositories/ExpenseRepository';
import { ContributionRepository } from './repositories/ContributionRepository';
import { MealRepository } from './repositories/MealRepository';
import { MenuRepository } from './repositories/MenuRepository';
import { AuditLogRepository } from './repositories/AuditLogRepository';
import { getMonthString, getTodayString } from '@/utils/formatters';

export const LOCAL_GROUP_ID = 'local-household';
export const LOCAL_MEMBER_ID = 'local-owner-member';

export async function seedOfflineData(force = false): Promise<void> {
  const existing = await queryFirst<{ id: string }>('SELECT id FROM groups WHERE id = ?', [LOCAL_GROUP_ID]);
  if (existing && !force) return;
  const now = new Date().toISOString();
  const today = getTodayString();
  const month = getMonthString();
  await GroupRepository.upsert({ id: LOCAL_GROUP_ID, name: 'Today Meal Household', description: 'Private offline meal and expense manager', month, currency: 'BDT', start_date: `${month}-01`, manager_name: 'Household Owner', manager_member_id: LOCAL_MEMBER_ID, join_code: '', join_code_enabled: false, member_ids: [LOCAL_MEMBER_ID, 'member-2', 'member-3'], active: true, created_by_id: 'local-owner', created_date: now, updated_date: now });
  const members = [
    { id: LOCAL_MEMBER_ID, user_id: 'local-owner', member_name: 'Household Owner', role: 'group_admin' as const },
    { id: 'member-2', user_id: 'member-2', member_name: 'Amina Rahman', role: 'member' as const },
    { id: 'member-3', user_id: 'member-3', member_name: 'Rafi Ahmed', role: 'member' as const },
  ];
  for (const member of members) await MemberRepository.upsert({ ...member, group_id: LOCAL_GROUP_ID, permissions: {}, start_date: `${month}-01`, active: true, status: 'active', version: 1, created_date: now, updated_date: now });
  for (const [index, name] of ['Rice & Grains', 'Vegetables', 'Protein', 'Spices', 'Cooking Fuel', 'Other'].entries()) await CategoryRepository.upsert({ id: `category-${index}`, group_id: LOCAL_GROUP_ID, name, active: true, sort_order: index, version: 1, created_date: now, updated_date: now });
  for (const [index, vendor] of [['Fresh Market', 'Local bazaar'], ['City Grocer', 'Main road'], ['Rahman Foods', 'Wholesale']].entries()) await VendorRepository.upsert({ id: `vendor-${index}`, group_id: LOCAL_GROUP_ID, name: vendor[0], contact_info: vendor[1], active: true, sort_order: index, version: 1, created_date: now, updated_date: now });
  const sampleExpenses = [
    { id: 'sample-expense-1', date: today, title: 'Rice, vegetables and chicken', category: 'Protein', food: 1860, other: 120, meals: 18, vendor: 'Fresh Market' },
    { id: 'sample-expense-2', date: `${month}-05`, title: 'Breakfast groceries', category: 'Rice & Grains', food: 980, other: 0, meals: 15, vendor: 'City Grocer' },
    { id: 'sample-expense-3', date: `${month}-02`, title: 'Cooking gas refill', category: 'Cooking Fuel', food: 0, other: 1350, meals: 0, vendor: 'Rahman Foods' },
  ];
  for (const item of sampleExpenses) await ExpenseRepository.upsert({ id: item.id, group_id: LOCAL_GROUP_ID, month, date: item.date, spent_by: 'Household Owner', number_of_meals: item.meals, food_expenses: item.food ? [{ title: item.title, category: item.category, amount: item.food }] : [], food_expense_title: item.title, category: item.category, food_expense_amount: item.food, vendor_shop_name: item.vendor, notes: 'Sample offline record', other_expenses: item.other ? [{ title: item.title, amount: item.other }] : [], other_expense_title: item.other ? item.title : undefined, other_expense_amount: item.other, total_daily_expense: item.food + item.other, cost_per_meal: item.meals ? (item.food + item.other) / item.meals : 0, version: 1, created_date: now, updated_date: now });
  for (const [index, member] of members.entries()) await ContributionRepository.upsert({ id: `sample-contribution-${index}`, group_id: LOCAL_GROUP_ID, member_id: member.id, member_name: member.member_name, amount: 3000 + index * 500, date: `${month}-01`, payment_method: index === 0 ? 'cash' : 'mobile_transfer', note: 'Monthly contribution', version: 1, created_date: now, updated_date: now });
  for (const [index, member] of members.entries()) await MealRepository.upsert({ id: `sample-meal-${index}`, group_id: LOCAL_GROUP_ID, member_id: member.id, member_name: member.member_name, date: today, breakfast: 1, lunch: 1, dinner: 1, extra: index === 0 ? 1 : 0, total: index === 0 ? 4 : 3, version: 1, created_date: now, updated_date: now });
  await MenuRepository.upsert({ id: 'sample-menu-today', group_id: LOCAL_GROUP_ID, date: today, month, breakfast_items: [{ name: 'Paratha and egg' }], lunch_items: [{ name: 'Rice, chicken curry and dal' }], dinner_items: [{ name: 'Khichuri and salad' }], special_items: [{ name: 'Seasonal fruit' }], status: 'published', version: 1, created_date: now, updated_date: now });
  await AuditLogRepository.upsert({ id: 'sample-audit-1', group_id: LOCAL_GROUP_ID, expense_id: 'sample-expense-1', action: 'create', actor_id: 'local-owner', actor_name: 'Household Owner', entity_type: 'Expense', changed_fields: ['food_expense_amount', 'number_of_meals'], snapshot: {}, created_date: now });
}
