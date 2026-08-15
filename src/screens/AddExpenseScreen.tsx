import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { useExpenses } from '@/hooks/useExpenses';
import { useMembers } from '@/hooks/useMembers';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';
import { COLORS } from '@/utils/constants';
import { getTodayString, getMonthString } from '@/utils/formatters';
import { FoodExpenseItem, OtherExpenseItem } from '@/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function AddExpenseScreen() {
  const { activeGroup, activeMember } = useGroup();
  const { createExpense } = useExpenses();
  const { members } = useMembers();
  const navigation = useNavigation<Nav>();
  const [date, setDate] = useState(getTodayString());
  const [spentBy, setSpentBy] = useState(activeMember?.member_name || '');
  const [numberOfMeals, setNumberOfMeals] = useState('0');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [foodExpenses, setFoodExpenses] = useState<FoodExpenseItem[]>([{ title: '', category: '', amount: 0 }]);
  const [otherExpenses, setOtherExpenses] = useState<OtherExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  function updateFoodExpense(index: number, field: keyof FoodExpenseItem, value: string) {
    const updated = [...foodExpenses];
    updated[index] = { ...updated[index], [field]: field === 'amount' ? parseFloat(value) || 0 : value };
    setFoodExpenses(updated);
  }

  function addFoodExpense() {
    setFoodExpenses([...foodExpenses, { title: '', category: '', amount: 0 }]);
  }

  function removeFoodExpense(index: number) {
    setFoodExpenses(foodExpenses.filter((_, i) => i !== index));
  }

  function updateOtherExpense(index: number, field: keyof OtherExpenseItem, value: string) {
    const updated = [...otherExpenses];
    updated[index] = { ...updated[index], [field]: field === 'amount' ? parseFloat(value) || 0 : value };
    setOtherExpenses(updated);
  }

  function addOtherExpense() {
    setOtherExpenses([...otherExpenses, { title: '', amount: 0 }]);
  }

  function removeOtherExpense(index: number) {
    setOtherExpenses(otherExpenses.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!spentBy.trim()) { Alert.alert('Error', 'Please enter who spent this expense.'); return; }

    setIsLoading(true);
    const validFood = foodExpenses.filter((f) => f.title.trim() && f.amount > 0);
    const validOther = otherExpenses.filter((o) => o.title.trim() && o.amount > 0);

    const result = await createExpense({
      date,
      month: getMonthString(),
      spent_by: spentBy,
      number_of_meals: parseInt(numberOfMeals) || 0,
      vendor_shop_name: vendor.trim() || undefined,
      notes: notes.trim() || undefined,
      food_expenses: validFood,
      other_expenses: validOther,
    });

    setIsLoading(false);

    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', result.error || 'Failed to save expense');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add Expense</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
        <TextInput style={styles.input} placeholder="Spent by" value={spentBy} onChangeText={setSpentBy} />
        <TextInput style={styles.input} placeholder="Number of meals" value={numberOfMeals} onChangeText={setNumberOfMeals} keyboardType="number-pad" />
        <TextInput style={styles.input} placeholder="Vendor (optional)" value={vendor} onChangeText={setVendor} />

        {/* Food Expenses */}
        <Text style={styles.sectionTitle}>Food Expenses</Text>
        {foodExpenses.map((fe, i) => (
          <View key={i} style={styles.lineItem}>
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Title" value={fe.title} onChangeText={(v) => updateFoodExpense(i, 'title', v)} />
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Category" value={fe.category} onChangeText={(v) => updateFoodExpense(i, 'category', v)} />
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Amount" value={String(fe.amount || '')} onChangeText={(v) => updateFoodExpense(i, 'amount', v)} keyboardType="number-pad" />
            {foodExpenses.length > 1 && (
              <TouchableOpacity onPress={() => removeFoodExpense(i)} style={styles.removeButton}>
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={addFoodExpense}>
          <Text style={styles.addButtonText}>+ Add Food Expense</Text>
        </TouchableOpacity>

        {/* Other Expenses */}
        <Text style={styles.sectionTitle}>Other Expenses</Text>
        {otherExpenses.map((oe, i) => (
          <View key={i} style={styles.lineItem}>
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Title" value={oe.title} onChangeText={(v) => updateOtherExpense(i, 'title', v)} />
            <TextInput style={[styles.input, styles.lineInput]} placeholder="Amount" value={String(oe.amount || '')} onChangeText={(v) => updateOtherExpense(i, 'amount', v)} keyboardType="number-pad" />
            <TouchableOpacity onPress={() => removeOtherExpense(i)} style={styles.removeButton}>
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={addOtherExpense}>
          <Text style={styles.addButtonText}>+ Add Other Expense</Text>
        </TouchableOpacity>

        <TextInput style={[styles.input, styles.notesInput]} placeholder="Notes (optional)" value={notes} onChangeText={setNotes} multiline />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={COLORS.WHITE} /> : <Text style={styles.saveButtonText}>Save Expense</Text>}
        </TouchableOpacity>
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
  input: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10, backgroundColor: COLORS.CARD, color: COLORS.TEXT, minHeight: 46 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT, marginTop: 16, marginBottom: 8 },
  lineItem: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  lineInput: { flex: 1, marginBottom: 0, minHeight: 44 },
  removeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.DANGER, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
  addButton: { borderWidth: 1, borderColor: COLORS.PRIMARY_DARK, borderStyle: 'dashed', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 10 },
  addButtonText: { color: COLORS.PRIMARY_DARK, fontSize: 14, fontWeight: '600' },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: { backgroundColor: COLORS.PRIMARY_DARK, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20, minHeight: 50, justifyContent: 'center' },
  saveButtonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
});