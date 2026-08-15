import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { usePermissions } from '@/hooks/usePermissions';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { COLORS } from '@/utils/constants';
import { AppStorage, STORAGE_KEYS } from '@/storage/AppStorage';
import { seedOfflineData } from '@/database/seed';
import * as LocalAuthentication from 'expo-local-authentication';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function SettingsScreen() {
  const { activeGroup, activeMember, refreshGroups } = useGroup(); const { isAdmin, canManage } = usePermissions(); const navigation = useNavigation<Nav>();
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  React.useEffect(() => { AppStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED).then((value) => setBiometricEnabled(value === 'true')); }, []);
  async function toggleBiometric(value: boolean) { if (value) { const compatible = await LocalAuthentication.hasHardwareAsync(); const enrolled = await LocalAuthentication.isEnrolledAsync(); if (!compatible || !enrolled) { Alert.alert('Biometric lock', 'Set up fingerprint or face authentication on this device first.'); return; } } setBiometricEnabled(value); await AppStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, String(value)); }
  function resetSamples() { Alert.alert('Restore sample data', 'This adds the built-in offline sample records again. Existing records are preserved.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', onPress: async () => { await seedOfflineData(true); await refreshGroups(); Alert.alert('Ready', 'Sample records restored.'); } }]); }
  return <SafeAreaView style={styles.container}><SyncStatusBar /><ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Settings</Text><Text style={styles.subtitle}>{activeGroup?.name}</Text>
    <View style={styles.section}><Text style={styles.sectionTitle}>LOCAL PROFILE</Text><View style={styles.profileInfo}><View style={styles.avatar}><Text style={styles.avatarText}>{(activeMember?.member_name || 'O').charAt(0)}</Text></View><View><Text style={styles.profileName}>{activeMember?.member_name || 'Household Owner'}</Text><Text style={styles.profileEmail}>Owner · no account required</Text></View></View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>HOUSEHOLD</Text>{isAdmin() && <SettingItem label="Household settings" onPress={() => navigation.navigate('GroupSettings')} />}{canManage('member') && <SettingItem label="Members" onPress={() => navigation.navigate('Members')} />}{canManage('category') && <SettingItem label="Categories" onPress={() => navigation.navigate('Categories')} />}{canManage('vendor') && <SettingItem label="Vendors" onPress={() => navigation.navigate('Vendors')} />}<SettingItem label="Audit history" onPress={() => navigation.navigate('AuditLog')} /></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>DATA</Text><SettingItem label="Restore sample data" onPress={resetSamples} /><View style={styles.infoBox}><Text style={styles.infoTitle}>Offline by design</Text><Text style={styles.infoText}>No login, cloud account, analytics, or internet connection is used. Keep device backups to protect your records.</Text></View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>SECURITY</Text><View style={styles.settingItem}><Text style={styles.settingLabel}>Biometric lock preference</Text><Switch value={biometricEnabled} onValueChange={toggleBiometric} trackColor={{ true: COLORS.PRIMARY_DARK, false: COLORS.BORDER }} /></View></View>
    <Text style={styles.version}>Today Meal Offline · v2.0.0</Text></ScrollView></SafeAreaView>;
}
function SettingItem({ label, onPress }: { label: string; onPress: () => void }) { return <TouchableOpacity style={styles.settingItem} onPress={onPress}><Text style={styles.settingLabel}>{label}</Text><Text style={styles.chevron}>›</Text></TouchableOpacity>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.BACKGROUND }, content: { padding: 16, paddingBottom: 40 }, title: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT }, subtitle: { fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 2, marginBottom: 20 }, section: { backgroundColor: COLORS.CARD, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.BORDER, overflow: 'hidden' }, sectionTitle: { fontSize: 12, color: COLORS.TEXT_MUTED, fontWeight: '700', margin: 14, marginBottom: 6 }, profileInfo: { flexDirection: 'row', alignItems: 'center', padding: 14 }, avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.PRIMARY, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, avatarText: { fontSize: 22, fontWeight: '700', color: COLORS.WHITE }, profileName: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT }, profileEmail: { fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 2 }, settingItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: COLORS.BORDER }, settingLabel: { flex: 1, fontSize: 16, color: COLORS.TEXT }, chevron: { fontSize: 22, color: COLORS.TEXT_MUTED }, infoBox: { padding: 14, borderTopWidth: 1, borderTopColor: COLORS.BORDER, backgroundColor: COLORS.PRIMARY_LIGHT }, infoTitle: { color: COLORS.PRIMARY_DARK, fontWeight: '700', marginBottom: 4 }, infoText: { color: COLORS.TEXT, fontSize: 14, lineHeight: 20 }, version: { fontSize: 13, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 10 } });
