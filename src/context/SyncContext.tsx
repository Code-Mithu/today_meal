import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getSyncSnapshot, synchronize } from '@/services/sync';
import { useGroup } from './GroupContext';

type SyncState = 'offline' | 'idle' | 'syncing' | 'error';
type SyncContextValue = { state: SyncState; pending: number; lastSyncAt: string | null; syncNow(): Promise<void> };
const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { activeGroup, activeGroupId, refreshGroups } = useGroup();
  const [state, setState] = useState<SyncState>('idle');
  const [pending, setPending] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const syncNow = useCallback(async () => {
    if (!activeGroupId || !activeGroup) return;
    const network = await NetInfo.fetch();
    if (!network.isConnected) { setState('offline'); return; }
    setState('syncing');
    try {
      const result = await synchronize(activeGroupId, activeGroup.name);
      const snapshot = await getSyncSnapshot();
      setPending(snapshot.pending); setLastSyncAt(snapshot.lastSyncAt);
      setState('idle');
      await refreshGroups();
    } catch { setState('error'); }
  }, [activeGroup, activeGroupId, refreshGroups]);

  useEffect(() => {
    void getSyncSnapshot().then((snapshot) => { setPending(snapshot.pending); setLastSyncAt(snapshot.lastSyncAt); });
    const unsubscribeNetwork = NetInfo.addEventListener((network) => {
      if (!network.isConnected) setState('offline');
      else void syncNow();
    });
    const appState = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void syncNow();
    });
    return () => { unsubscribeNetwork(); appState.remove(); };
  }, [syncNow]);

  const value = useMemo(() => ({ state, pending, lastSyncAt, syncNow }), [state, pending, lastSyncAt, syncNow]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used within SyncProvider');
  return value;
}
