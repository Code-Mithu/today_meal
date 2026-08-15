import { useCallback, useEffect, useState } from 'react';
import { useGroup } from '@/context/GroupContext';
import { MenuRepository } from '@/database/repositories/MenuRepository';
import type { DailyMenu } from '@/types';
import { generateClientOperationId, generateUUID } from '@/utils/validators';
import { getMonthString } from '@/utils/formatters';

export function useMenu(date?: string) {
  const { activeGroupId } = useGroup();
  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [archive, setArchive] = useState<DailyMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadMenu = useCallback(async () => {
    if (!activeGroupId || !date) { setMenu(null); setIsLoading(false); return; }
    setMenu(await MenuRepository.getByDate(activeGroupId, date)); setIsLoading(false);
  }, [activeGroupId, date]);
  const loadArchive = useCallback(async (startDate?: string, endDate?: string, limit?: number) => {
    if (!activeGroupId) { setArchive([]); return; }
    setArchive(await MenuRepository.getByGroupId(activeGroupId, { startDate, endDate, limit }));
  }, [activeGroupId]);
  useEffect(() => { loadMenu(); }, [loadMenu]);
  const saveMenu = useCallback(async (data: Partial<DailyMenu>, existingId?: string) => {
    if (!activeGroupId) return { success: false, error: 'No active group' };
    const existing = existingId ? await MenuRepository.getById(existingId) : null;
    const now = new Date().toISOString();
    const dailyMenu = { ...existing, ...data, id: existingId || generateUUID(), group_id: activeGroupId, date: data.date || now.slice(0, 10), month: data.month || getMonthString(), breakfast_items: data.breakfast_items || [], lunch_items: data.lunch_items || [], dinner_items: data.dinner_items || [], special_items: data.special_items || [], status: data.status || 'published', version: (existing?.version || 0) + 1, client_operation_id: generateClientOperationId(), created_date: existing?.created_date || now, updated_date: now } as DailyMenu;
    await MenuRepository.upsert(dailyMenu); setMenu(dailyMenu); return { success: true };
  }, [activeGroupId]);
  const deleteMenu = useCallback(async (id: string) => { await MenuRepository.softDelete(id); setMenu(null); return { success: true }; }, []);
  return { menu, archive, isLoading, saveMenu, deleteMenu, loadArchive, refresh: loadMenu };
}
