import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { AuditLogRepository } from '@/database/repositories/AuditLogRepository';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS } from '@/utils/constants';
import { formatRelativeTime } from '@/utils/formatters';
import { AuditLog } from '@/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function AuditLogScreen() {
  const { activeGroupId } = useGroup();
  const navigation = useNavigation<Nav>();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeGroupId) return;
    const data = await AuditLogRepository.getByGroupId(activeGroupId, 100);
    setLogs(data);
    setIsLoading(false);
  }, [activeGroupId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (isLoading) return <SafeAreaView style={styles.container}><LoadingState /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Audit Log</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text
                style={[
                  styles.actionBadge,
                  item.action === 'create'
                    ? styles.actionCreate
                    : item.action === 'update'
                      ? styles.actionUpdate
                      : styles.actionDelete,
                ]}
              >
                {item.action}
              </Text>
              <Text style={styles.time}>{formatRelativeTime(item.created_date)}</Text>
            </View>
            <Text style={styles.actor}>{item.actor_name || 'Unknown'}</Text>
            {item.entity_type && <Text style={styles.entity}>Entity: {item.entity_type}</Text>}
            {item.changed_fields && item.changed_fields.length > 0 && (
              <Text style={styles.changed}>Changed: {item.changed_fields.join(', ')}</Text>
            )}
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState message="No audit logs found." icon="📋" />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.CARD },
  backButton: { fontSize: 16, color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginLeft: 12 },
  list: { padding: 16, paddingTop: 8 },
  card: { backgroundColor: COLORS.CARD, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.BORDER },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  actionBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  actionCreate: { backgroundColor: COLORS.PRIMARY_LIGHT, color: COLORS.PRIMARY_DARK },
  actionUpdate: { backgroundColor: '#FFF3E0', color: COLORS.WARNING },
  actionDelete: { backgroundColor: '#FFEBEE', color: COLORS.DANGER },
  time: { fontSize: 12, color: COLORS.TEXT_MUTED },
  actor: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  entity: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 2 },
  changed: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 2 },
});
