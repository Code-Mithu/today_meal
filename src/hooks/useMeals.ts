import { useCallback, useEffect, useState } from 'react';
import { useGroup } from '@/context/GroupContext';
import { MealRepository } from '@/database/repositories/MealRepository';
import type { DailyMeal } from '@/types';
import { generateClientOperationId, generateUUID } from '@/utils/validators';
import { calculateMealTotal } from '@/utils/calculations';

export function useMeals(date?: string, startDate?: string, endDate?: string) {
  const { activeGroupId } = useGroup();
  const [meals, setMeals] = useState<DailyMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const load = useCallback(async () => {
    if (!activeGroupId) { setMeals([]); setIsLoading(false); return; }
    setMeals(await MealRepository.getByGroupId(activeGroupId, { date, startDate, endDate }));
    setIsLoading(false);
  }, [activeGroupId, date, endDate, startDate]);
  useEffect(() => { load(); }, [load]);

  const saveMeal = useCallback(async (data: Partial<DailyMeal>, existingId?: string) => {
    if (!activeGroupId) return { success: false, error: 'No active group' };
    const existing = existingId ? await MealRepository.getById(existingId) : null;
    const now = new Date().toISOString();
    const meal = { ...existing, ...data, id: existingId || generateUUID(), group_id: activeGroupId, member_id: data.member_id || existing?.member_id || '', member_name: data.member_name || existing?.member_name || '', date: data.date || existing?.date || now.slice(0, 10), breakfast: data.breakfast || 0, lunch: data.lunch || 0, dinner: data.dinner || 0, extra: data.extra || 0, total: calculateMealTotal(data), version: (existing?.version || 0) + 1, client_operation_id: generateClientOperationId(), created_date: existing?.created_date || now, updated_date: now } as DailyMeal;
    await MealRepository.upsert(meal);
    await load();
    return { success: true };
  }, [activeGroupId, load]);

  const deleteMeal = useCallback(async (id: string) => { await MealRepository.softDelete(id); await load(); return { success: true }; }, [load]);
  return { meals, isLoading, saveMeal, deleteMeal, refresh: load };
}
