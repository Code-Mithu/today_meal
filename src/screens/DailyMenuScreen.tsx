import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { useMenu } from '@/hooks/useMenu';
import { usePermissions } from '@/hooks/usePermissions';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';
import { COLORS } from '@/utils/constants';
import { getTodayString, formatDate, getMonthString } from '@/utils/formatters';
import { MenuItem } from '@/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'DailyMenu'>;
type Route = RouteProp<MainStackParamList, 'DailyMenu'>;

export default function DailyMenuScreen() {
  const { activeGroupId } = useGroup();
  const { canCreate, canUpdate } = usePermissions();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const date = route.params?.date || getTodayString();
  const { menu, isLoading, saveMenu } = useMenu(date);
  const [breakfast, setBreakfast] = useState<MenuItem[]>([]);
  const [lunch, setLunch] = useState<MenuItem[]>([]);
  const [dinner, setDinner] = useState<MenuItem[]>([]);
  const [special, setSpecial] = useState<MenuItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBreakfast(menu?.breakfast_items || []);
    setLunch(menu?.lunch_items || []);
    setDinner(menu?.dinner_items || []);
    setSpecial(menu?.special_items || []);
  }, [menu]);

  function addItem(setter: React.Dispatch<React.SetStateAction<MenuItem[]>>) {
    setter((prev) => [...prev, { name: '', description: '', quantity: '', note: '' }]);
  }

  function updateItem(setter: React.Dispatch<React.SetStateAction<MenuItem[]>>, index: number, field: keyof MenuItem, value: string) {
    setter((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeItem(setter: React.Dispatch<React.SetStateAction<MenuItem[]>>, index: number) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    const result = await saveMenu({
      date,
      month: getMonthString(),
      breakfast_items: breakfast.filter((i) => i.name.trim()),
      lunch_items: lunch.filter((i) => i.name.trim()),
      dinner_items: dinner.filter((i) => i.name.trim()),
      special_items: special.filter((i) => i.name.trim()),
      status: 'published',
    }, menu?.id);
    setSaving(false);
    if (result.success) navigation.goBack();
    else Alert.alert('Error', result.error || 'Failed to save menu');
  }

  if (isLoading) return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={COLORS.PRIMARY_DARK} style={styles.centered} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Menu</Text>
        <Text style={styles.dateText}>{formatDate(date, 'MMM d')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <MenuSection title="🍳 Breakfast" items={breakfast} onUpdate={(i, f, v) => updateItem(setBreakfast, i, f, v)} onRemove={(i) => removeItem(setBreakfast, i)} onAdd={() => addItem(setBreakfast)} editable={canCreate('menu') || canUpdate('menu')} />
        <MenuSection title="🍽️ Lunch" items={lunch} onUpdate={(i, f, v) => updateItem(setLunch, i, f, v)} onRemove={(i) => removeItem(setLunch, i)} onAdd={() => addItem(setLunch)} editable={canCreate('menu') || canUpdate('menu')} />
        <MenuSection title="🌙 Dinner" items={dinner} onUpdate={(i, f, v) => updateItem(setDinner, i, f, v)} onRemove={(i) => removeItem(setDinner, i)} onAdd={() => addItem(setDinner)} editable={canCreate('menu') || canUpdate('menu')} />
        <MenuSection title="⭐ Special" items={special} onUpdate={(i, f, v) => updateItem(setSpecial, i, f, v)} onRemove={(i) => removeItem(setSpecial, i)} onAdd={() => addItem(setSpecial)} editable={canCreate('menu') || canUpdate('menu')} />

        {(canCreate('menu') || canUpdate('menu')) && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.WHITE} /> : <Text style={styles.saveButtonText}>Publish Menu</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuSection({ title, items, onUpdate, onRemove, onAdd, editable }: {
  title: string;
  items: MenuItem[];
  onUpdate: (index: number, field: keyof MenuItem, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  editable: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.menuItem}>
          <TextInput style={styles.menuInput} placeholder="Item name" value={item.name} onChangeText={(v) => onUpdate(i, 'name', v)} editable={editable} />
          <TextInput style={styles.menuInput} placeholder="Quantity" value={item.quantity} onChangeText={(v) => onUpdate(i, 'quantity', v)} editable={editable} />
          {editable && (
            <TouchableOpacity onPress={() => onRemove(i)} style={styles.removeButton}>
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {editable && (
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addButtonText}>+ Add Item</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  centered: { marginTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.CARD },
  backButton: { fontSize: 16, color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginLeft: 12, flex: 1 },
  dateText: { fontSize: 14, color: COLORS.TEXT_MUTED },
  content: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: COLORS.CARD, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.BORDER },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 10 },
  menuItem: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  menuInput: { flex: 1, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: COLORS.BACKGROUND, color: COLORS.TEXT, minHeight: 42 },
  removeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.DANGER, justifyContent: 'center', alignItems: 'center' },
  removeButtonText: { color: COLORS.WHITE, fontSize: 14, fontWeight: '700' },
  addButton: { borderWidth: 1, borderColor: COLORS.PRIMARY_DARK, borderStyle: 'dashed', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 4 },
  addButtonText: { color: COLORS.PRIMARY_DARK, fontSize: 14, fontWeight: '600' },
  saveButton: { backgroundColor: COLORS.PRIMARY_DARK, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 12, minHeight: 50, justifyContent: 'center' },
  saveButtonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
});