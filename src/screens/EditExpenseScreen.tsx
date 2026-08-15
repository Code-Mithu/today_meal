import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { useExpenses } from '@/hooks/useExpenses';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';
import { COLORS } from '@/utils/constants';
import { ExpenseRepository } from '@/database/repositories/ExpenseRepository';
import { Expense, FoodExpenseItem, OtherExpenseItem } from '@/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'EditExpense'>;
type Route = RouteProp<MainStackParamList, 'EditExpense'>;

export default function EditExpenseScreen() {
  const { activeGroup } = useGroup();
  const { updateExpense } = useExpenses();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const expenseId = route.params.expenseId;
  const [expense, setExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [foodExpenses, setFoodExpenses] = useState<FoodExpenseItem[]>([]);
  const [otherExpenses, setOtherExpenses] = useState<OtherExpenseItem[]>([]);

  useEffect(() => {
    ExpenseRepository.getById(expenseId).then((e) => {
      setExpense(e);
      setFoodExpenses(e?.food_expenses || []);
      setOtherExpenses(e?.other_expenses || []);
      setIsLoading(false);
    });
  }, [expenseId]);

  function updateFoodExpense(index: number, field: keyof FoodExpenseItem, value: string) {
    const updated = [...foodExpenses];
    updated[index] = { ...updated[index], [field]: field === 'amount' ? parseFloat(value) || 0 : value };
    setFoodExpenses(updated);
  }

  function updateOtherExpense(index: number, field: keyof OtherExpenseItem, value: string) {
    const updated = [...otherExpenses];
    updated[index] = { ...updated[index], [field]: field === 'amount' ? parseFloat(value) || 0 : value };
    setOtherExpenses(updated);
  }

  async function handleSave() {
    if (!expense) return;
    setSaving(true);
    const result = await updateExpense(expenseId, {
      ...expense,
      food_expenses: foodExpenses.filter((f) => f.title.trim()),
      other_expenses: otherExpenses.filter((o) => o.title.trim()),
    });
    setSaving(false);
    if (result.success) navigation.goBack();
    else Alert.alert('Error', result.error || 'Failed to update');
  }

  if (isLoading) return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={COLORS.PRIMARY_DARK} style={styles.centered} /></SafeAreaView>;
  if (!expense) return <SafeAreaView style={styles.container}><Text style={styles.notFound}>Expense not found</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Expense</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TextInput style={styles.input} placeholder="Date" value={expense.date} onChangeText={(v) => setExpense({ ...expense, date: v })} />
        <TextInput style={styles.input} placeholder="Spent by" value={expense.spent_by || ''} onChangeText={(v) => setExpense({ ...expense, spent_by: v })} />
        <TextInput style={styles.input} placeholder="Number of meals" value={String(expense.number_of_meals)} onChangeText={(v) => setExpense({ ...expense, number_of_meals: parseInt(v) || 0 })} keyboardType="number-pad" />
        <TextInput style={styles.input} placeholder="Vendor" value={expense.vendor_shop_name || ''} onChangeText={(v) => setExpense({ ...expense, vendor_shop_name: v })} />

        <Text style={styles.sectionTitle}>Food Expenses</Text>
        {foodExpenses.map((fe, i) => (
          <View key={i} style={styles.lineItem}>
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Title" value={fe.title} onChangeText={(v) => updateFoodExpense(i, 'title', v)} />
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Category" value={fe.category} onChangeText={(v) => updateFoodExpense(i, 'category', v)} />
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Amount" value={String(fe.amount || '')} onChangeText={(v) => updateFoodExpense(i, 'amount', v)} keyboardType="number-pad" />
          </View>
        ))}

        <Text style={styles.sectionTitle}>Other Expenses</Text>
        {otherExpenses.map((oe, i) => (
          <View key={i} style={styles.lineItem}>
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Title" value={oe.title} onChangeText={(v) => updateOtherExpense(i, 'title', v)} />
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Amount" value={String(oe.amount || '')} onChangeText={(v) => updateOtherExpense(i, 'amount', v)} keyboardType="number-pad" />
          </View>
        ))}

        <TextInput style={[styles.input, styles.notesInput]} placeholder="Notes" value={expense.notes || ''} onChangeText={(v) => setExpense({ ...expense, notes: v })} multiline />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.WHITE} /> : <Text style={styles.saveButtonText}>Update Expense</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  centered: { marginTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.CARD },
  backButton: { fontSize: 16, color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginLeft: 12 },
  content: { padding: 16, paddingBottom: 40 },
  input: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10, backgroundColor: COLORS.CARD, color: COLORS.TEXT, minHeight: 46 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT, marginTop: 16, marginBottom: 8 },
  lineItem: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  lineInput: { flex: 1, minHeight: 44 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: { backgroundColor: COLORS.PRIMARY_DARK, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20, minHeight: 50, justifyContent: 'center' },
  saveButtonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
  notFound: { fontSize: 16, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 40 },
});