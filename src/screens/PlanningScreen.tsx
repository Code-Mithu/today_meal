import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useGroup } from '@/context/GroupContext';
import { execute, queryAll } from '@/database/db';
import { apiFetch } from '@/services/api';
import { getCloudHouseholdId } from '@/services/sync';
import { COLORS } from '@/utils/constants';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
type Section = 'budget' | 'rates' | 'recurring' | 'groceries' | 'sharing';

export default function PlanningScreen() {
  const navigation = useNavigation();
  const { activeGroup, activeGroupId } = useGroup();
  const [section, setSection] = useState<Section>('budget');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [secondary, setSecondary] = useState('');
  const [email, setEmail] = useState('');

  const table = section === 'budget' ? 'budgets' : section === 'rates' ? 'exchange_rates' : section === 'recurring' ? 'recurring_rules' : section === 'groceries' ? 'grocery_lists' : 'invitations';
  const load = useCallback(async () => {
    if (!activeGroupId) return;
    setRows(await queryAll(`SELECT * FROM ${table} WHERE group_id = ? AND deleted_at IS NULL ORDER BY created_date DESC`, [activeGroupId]));
  }, [activeGroupId, table]);
  useEffect(() => { void load(); }, [load]);

  async function addLocal() {
    if (!activeGroupId || !name.trim()) return Alert.alert('Missing information', 'Enter a name first.');
    const id = uid(); const timestamp = now();
    if (section === 'budget') await execute('INSERT INTO budgets (id, group_id, name, period, amount, currency, active, version, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)', [id, activeGroupId, name.trim(), secondary || 'monthly', Number(amount) || 0, activeGroup?.currency || 'BDT', timestamp, timestamp]);
    if (section === 'rates') await execute('INSERT INTO exchange_rates (id, group_id, base_currency, quote_currency, rate, rate_date, version, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)', [id, activeGroupId, activeGroup?.currency || 'BDT', name.trim().toUpperCase(), Number(amount) || 1, new Date().toISOString().slice(0, 10), timestamp, timestamp]);
    if (section === 'recurring') await execute('INSERT INTO recurring_rules (id, group_id, name, frequency, next_run, active, expense_template, version, created_date, updated_date) VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?, ?)', [id, activeGroupId, name.trim(), secondary || 'monthly', new Date().toISOString().slice(0, 10), JSON.stringify({ description: name.trim(), amount: Number(amount) || 0, currency: activeGroup?.currency || 'BDT' }), timestamp, timestamp]);
    if (section === 'groceries') await execute('INSERT INTO grocery_lists (id, group_id, name, status, version, created_date, updated_date) VALUES (?, ?, ?, ?, 1, ?, ?)', [id, activeGroupId, name.trim(), 'active', timestamp, timestamp]);
    setName(''); setAmount(''); setSecondary(''); await load();
  }

  async function sendInvite() {
    const householdId = await getCloudHouseholdId();
    if (!householdId || !email.includes('@')) return Alert.alert('Cannot send', 'Connect the household and enter a valid email.');
    try {
      await apiFetch('/api/invitations', { method: 'POST', headers: { 'Idempotency-Key': uid() }, body: JSON.stringify({ householdId, email, role: 'member' }) });
      setEmail(''); Alert.alert('Invitation sent', 'Delivery status will synchronize to this device.');
    } catch (error) { Alert.alert('Invitation failed', error instanceof Error ? error.message : 'Try again.'); }
  }

  async function emailReport() {
    const householdId = await getCloudHouseholdId();
    if (!householdId || !email.includes('@')) return Alert.alert('Cannot send', 'Connect the household and enter a valid email.');
    try {
      await apiFetch('/api/reports/email', { method: 'POST', headers: { 'Idempotency-Key': uid() }, body: JSON.stringify({ householdId, email, currency: activeGroup?.currency || 'BDT' }) });
      Alert.alert('Report sent', 'Only approved expenses were included.');
    } catch (error) { Alert.alert('Report failed', error instanceof Error ? error.message : 'Try again.'); }
  }

  return <SafeAreaView style={styles.container}>
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity><View><Text style={styles.title}>Household planning</Text><Text style={styles.subtitle}>Finance, recurring work and groceries</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{(['budget', 'rates', 'recurring', 'groceries', 'sharing'] as Section[]).map((item) => <TouchableOpacity key={item} style={[styles.tab, section === item && styles.tabActive]} onPress={() => setSection(item)}><Text style={[styles.tabText, section === item && styles.tabTextActive]}>{item === 'rates' ? 'Currency' : item[0].toUpperCase() + item.slice(1)}</Text></TouchableOpacity>)}</ScrollView>
      {section === 'sharing' ? <View style={styles.card}><Text style={styles.cardTitle}>Invite and report delivery</Text><Text style={styles.help}>SMTP delivery is handled securely by the backend. Reports include approved expenses only.</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="recipient@example.com" placeholderTextColor={COLORS.TEXT_MUTED}/><View style={styles.actions}><Action label="Invite member" onPress={sendInvite}/><Action label="Email report" onPress={emailReport} secondary/></View></View> : <>
        <View style={styles.card}><Text style={styles.cardTitle}>{section === 'budget' ? 'New spending budget' : section === 'rates' ? 'Add exchange rate' : section === 'recurring' ? 'New recurring expense' : 'New grocery list'}</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder={section === 'rates' ? 'Quote currency, e.g. USD' : 'Name'} placeholderTextColor={COLORS.TEXT_MUTED}/>{section !== 'groceries' && <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={section === 'rates' ? 'Rate' : 'Amount'} placeholderTextColor={COLORS.TEXT_MUTED}/>} {(section === 'budget' || section === 'recurring') && <TextInput style={styles.input} value={secondary} onChangeText={setSecondary} placeholder={section === 'budget' ? 'Period: monthly' : 'Frequency: monthly'} placeholderTextColor={COLORS.TEXT_MUTED}/>}<Action label="Save offline" onPress={addLocal}/></View>
        <Text style={styles.sectionLabel}>CURRENT</Text>{rows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.help}>Create the first item. It will sync when the device reconnects.</Text></View> : rows.map((row) => <View key={String(row.id)} style={styles.row}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{String(row.name || row.quote_currency || row.email)}</Text><Text style={styles.rowMeta}>{section === 'budget' ? `${row.amount} ${row.currency} · ${row.period}` : section === 'rates' ? `1 ${row.base_currency} = ${row.rate} ${row.quote_currency}` : section === 'recurring' ? `${row.frequency} · next ${row.next_run}` : String(row.status || 'active')}</Text></View><View style={styles.status}><Text style={styles.statusText}>{row.active === 0 ? 'Paused' : 'Active'}</Text></View></View>)}
      </>}
      <View style={styles.note}><Text style={styles.noteTitle}>Manual contributions only</Text><Text style={styles.help}>No payment processor is connected. Contribution records remain bookkeeping entries and never charge a card or bank account.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

