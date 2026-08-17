import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
import { execute } from '@/database/db';
import { apiFetch, apiMultipart } from '@/services/api';
import { getCloudHouseholdId } from '@/services/sync';

type Nav = NativeStackNavigationProp<MainStackParamList, 'ExpenseDetail'>;
type Route = RouteProp<MainStackParamList, 'ExpenseDetail'>;

export default function ExpenseDetailScreen() {
  const { activeGroup } = useGroup();
  const { deleteExpense } = useExpenses();
  const { canUpdate, canDelete, isAdmin } = usePermissions();
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

  async function captureReceipt() {
    if (!expense) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera permission required', 'Allow camera access to capture a receipt.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    await execute('UPDATE expenses SET receipt_uri = ?, updated_date = ? WHERE id = ?', [asset.uri, new Date().toISOString(), expense.id]);
    setExpense({ ...expense, receipt_uri: asset.uri });
    const householdId = await getCloudHouseholdId();
    if (!householdId) return;
    const form = new FormData();
    form.append('householdId', householdId);
    form.append('receipt', { uri: asset.uri, name: asset.fileName || `receipt-${expense.id}.jpg`, type: asset.mimeType || 'image/jpeg' } as never);
    try { await apiMultipart(`/api/expenses/${expense.id}/receipt`, form); }
    catch (error) { Alert.alert('Saved offline', error instanceof Error ? error.message : 'The receipt will remain on this device until you retry.'); }
  }

  async function review(decision: 'approve' | 'reject') {
    if (!expense) return;
    const householdId = await getCloudHouseholdId();
    if (!householdId) return Alert.alert('Connect first', 'Approval requires a server connection.');
    try {
      await apiFetch(`/api/expenses/${expense.id}/${decision}`, { method: 'POST', headers: { 'Idempotency-Key': `${Date.now()}-${decision}` }, body: JSON.stringify({ householdId, reason: decision === 'reject' ? 'Rejected by administrator' : undefined }) });
      const status = decision === 'approve' ? 'approved' : 'rejected';
      await execute('UPDATE expenses SET approval_status = ?, reviewed_at = ?, updated_date = ? WHERE id = ?', [status, new Date().toISOString(), new Date().toISOString(), expense.id]);
      setExpense({ ...expense, approval_status: status });
    } catch (error) { Alert.alert('Review failed', error instanceof Error ? error.message : 'Try again.'); }
  }

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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Approval and receipt</Text>
          <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={styles.value}>{expense.approval_status || 'approved'}</Text></View>
          {expense.rejection_reason && <Text style={styles.notesText}>{expense.rejection_reason}</Text>}
          {expense.receipt_uri && <Image source={{ uri: expense.receipt_uri }} style={styles.receipt} accessibilityLabel="Captured expense receipt" />}
          <TouchableOpacity style={styles.receiptButton} onPress={captureReceipt}><Text style={styles.receiptButtonText}>{expense.receipt_uri ? 'Replace receipt' : 'Capture receipt'}</Text></TouchableOpacity>
          {isAdmin() && expense.approval_status === 'pending' && <View style={styles.actionsRow}><TouchableOpacity style={styles.editButton} onPress={() => void review('approve')}><Text style={styles.editButtonText}>Approve</Text></TouchableOpacity><TouchableOpacity style={styles.deleteButton} onPress={() => void review('reject')}><Text style={styles.deleteButtonText}>Reject</Text></TouchableOpacity></View>}
        </View>

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
  receipt: { width: '100%', height: 220, borderRadius: 10, marginTop: 10, backgroundColor: COLORS.BACKGROUND },
  receiptButton: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: COLORS.PRIMARY_DARK, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  receiptButtonText: { color: COLORS.PRIMARY_DARK, fontSize: 15, fontWeight: '700' },
  loading: { fontSize: 16, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 40 },
});
