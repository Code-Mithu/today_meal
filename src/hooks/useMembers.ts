import { useCallback, useEffect, useState } from 'react';
import { useGroup } from '@/context/GroupContext';
import { MemberRepository } from '@/database/repositories/MemberRepository';
import type { GroupRole, MealGroupMember } from '@/types';
import { generateUUID } from '@/utils/validators';

export function useMembers() {
  const { activeGroupId } = useGroup();
  const [members, setMembers] = useState<MealGroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const load = useCallback(async () => {
    if (!activeGroupId) { setMembers([]); setIsLoading(false); return; }
    setMembers(await MemberRepository.getByGroupId(activeGroupId)); setIsLoading(false);
  }, [activeGroupId]);
  useEffect(() => { load(); }, [load]);
  const manageMember = useCallback(async (params: { action: 'create' | 'update' | 'delete' | 'freeze' | 'unfreeze'; member_id?: string; member_name?: string; role?: GroupRole }) => {
    if (!activeGroupId) return { success: false, error: 'No active group' };
    if (params.action === 'delete' && params.member_id) await MemberRepository.softDelete(params.member_id);
    else if ((params.action === 'freeze' || params.action === 'unfreeze') && params.member_id) await MemberRepository.updateStatus(params.member_id, params.action === 'freeze' ? 'frozen' : 'active', 'local-owner');
    else {
      const existing = params.member_id ? await MemberRepository.getById(params.member_id) : null;
      const now = new Date().toISOString();
      await MemberRepository.upsert({ ...existing, id: params.member_id || generateUUID(), group_id: activeGroupId, user_id: existing?.user_id, member_name: params.member_name || existing?.member_name || 'Member', role: params.role || existing?.role || 'member', permissions: existing?.permissions || {}, start_date: existing?.start_date || now.slice(0, 10), active: true, status: existing?.status || 'active', version: (existing?.version || 0) + 1, created_date: existing?.created_date || now, updated_date: now });
    }
    await load(); return { success: true };
  }, [activeGroupId, load]);
  return { members, isLoading, manageMember, refresh: load };
}
