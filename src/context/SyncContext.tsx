import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getCloudHouseholdId, getSyncSnapshot, synchronize } from '@/services/sync';
import { getRealtimeUrl } from '@/services/api';
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

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const connect = async () => {
      const householdId = await getCloudHouseholdId();
      if (!householdId || stopped) return;
      try {
        socket = new WebSocket(await getRealtimeUrl(householdId));
        socket.onmessage = (event) => {
          try { if (JSON.parse(String(event.data)).type === 'data.changed') void syncNow(); } catch { /* Ignore malformed advisory events. */ }
        };
        socket.onclose = () => { if (!stopped) retry = setTimeout(connect, 5000); };
      } catch { if (!stopped) retry = setTimeout(connect, 5000); }
    };
    void connect();
    return () => { stopped = true; if (retry) clearTimeout(retry); socket?.close(); };
  }, [activeGroupId, syncNow]);

  const value = useMemo(() => ({ state, pending, lastSyncAt, syncNow }), [state, pending, lastSyncAt, syncNow]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used within SyncProvider');
  return value;
}
