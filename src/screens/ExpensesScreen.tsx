import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { useExpenses } from '@/hooks/useExpenses';
import { usePermissions } from '@/hooks/usePermissions';
import { ExpenseCard } from '@/components/common/ExpenseCard';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS } from '@/utils/constants';
import { getMonthString } from '@/utils/formatters';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function ExpensesScreen() {
  const { activeGroup, activeGroupId } = useGroup();
  const { canCreate } = usePermissions();
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const month = getMonthString();
  const { expenses, isLoading, refresh } = useExpenses(month);

  const filtered = useMemo(() => {
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter((e) =>
      (e.spent_by || '').toLowerCase().includes(q) ||
      (e.vendor_shop_name || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      (e.notes || '').toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (isLoading) return <SafeAreaView style={styles.container}><LoadingState /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar />
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.subtitle}>{activeGroup?.name} • {month}</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search expenses..."
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExpenseCard
            expense={item}
            currency={activeGroup?.currency}
            onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState message="No expenses found for this month." icon="📊" />}
      />

      {canCreate('expense') && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddExpense')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT },
  subtitle: { fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 2 },
  searchInput: {
    marginHorizontal: 16, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    backgroundColor: COLORS.CARD, color: COLORS.TEXT, minHeight: 44,
  },
  list: { padding: 16, paddingTop: 8 },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.PRIMARY_DARK,
    justifyContent: 'center', alignItems: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  fabText: { color: COLORS.WHITE, fontSize: 28, fontWeight: '300' },
});
