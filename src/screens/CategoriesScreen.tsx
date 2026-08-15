import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { CategoryRepository } from '@/database/repositories/CategoryRepository';

import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS } from '@/utils/constants';
import { Category } from '@/types';
import { generateClientOperationId, generateUUID } from '@/utils/validators';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function CategoriesScreen() {
  const { activeGroupId } = useGroup();
  const navigation = useNavigation<Nav>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    if (!activeGroupId) return;
    const data = await CategoryRepository.getByGroupId(activeGroupId);
    setCategories(data);
    setIsLoading(false);
  }, [activeGroupId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleAdd() {
    if (!newName.trim() || !activeGroupId) return;
    const now = new Date().toISOString();
    await CategoryRepository.upsert({
      id: generateUUID(), group_id: activeGroupId, name: newName.trim(), active: true,
      sort_order: categories.length, version: 1, client_operation_id: generateClientOperationId(),
      created_date: now, updated_date: now,
    });
    setNewName('');
    await load();
  }

  async function handleDelete(cat: Category) {
    Alert.alert('Delete Category', `Delete "${cat.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await CategoryRepository.softDelete(cat.id);
        await load();
      }},
    ]);
  }

  if (isLoading) return <SafeAreaView style={styles.container}><LoadingState /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Categories</Text>
      </View>

      <View style={styles.addRow}>
        <TextInput style={styles.addInput} placeholder="New category name" value={newName} onChangeText={setNewName} />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardName}>{item.name}</Text>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState message="No categories yet." icon="🏷️" />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.CARD },
  backButton: { fontSize: 16, color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginLeft: 12 },
  addRow: { flexDirection: 'row', padding: 16, gap: 8 },
  addInput: { flex: 1, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: COLORS.CARD, color: COLORS.TEXT, minHeight: 46 },
  addButton: { backgroundColor: COLORS.PRIMARY_DARK, borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: COLORS.WHITE, fontSize: 15, fontWeight: '700' },
  list: { padding: 16, paddingTop: 0 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.CARD, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.BORDER },
  cardName: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  deleteButton: { backgroundColor: COLORS.DANGER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  deleteButtonText: { color: COLORS.WHITE, fontSize: 13, fontWeight: '600' },
});
