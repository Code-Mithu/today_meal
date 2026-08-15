import { useCallback, useEffect, useState } from 'react';
import { useGroup } from '@/context/GroupContext';
import { ContributionRepository } from '@/database/repositories/ContributionRepository';
import type { Contribution } from '@/types';
import { generateClientOperationId, generateUUID } from '@/utils/validators';

export function useContributions(startDate?: string, endDate?: string) {
  const { activeGroupId } = useGroup();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const load = useCallback(async () => {
    if (!activeGroupId) { setContributions([]); setIsLoading(false); return; }
    setContributions(await ContributionRepository.getByGroupId(activeGroupId, { startDate, endDate }));
    setIsLoading(false);
  }, [activeGroupId, endDate, startDate]);
  useEffect(() => { load(); }, [load]);

  const createContribution = useCallback(async (data: Partial<Contribution>) => {
    if (!activeGroupId) return { success: false, error: 'No active group' };
    const now = new Date().toISOString();
    const contribution = { id: generateUUID(), group_id: activeGroupId, member_id: data.member_id, member_name: data.member_name || '', amount: data.amount || 0, date: data.date || now.slice(0, 10), payment_method: data.payment_method || 'cash', note: data.note, version: 1, client_operation_id: generateClientOperationId(), created_date: now, updated_date: now } as Contribution;
    await ContributionRepository.upsert(contribution); await load(); return { success: true };
  }, [activeGroupId, load]);

  const updateContribution = useCallback(async (id: string, data: Partial<Contribution>) => {
    const existing = await ContributionRepository.getById(id); if (!existing) return { success: false, error: 'Contribution not found' };
    await ContributionRepository.upsert({ ...existing, ...data, version: existing.version + 1, updated_date: new Date().toISOString() }); await load(); return { success: true };
  }, [load]);
  const deleteContribution = useCallback(async (id: string) => { await ContributionRepository.softDelete(id); await load(); return { success: true }; }, [load]);
  return { contributions, isLoading, createContribution, updateContribution, deleteContribution, refresh: load };
}
