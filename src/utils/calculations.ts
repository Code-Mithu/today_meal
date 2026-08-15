import { Expense, DailyMeal, Contribution, FoodExpenseItem, OtherExpenseItem } from '@/types';

export function sumFoodExpenses(items: FoodExpenseItem[]): number {
  return (items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

export function sumOtherExpenses(items: OtherExpenseItem[]): number {
  return (items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

export function calculateTotalExpense(expense: Partial<Expense>): number {
  const food = expense.food_expense_amount ?? sumFoodExpenses(expense.food_expenses || []);
  const other = expense.other_expense_amount ?? sumOtherExpenses(expense.other_expenses || []);
  return round(food + other);
}

export function calculateCostPerMeal(totalExpense: number, numberOfMeals: number): number {
  if (!numberOfMeals || numberOfMeals <= 0) return 0;
  return round(totalExpense / numberOfMeals);
}

export function calculateMealTotal(meal: Partial<DailyMeal>): number {
  const b = Number(meal.breakfast) || 0;
  const l = Number(meal.lunch) || 0;
  const d = Number(meal.dinner) || 0;
  const e = Number(meal.extra) || 0;
  return b + l + d + e;
}

export function sumContributions(contributions: Contribution[]): number {
  return (contributions || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

export function sumExpenses(expenses: Expense[]): number {
  return (expenses || []).reduce((sum, e) => sum + (Number(e.total_daily_expense) || 0), 0);
}

export function sumMeals(meals: DailyMeal[]): number {
  return (meals || []).reduce((sum, m) => sum + (Number(m.total) || 0), 0);
}

export function calculateMemberBalance(
  contributions: number,
  mealCost: number
): number {
  return round(contributions - mealCost);
}

export function calculateMealRate(
  totalExpense: number,
  totalMeals: number
): number {
  if (!totalMeals || totalMeals <= 0) return 0;
  return round(totalExpense / totalMeals);
}

export function calculateMemberMealCost(
  memberMeals: number,
  mealRate: number
): number {
  return round(memberMeals * mealRate);
}

export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function groupExpensesByDay(expenses: Expense[]): Record<string, Expense[]> {
  const grouped: Record<string, Expense[]> = {};
  for (const e of expenses || []) {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  }
  return grouped;
}

export function groupExpensesByCategory(expenses: Expense[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const e of expenses || []) {
    for (const item of e.food_expenses || []) {
      const cat = item.category || 'Uncategorized';
      grouped[cat] = (grouped[cat] || 0) + (Number(item.amount) || 0);
    }
  }
  return grouped;
}

export function groupExpensesByVendor(expenses: Expense[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const e of expenses || []) {
    const vendor = e.vendor_shop_name || 'Unknown';
    grouped[vendor] = (grouped[vendor] || 0) + (Number(e.total_daily_expense) || 0);
  }
  return grouped;
}

export function groupExpensesByMember(expenses: Expense[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const e of expenses || []) {
    const member = e.spent_by || e.created_by_name || 'Unknown';
    grouped[member] = (grouped[member] || 0) + (Number(e.total_daily_expense) || 0);
  }
  return grouped;
}