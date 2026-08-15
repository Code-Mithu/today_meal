import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { VendorRepository } from '@/database/repositories/VendorRepository';

import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS } from '@/utils/constants';
import { Vendor } from '@/types';
import { generateClientOperationId } from '@/utils/validators';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function VendorsScreen() {
  const { activeGroupId } = useGroup();
  const navigation = useNavigation<Nav>();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');

  const load = useCallback(async () => {
    if (!activeGroupId) return;
    const data = await VendorRepository.getByGroupId(activeGroupId);
    setVendors(data);
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
    await VendorRepository.upsert({ id: `vendor-${Date.now()}`, group_id: activeGroupId, name: newName.trim(), contact_info: newContact.trim() || undefined, active: true, sort_order: vendors.length, version: 1, client_operation_id: generateClientOperationId(), created_date: now, updated_date: now });
    setNewName(''); setNewContact(''); await load();
  }

  async function handleDelete(v: Vendor) {
    Alert.alert('Delete Vendor', `Delete "${v.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await VendorRepository.softDelete(v.id);
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
        <Text style={styles.title}>Vendors</Text>
      </View>

      <View style={styles.addRow}>
        <TextInput style={styles.addInput} placeholder="Vendor name" value={newName} onChangeText={setNewName} />
        <TextInput style={styles.addInput} placeholder="Contact (optional)" value={newContact} onChangeText={setNewContact} />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vendors}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              {item.contact_info && <Text style={styles.cardContact}>{item.contact_info}</Text>}
            </View>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState message="No vendors yet." icon="🏪" />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.CARD },
  backButton: { fontSize: 16, color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginLeft: 12 },
  addRow: { flexDirection: 'row', padding: 16, gap: 8, flexWrap: 'wrap' },
  addInput: { flex: 1, minWidth: 120, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: COLORS.CARD, color: COLORS.TEXT, minHeight: 46 },
  addButton: { backgroundColor: COLORS.PRIMARY_DARK, borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: COLORS.WHITE, fontSize: 15, fontWeight: '700' },
  list: { padding: 16, paddingTop: 0 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.CARD, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.BORDER },
  cardName: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  cardContact: { fontSize: 13, color: COLORS.TEXT_MUTED, marginTop: 2 },
  deleteButton: { backgroundColor: COLORS.DANGER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  deleteButtonText: { color: COLORS.WHITE, fontSize: 13, fontWeight: '600' },
});
