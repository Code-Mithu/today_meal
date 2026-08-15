import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GroupRepository } from '@/database/repositories/GroupRepository';
import { MemberRepository } from '@/database/repositories/MemberRepository';
import { seedOfflineData, LOCAL_GROUP_ID, LOCAL_MEMBER_ID } from '@/database/seed';
import type { MealGroup, MealGroupMember, PermissionContext } from '@/types';

interface GroupContextType {
  groups: MealGroup[];
  activeGroup: MealGroup | null;
  activeGroupId: string | null;
  activeMember: MealGroupMember | null;
  permissionContext: PermissionContext | null;
  isLoading: boolean;
  setActiveGroupId: (id: string) => void;
  refreshGroups: () => Promise<void>;
  refreshActiveGroup: () => Promise<void>;
}

const GroupContext = createContext<GroupContextType | null>(null);

export function GroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<MealGroup[]>([]);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(LOCAL_GROUP_ID);
  const [activeMember, setActiveMember] = useState<MealGroupMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    await seedOfflineData();
    const localGroups = await GroupRepository.getAll();
    const selected = localGroups.find((group) => group.id === activeGroupId) || localGroups[0] || null;
    setGroups(localGroups);
    setActiveGroupIdState(selected?.id || null);
    setActiveMember(selected ? await MemberRepository.getById(LOCAL_MEMBER_ID) : null);
    setIsLoading(false);
  }, [activeGroupId]);

  useEffect(() => { load(); }, [load]);

  const activeGroup = groups.find((group) => group.id === activeGroupId) || null;
  const permissionContext = useMemo<PermissionContext | null>(() => activeMember && activeGroupId ? ({
    groupId: activeGroupId,
    userId: 'local-owner',
    role: activeMember.role,
    status: activeMember.status,
    permissions: activeMember.permissions || {},
  }) : null, [activeGroupId, activeMember]);

  return (
    <GroupContext.Provider value={{
      groups,
      activeGroup,
      activeGroupId,
      activeMember,
      permissionContext,
      isLoading,
      setActiveGroupId: setActiveGroupIdState,
      refreshGroups: load,
      refreshActiveGroup: load,
    }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup(): GroupContextType {
  const context = useContext(GroupContext);
  if (!context) throw new Error('useGroup must be used within GroupProvider');
  return context;
}
