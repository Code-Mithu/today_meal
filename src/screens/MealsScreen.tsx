import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { useMeals } from '@/hooks/useMeals';
import { useMembers } from '@/hooks/useMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { Avatar } from '@/components/common/Avatar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS, MEAL_TYPES, MEAL_LABELS } from '@/utils/constants';
import { getTodayString, formatDate } from '@/utils/formatters';
import { calculateMealTotal, sumMeals } from '@/utils/calculations';
import { DailyMeal } from '@/types';

export default function MealsScreen() {
  const { activeGroup } = useGroup();
  const { canCreate, canUpdate } = usePermissions();
  const { members } = useMembers();
  const [date, setDate] = useState(getTodayString());
  const { meals, isLoading, saveMeal, refresh } = useMeals(date);
  const [refreshing, setRefreshing] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ breakfast: 0, lunch: 0, dinner: 0, extra: 0 });

  const totalMeals = sumMeals(meals);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  function startEdit(meal: DailyMeal | undefined, memberId: string, memberName: string) {
    setEditingMember(memberId);
    setEditValues({
      breakfast: meal?.breakfast || 0,
      lunch: meal?.lunch || 0,
      dinner: meal?.dinner || 0,
      extra: meal?.extra || 0,
    });
  }

  async function saveEdit(memberId: string, memberName: string) {
    const existing = meals.find((m) => m.member_id === memberId);
    await saveMeal({
      member_id: memberId,
      member_name: memberName,
      date,
      ...editValues,
      total: calculateMealTotal(editValues),
    }, existing?.id);
    setEditingMember(null);
  }

  if (isLoading) return <SafeAreaView style={styles.container}><LoadingState /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar />
      <View style={styles.header}>
        <Text style={styles.title}>Meals</Text>
        <Text style={styles.subtitle}>{activeGroup?.name}</Text>
      </View>

      <View style={styles.dateRow}>
        <TextInput style={styles.dateInput} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{totalMeals}</Text>
        </View>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const meal = meals.find((m) => m.member_id === item.id);
          const isEditing = editingMember === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Avatar name={item.member_name} size={36} />
                <Text style={styles.cardName}>{item.member_name}</Text>
                {!isEditing && (canCreate('meal') || canUpdate('meal')) && (
                  <TouchableOpacity style={styles.editButton} onPress={() => startEdit(meal, item.id, item.member_name)}>
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isEditing ? (
                <View style={styles.editRow}>
                  {MEAL_TYPES.map((mt) => (
                    <View key={mt} style={styles.mealEditItem}>
                      <Text style={styles.mealEditLabel}>{MEAL_LABELS[mt]}</Text>
                      <TextInput
                        style={styles.mealEditInput}
                        value={String(editValues[mt])}
                        onChangeText={(v) => setEditValues({ ...editValues, [mt]: parseInt(v) || 0 })}
                        keyboardType="number-pad"
                      />
                    </View>
                  ))}
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={() => setEditingMember(null)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveButton} onPress={() => saveEdit(item.id, item.member_name)}>
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.mealRow}>
                  {MEAL_TYPES.map((mt) => (
                    <View key={mt} style={styles.mealItem}>
                      <Text style={styles.mealLabel}>{MEAL_LABELS[mt]}</Text>
                      <Text style={styles.mealValue}>{meal?.[mt] || 0}</Text>
                    </View>
                  ))}
                  <View style={styles.mealTotalItem}>
                    <Text style={styles.mealTotalLabel}>Total</Text>
                    <Text style={styles.mealTotalValue}>{meal?.total || 0}</Text>
                  </View>
                </View>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState message="No members found." icon="🍽️" />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT },
  subtitle: { fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 10 },
  dateInput: { flex: 1, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: COLORS.CARD, color: COLORS.TEXT, minHeight: 44 },
  totalCard: { backgroundColor: COLORS.PRIMARY_LIGHT, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  totalLabel: { fontSize: 12, color: COLORS.TEXT_MUTED },
  totalValue: { fontSize: 18, fontWeight: '700', color: COLORS.PRIMARY_DARK },
  list: { padding: 16, paddingTop: 8 },
  card: { backgroundColor: COLORS.CARD, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.BORDER },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardName: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  editButton: { backgroundColor: COLORS.PRIMARY_LIGHT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editButtonText: { color: COLORS.PRIMARY_DARK, fontSize: 13, fontWeight: '600' },
  mealRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mealItem: { alignItems: 'center', flex: 1 },
  mealLabel: { fontSize: 11, color: COLORS.TEXT_MUTED, marginBottom: 2 },
  mealValue: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT },
  mealTotalItem: { alignItems: 'center', flex: 1, borderLeftWidth: 1, borderLeftColor: COLORS.BORDER },
  mealTotalLabel: { fontSize: 11, color: COLORS.PRIMARY_DARK, fontWeight: '600', marginBottom: 2 },
  mealTotalValue: { fontSize: 18, fontWeight: '800', color: COLORS.PRIMARY_DARK },
  editRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mealEditItem: { flex: 1, minWidth: '22%' },
  mealEditLabel: { fontSize: 12, color: COLORS.TEXT_MUTED, marginBottom: 4 },
  mealEditInput: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 16, fontWeight: '600', color: COLORS.TEXT, textAlign: 'center', minHeight: 44 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, width: '100%', marginTop: 8, alignItems: 'center' },
  cancelText: { color: COLORS.TEXT_MUTED, fontSize: 15, fontWeight: '500' },
  saveButton: { backgroundColor: COLORS.PRIMARY_DARK, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  saveButtonText: { color: COLORS.WHITE, fontSize: 14, fontWeight: '700' },
});