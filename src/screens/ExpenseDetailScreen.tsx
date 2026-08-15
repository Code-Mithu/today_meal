import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { useExpenses } from '@/hooks/useExpenses';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';
import { COLORS } from '@/utils/constants';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { ExpenseRepository } from '@/database/repositories/ExpenseRepository';
import { Expense } from '@/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ExpenseDetail'>;
type Route = RouteProp<MainStackParamList, 'ExpenseDetail'>;

export default function ExpenseDetailScreen() {
  const { activeGroup } = useGroup();
  const { deleteExpense } = useExpenses();
  const { canUpdate, canDelete } = usePermissions();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    ExpenseRepository.getById(route.params.expenseId).then((e) => {
      setExpense(e);
      setIsLoading(false);
    });
  }, [route.params.expenseId]);

  async function handleDelete() {
    if (!expense) return;
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const result = await deleteExpense(expense.id);
        if (result.success) navigation.goBack();
      }},
    ]);
  }

  if (isLoading) return <SafeAreaView style={styles.container}><Text style={styles.loading}>Loading...</Text></SafeAreaView>;
  if (!expense) return <SafeAreaView style={styles.container}><Text style={styles.loading}>Expense not found</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Expense Detail</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDate(expense.date)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Spent By</Text>
            <Text style={styles.value}>{expense.spent_by || expense.created_by_name || '-'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Number of Meals</Text>
            <Text style={styles.value}>{expense.number_of_meals}</Text>
          </View>
          {expense.vendor_shop_name && (
            <View style={styles.row}>
              <Text style={styles.label}>Vendor</Text>
              <Text style={styles.value}>{expense.vendor_shop_name}</Text>
            </View>
          )}
        </View>

        {expense.food_expenses.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Food Expenses</Text>
            {expense.food_expenses.map((fe, i) => (
              <View key={i} style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle}>{fe.title}</Text>
                  {fe.category && <Text style={styles.lineCategory}>{fe.category}</Text>}
                </View>
                <Text style={styles.lineAmount}>{formatCurrency(fe.amount, activeGroup?.currency)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Food Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(expense.food_expense_amount, activeGroup?.currency)}</Text>
            </View>
          </View>
        )}

        {expense.other_expenses.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Other Expenses</Text>
            {expense.other_expenses.map((oe, i) => (
              <View key={i} style={styles.lineRow}>
                <Text style={[styles.lineTitle, { flex: 1 }]}>{oe.title}</Text>
                <Text style={styles.lineAmount}>{formatCurrency(oe.amount, activeGroup?.currency)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Other Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(expense.other_expense_amount, activeGroup?.currency)}</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total Daily Expense</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(expense.total_daily_expense, activeGroup?.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Cost Per Meal</Text>
            <Text style={styles.totalValue}>{formatCurrency(expense.cost_per_meal, activeGroup?.currency)}</Text>
          </View>
        </View>

        {expense.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{expense.notes}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          {canUpdate('expense') && (
            <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditExpense', { expenseId: expense.id })}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
          {canDelete('expense') && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.CARD },
  backButton: { fontSize: 16, color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginLeft: 12 },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.CARD, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.BORDER },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: COLORS.TEXT_MUTED },
  value: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 10 },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  lineTitle: { fontSize: 14, color: COLORS.TEXT, fontWeight: '500' },
  lineCategory: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },
  lineAmount: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  totalLabel: { fontSize: 14, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  totalValue: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  grandTotalLabel: { fontSize: 16, color: COLORS.TEXT, fontWeight: '700' },
  grandTotalValue: { fontSize: 18, fontWeight: '800', color: COLORS.PRIMARY_DARK },
  notesText: { fontSize: 14, color: COLORS.TEXT, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  editButton: { flex: 1, backgroundColor: COLORS.PRIMARY_DARK, borderRadius: 10, paddingVertical: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  editButtonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
  deleteButton: { flex: 1, backgroundColor: COLORS.DANGER, borderRadius: 10, paddingVertical: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  deleteButtonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
  loading: { fontSize: 16, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 40 },
});