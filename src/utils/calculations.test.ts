import { describe, expect, it } from 'vitest';
import type { Contribution, DailyMeal, Expense } from '@/types';
import {
  calculateCostPerMeal,
  calculateMealRate,
  calculateMealTotal,
  calculateMemberBalance,
  calculateMemberMealCost,
  calculateTotalExpense,
  groupExpensesByCategory,
  groupExpensesByVendor,
  round,
  sumContributions,
  sumExpenses,
  sumMeals,
} from './calculations';

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: overrides.id ?? 'expense-1',
    group_id: 'group-1',
    month: '2026-08',
    date: '2026-08-17',
    total_daily_expense: 0,
    ...overrides,
  } as Expense;
}

describe('expense totals', () => {
  it('adds itemised food and other costs', () => {
    const total = calculateTotalExpense({
      food_expenses: [{ title: 'Rice', amount: 320.5 }, { title: 'Fish', amount: 610.25 }],
      other_expenses: [{ title: 'Gas', amount: 69.25 }],
      food_expense_amount: undefined,
      other_expense_amount: undefined,
    } as Partial<Expense>);
    expect(total).toBe(1000);
  });

  it('treats missing or malformed item amounts as zero', () => {
    const total = calculateTotalExpense({
      food_expenses: [{ title: 'Rice', amount: Number.NaN }, { title: 'Oil' }] as never,
      other_expenses: [],
      food_expense_amount: undefined,
      other_expense_amount: undefined,
    } as Partial<Expense>);
    expect(total).toBe(0);
  });

  it('never divides by a zero or negative meal count', () => {
    expect(calculateCostPerMeal(900, 0)).toBe(0);
    expect(calculateCostPerMeal(900, -4)).toBe(0);
    expect(calculateCostPerMeal(900, 8)).toBe(112.5);
  });
});

describe('monthly settlement', () => {
  const meals: DailyMeal[] = [
    { id: 'm1', group_id: 'g', member_id: 'alice', member_name: 'Alice', date: '2026-08-01', breakfast: 1, lunch: 1, dinner: 1, extra: 0, total: 3 },
    { id: 'm2', group_id: 'g', member_id: 'bob', member_name: 'Bob', date: '2026-08-01', breakfast: 0, lunch: 1, dinner: 1, extra: 1, total: 3 },
    { id: 'm3', group_id: 'g', member_id: 'alice', member_name: 'Alice', date: '2026-08-02', breakfast: 1, lunch: 1, dinner: 0, extra: 0, total: 2 },
  ] as DailyMeal[];

  it('totals meal counts from their components', () => {
    expect(calculateMealTotal({ breakfast: 1, lunch: 1, dinner: 1, extra: 2 })).toBe(5);
    expect(calculateMealTotal({})).toBe(0);
    expect(sumMeals(meals)).toBe(8);
  });

  it('splits spend into a meal rate and per-member balances', () => {
    const expenses = [expense({ total_daily_expense: 1200 }), expense({ id: 'expense-2', total_daily_expense: 800 })];
    const contributions = [
      { id: 'c1', group_id: 'g', member_name: 'Alice', amount: 1500, date: '2026-08-03' },
      { id: 'c2', group_id: 'g', member_name: 'Bob', amount: 300, date: '2026-08-04' },
    ] as Contribution[];

    const rate = calculateMealRate(sumExpenses(expenses), sumMeals(meals));
    expect(rate).toBe(250);
    expect(sumContributions(contributions)).toBe(1800);

    const aliceCost = calculateMemberMealCost(5, rate);
    const bobCost = calculateMemberMealCost(3, rate);
    expect(calculateMemberBalance(1500, aliceCost)).toBe(250);
    expect(calculateMemberBalance(300, bobCost)).toBe(-450);
    // Credits and dues must net to contributions minus spend.
    expect(round(250 + -450)).toBe(round(1800 - 2000));
  });

  it('returns a zero rate when no meals were eaten', () => {
    expect(calculateMealRate(5000, 0)).toBe(0);
    expect(calculateMemberMealCost(0, 0)).toBe(0);
  });
});

describe('multi-currency normalisation', () => {
  it('converts foreign spend with the stored rate before reporting', () => {
    const rows = [
      { total_daily_expense: 100, currency: 'USD', exchange_rate: 110 },
      { total_daily_expense: 2000, currency: 'BDT', exchange_rate: 1 },
    ];
    const normalized = rows.map((row) => round(row.total_daily_expense * (row.exchange_rate || 1)));
    expect(normalized).toEqual([11000, 2000]);
    expect(round(normalized.reduce((sum, value) => sum + value, 0))).toBe(13000);
  });

  it('rounds half-cent values without floating point drift', () => {
    expect(round(0.1 + 0.2)).toBe(0.3);
    expect(round(1.005)).toBe(1.01);
    expect(round(1234.5678, 3)).toBe(1234.568);
  });
});

describe('report groupings', () => {
  const expenses = [
    expense({ total_daily_expense: 500, vendor_shop_name: 'Corner Shop', food_expenses: [{ title: 'Rice', amount: 300, category: 'Grains' }, { title: 'Fish', amount: 200, category: 'Protein' }] as never }),
    expense({ id: 'expense-2', total_daily_expense: 250, food_expenses: [{ title: 'Onion', amount: 250 }] as never }),
  ];

  it('buckets category spend and defaults blank labels', () => {
    expect(groupExpensesByCategory(expenses)).toEqual({ Grains: 300, Protein: 200, Uncategorized: 250 });
  });

  it('buckets vendor spend and defaults an unknown vendor', () => {
    expect(groupExpensesByVendor(expenses)).toEqual({ 'Corner Shop': 500, Unknown: 250 });
  });
});
