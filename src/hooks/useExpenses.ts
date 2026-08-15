import { useCallback, useEffect, useState } from 'react';
import { useGroup } from '@/context/GroupContext';
import { ExpenseRepository } from '@/database/repositories/ExpenseRepository';
import type { Expense } from '@/types';
import { generateClientOperationId, generateUUID } from '@/utils/validators';
import { calculateTotalExpense, calculateCostPerMeal, sumFoodExpenses, sumOtherExpenses } from '@/utils/calculations';
import { getMonthString } from '@/utils/formatters';

export function useExpenses(month?: string) {
  const { activeGroupId } = useGroup();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadExpenses = useCallback(async () => {
    if (!activeGroupId) { setExpenses([]); setIsLoading(false); return; }
    setExpenses(await ExpenseRepository.getByGroupId(activeGroupId, { month }));
    setIsLoading(false);
  }, [activeGroupId, month]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const createExpense = useCallback(async (data: Partial<Expense>) => {
    if (!activeGroupId) return { success: false, error: 'No active group' };
    const now = new Date().toISOString();
    const foodAmount = data.food_expense_amount ?? sumFoodExpenses(data.food_expenses || []);
    const otherAmount = data.other_expense_amount ?? sumOtherExpenses(data.other_expenses || []);
    const total = calculateTotalExpense({ ...data, food_expense_amount: foodAmount, other_expense_amount: otherAmount });
    const meals = data.number_of_meals || 0;
    const expense = {
      id: generateUUID(), group_id: activeGroupId, month: data.month || getMonthString(),
      date: data.date || now.slice(0, 10), spent_by: data.spent_by,
      number_of_meals: meals, food_expenses: data.food_expenses || [],
      food_expense_title: data.food_expense_title, category: data.category,
      food_expense_amount: foodAmount, vendor_shop_name: data.vendor_shop_name,
      notes: data.notes, other_expenses: data.other_expenses || [],
      other_expense_title: data.other_expense_title, other_expense_amount: otherAmount,
      total_daily_expense: total, cost_per_meal: calculateCostPerMeal(total, meals),
      version: 1, client_operation_id: generateClientOperationId(), created_date: now, updated_date: now,
    } as Expense;
    await ExpenseRepository.upsert(expense);
    setExpenses((previous) => [expense, ...previous]);
    return { success: true };
  }, [activeGroupId]);

  const updateExpense = useCallback(async (id: string, data: Partial<Expense>) => {
    const existing = await ExpenseRepository.getById(id);
    if (!existing) return { success: false, error: 'Expense not found' };
    const foodAmount = data.food_expense_amount ?? sumFoodExpenses(data.food_expenses || existing.food_expenses);
    const otherAmount = data.other_expense_amount ?? sumOtherExpenses(data.other_expenses || existing.other_expenses);
    const total = calculateTotalExpense({ ...existing, ...data, food_expense_amount: foodAmount, other_expense_amount: otherAmount });
    const meals = data.number_of_meals ?? existing.number_of_meals;
    const updated = { ...existing, ...data, food_expense_amount: foodAmount, other_expense_amount: otherAmount, total_daily_expense: total, cost_per_meal: calculateCostPerMeal(total, meals), version: existing.version + 1, updated_date: new Date().toISOString() };
    await ExpenseRepository.upsert(updated);
    setExpenses((previous) => previous.map((expense) => expense.id === id ? updated : expense));
    return { success: true };
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    await ExpenseRepository.softDelete(id);
    setExpenses((previous) => previous.filter((expense) => expense.id !== id));
    return { success: true };
  }, []);

  return { expenses, isLoading, createExpense, updateExpense, deleteExpense, refresh: loadExpenses };
}
