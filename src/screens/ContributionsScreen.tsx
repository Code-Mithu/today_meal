import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { useContributions } from '@/hooks/useContributions';
import { usePermissions } from '@/hooks/usePermissions';
import { useMembers } from '@/hooks/useMembers';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { Avatar } from '@/components/common/Avatar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS, PAYMENT_METHODS } from '@/utils/constants';
import { formatCurrency, formatDate, getTodayString, getMonthString } from '@/utils/formatters';
import { sumContributions } from '@/utils/calculations';
import { Contribution } from '@/types';

export default function ContributionsScreen() {
  const { activeGroup, activeGroupId } = useGroup();
  const { canCreate, canDelete } = usePermissions();
  const { members } = useMembers();
  const month = getMonthString();
  const startDate = `${month}-01`;
  const { contributions, isLoading, createContribution, deleteContribution, refresh } = useContributions(startDate);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');

  const total = sumContributions(contributions);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  async function handleAdd() {
    const member = members.find((m) => m.id === selectedMember);
    if (!member) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    const result = await createContribution({
      member_id: member.id,
      member_name: member.member_name,
      amount: amt,
      date,
      payment_method: paymentMethod as any,
      note: note.trim() || undefined,
    });

    if (result.success) {
      setShowAdd(false);
      setAmount('');
      setNote('');
      await refresh();
    }
  }

  if (isLoading) return <SafeAreaView style={styles.container}><LoadingState /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar />
      <View style={styles.header}>
        <Text style={styles.title}>Contributions</Text>
        <Text style={styles.subtitle}>{activeGroup?.name} • {month}</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Contributions</Text>
        <Text style={styles.totalValue}>{formatCurrency(total, activeGroup?.currency)}</Text>
      </View>

      <FlatList
        data={contributions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContributionItem item={item} currency={activeGroup?.currency} canDelete={canDelete('contribution')} onDelete={() => deleteContribution(item.id)} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState message="No contributions this month." icon="💰" />}
      />

      {canCreate('contribution') && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Contribution</Text>
            <Text style={styles.inputLabel}>Member</Text>
            <View style={styles.memberList}>
              {members.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberChip, selectedMember === m.id && styles.memberChipActive]}
                  onPress={() => setSelectedMember(m.id)}
                >
                  <Text style={[styles.memberChipText, selectedMember === m.id && styles.memberChipTextActive]}>{m.member_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
            <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.methodChip, paymentMethod === m.value && styles.methodChipActive]}
                  onPress={() => setPaymentMethod(m.value)}
                >
                  <Text style={[styles.methodChipText, paymentMethod === m.value && styles.methodChipTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="Note (optional)" value={note} onChangeText={setNote} multiline />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleAdd}>
                <Text style={styles.modalButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ContributionItem({ item, currency, canDelete, onDelete }: { item: Contribution; currency?: string; canDelete: boolean; onDelete: () => void }) {
  return (
    <View style={styles.card}>
      <Avatar name={item.member_name} size={36} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.member_name}</Text>
        <Text style={styles.cardDate}>{formatDate(item.date, 'MMM d')} • {item.payment_method}</Text>
      </View>
      <Text style={styles.cardAmount}>{formatCurrency(item.amount, currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT },
  subtitle: { fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 2 },
  totalCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.CARD, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.BORDER },
  totalLabel: { fontSize: 13, color: COLORS.TEXT_MUTED, textTransform: 'uppercase', fontWeight: '600' },
  totalValue: { fontSize: 28, fontWeight: '800', color: COLORS.PRIMARY_DARK, marginTop: 4 },
  list: { padding: 16, paddingTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.CARD, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.BORDER },
  cardInfo: { flex: 1, marginLeft: 10 },
  cardName: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  cardDate: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: '700', color: COLORS.PRIMARY_DARK },
  fab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.PRIMARY_DARK, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  fabText: { color: COLORS.WHITE, fontSize: 28, fontWeight: '300' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: COLORS.CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginBottom: 16 },
  inputLabel: { fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '600', marginBottom: 6 },
  memberList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  memberChip: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  memberChipActive: { backgroundColor: COLORS.PRIMARY_DARK, borderColor: COLORS.PRIMARY_DARK },
  memberChipText: { color: COLORS.TEXT, fontSize: 14 },
  memberChipTextActive: { color: COLORS.WHITE },
  input: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 10, backgroundColor: COLORS.BACKGROUND, color: COLORS.TEXT, minHeight: 46 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  methodChip: { borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  methodChipActive: { backgroundColor: COLORS.PRIMARY_LIGHT, borderColor: COLORS.PRIMARY_DARK },
  methodChipText: { color: COLORS.TEXT, fontSize: 13 },
  methodChipTextActive: { color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalButton: { flex: 1, backgroundColor: COLORS.PRIMARY_DARK, borderRadius: 10, paddingVertical: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  cancelButton: { backgroundColor: COLORS.BACKGROUND, borderWidth: 1, borderColor: COLORS.BORDER },
  modalButtonText: { color: COLORS.WHITE, fontSize: 16, fontWeight: '700' },
  cancelButtonText: { color: COLORS.TEXT, fontSize: 16, fontWeight: '600' },
});