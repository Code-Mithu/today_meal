import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSync } from '@/context/SyncContext';
import { COLORS } from '@/utils/constants';

const labels = {
  offline: 'Offline · changes stay on this device',
  idle: 'Synced · available on your devices',
  syncing: 'Syncing household changes…',
  error: 'Sync paused · tap to retry',
} as const;

export function SyncStatusBar() {
  const { state, pending, syncNow } = useSync();
  return <Pressable onPress={syncNow} accessibilityRole="button" accessibilityLabel={`${labels[state]}. ${pending} changes pending.`}>
    <View style={[styles.bar, state === 'error' ? styles.warning : undefined]}>
      <View style={[styles.dot, state === 'offline' ? styles.offline : undefined]} />
      <Text style={styles.text}>{labels[state]}{pending ? ` · ${pending} pending` : ''}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({ bar: { minHeight: 32, backgroundColor: COLORS.PRIMARY_LIGHT, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }, warning: { borderBottomWidth: 1, borderBottomColor: COLORS.WARNING }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.SUCCESS }, offline: { backgroundColor: COLORS.TEXT_MUTED }, text: { color: COLORS.PRIMARY_DARK, fontSize: 12, fontWeight: '600' } });