function Action({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) { return <TouchableOpacity style={[styles.button, secondary && styles.buttonSecondary]} onPress={() => void onPress()}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND }, header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER }, back: { color: COLORS.PRIMARY_DARK, fontSize: 16, fontWeight: '700' }, title: { color: COLORS.TEXT, fontSize: 20, fontWeight: '800' }, subtitle: { color: COLORS.TEXT_MUTED, fontSize: 13, marginTop: 2 }, content: { padding: 16, paddingBottom: 48, gap: 12 }, tabs: { gap: 8, paddingBottom: 4 }, tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: COLORS.BORDER }, tabActive: { backgroundColor: COLORS.PRIMARY_DARK, borderColor: COLORS.PRIMARY_DARK }, tabText: { color: COLORS.TEXT, fontWeight: '700', fontSize: 14 }, tabTextActive: { color: COLORS.WHITE }, card: { padding: 16, borderRadius: 14, backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: COLORS.BORDER, gap: 10 }, cardTitle: { color: COLORS.TEXT, fontSize: 17, fontWeight: '800' }, help: { color: COLORS.TEXT_MUTED, fontSize: 14, lineHeight: 20 }, input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.BACKGROUND, color: COLORS.TEXT, paddingHorizontal: 13, fontSize: 15 }, button: { minHeight: 48, paddingHorizontal: 16, borderRadius: 10, backgroundColor: COLORS.PRIMARY_DARK, alignItems: 'center', justifyContent: 'center', flex: 1 }, buttonSecondary: { backgroundColor: COLORS.PRIMARY_LIGHT, borderWidth: 1, borderColor: COLORS.PRIMARY }, buttonText: { color: COLORS.WHITE, fontSize: 15, fontWeight: '800' }, buttonTextSecondary: { color: COLORS.PRIMARY_DARK }, actions: { flexDirection: 'row', gap: 10 }, sectionLabel: { color: COLORS.TEXT_MUTED, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 6 }, empty: { backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 14, padding: 18 }, emptyTitle: { color: COLORS.TEXT, fontSize: 16, fontWeight: '800', marginBottom: 4 }, row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.CARD, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 12, padding: 14 }, rowCopy: { flex: 1 }, rowTitle: { color: COLORS.TEXT, fontSize: 15, fontWeight: '800' }, rowMeta: { color: COLORS.TEXT_MUTED, fontSize: 13, marginTop: 3 }, status: { backgroundColor: COLORS.PRIMARY_LIGHT, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { color: COLORS.PRIMARY_DARK, fontSize: 12, fontWeight: '800' }, note: { padding: 14, borderRadius: 12, backgroundColor: COLORS.PRIMARY_LIGHT }, noteTitle: { color: COLORS.PRIMARY_DARK, fontWeight: '800', marginBottom: 4 },
});
