import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { MenuRepository } from '@/database/repositories/MenuRepository';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import { DailyMenu } from '@/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function MenuArchiveScreen() {
  const { activeGroupId } = useGroup();
  const navigation = useNavigation<Nav>();
  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeGroupId) return;
    const data = await MenuRepository.getByGroupId(activeGroupId, { limit: 100 });
    setMenus(data);
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
        <Text style={styles.title}>Menu Archive</Text>
      </View>

      <FlatList
        data={menus}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DailyMenu', { date: item.date })}>
            <Text style={styles.cardDate}>{formatDate(item.date, 'MMM d, yyyy')}</Text>
            <Text style={styles.cardItems}>
              {item.breakfast_items.length > 0 && `🍳 ${item.breakfast_items.length} `}
              {item.lunch_items.length > 0 && `🍽️ ${item.lunch_items.length} `}
              {item.dinner_items.length > 0 && `🌙 ${item.dinner_items.length} `}
              {item.special_items.length > 0 && `⭐ ${item.special_items.length}`}
            </Text>
            <View style={styles.statusRow}>
              <Text style={[styles.statusBadge, item.status === 'published' ? styles.publishedBadge : styles.draftBadge]}>
                {item.status}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState message="No menus in archive." icon="📋" />}
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
  card: { backgroundColor: COLORS.CARD, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.BORDER },
  cardDate: { fontSize: 16, fontWeight: '600', color: COLORS.TEXT },
  cardItems: { fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 6 },
  statusRow: { flexDirection: 'row', marginTop: 8 },
  statusBadge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  publishedBadge: { backgroundColor: COLORS.PRIMARY_LIGHT, color: COLORS.PRIMARY_DARK },
  draftBadge: { backgroundColor: COLORS.BACKGROUND, color: COLORS.TEXT_MUTED },
});