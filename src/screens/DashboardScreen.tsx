import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { ExpenseRepository } from '@/database/repositories/ExpenseRepository';
import { ContributionRepository } from '@/database/repositories/ContributionRepository';
import { MealRepository } from '@/database/repositories/MealRepository';
import { MenuRepository } from '@/database/repositories/MenuRepository';
import { sumExpenses, sumContributions, sumMeals, calculateMealRate } from '@/utils/calculations';
import { formatCurrency, getTodayString, getMonthString } from '@/utils/formatters';
import { COLORS } from '@/utils/constants';
import { LoadingState } from '@/components/common/States';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function DashboardScreen() {
  const { activeGroup, activeGroupId } = useGroup();
  const navigation = useNavigation<Nav>();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalExpenses: 0, totalContributions: 0, totalMeals: 0, mealRate: 0, balance: 0, todayExpenses: 0, todayMeals: 0 });
  const [todayMenu, setTodayMenu] = useState<any>(null);
  const loadDashboard = useCallback(async () => {
    if (!activeGroupId) return;
    const month = getMonthString(); const today = getTodayString();
    const [expenses, contributions, meals, menu] = await Promise.all([
      ExpenseRepository.getByGroupId(activeGroupId, { month }),
      ContributionRepository.getByGroupId(activeGroupId, { startDate: `${month}-01` }),
      MealRepository.getByGroupId(activeGroupId, { startDate: `${month}-01` }),
      MenuRepository.getByDate(activeGroupId, today),
    ]);
    const totalExpenses = sumExpenses(expenses); const totalContributions = sumContributions(contributions); const totalMeals = sumMeals(meals);
    setStats({ totalExpenses, totalContributions, totalMeals, mealRate: calculateMealRate(totalExpenses, totalMeals), balance: totalContributions - totalExpenses, todayExpenses: sumExpenses(expenses.filter((item) => item.date === today)), todayMeals: sumMeals(meals.filter((item) => item.date === today)) });
    setTodayMenu(menu); setIsLoading(false);
  }, [activeGroupId]);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await loadDashboard(); setRefreshing(false); }, [loadDashboard]);
  if (isLoading) return <LoadingState />;
  return <SafeAreaView style={styles.container}><ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
    <View style={styles.groupHeader}><View style={{ flex: 1 }}><Text style={styles.groupName}>{activeGroup?.name}</Text><Text style={styles.groupMonth}>{getMonthString()} · Private offline data</Text></View><View style={styles.offlinePill}><Text style={styles.offlinePillText}>On device</Text></View></View>
    <View style={styles.balanceCard}><Text style={styles.balanceLabel}>CURRENT BALANCE</Text><Text style={[styles.balanceAmount, { color: stats.balance >= 0 ? COLORS.SUCCESS : COLORS.DANGER }]}>{formatCurrency(stats.balance, activeGroup?.currency)}</Text><View style={styles.balanceRow}><View style={styles.balanceItem}><Text style={styles.balanceItemLabel}>Contributions</Text><Text style={styles.balanceItemValue}>{formatCurrency(stats.totalContributions, activeGroup?.currency)}</Text></View><View style={styles.balanceItem}><Text style={styles.balanceItemLabel}>Expenses</Text><Text style={styles.balanceItemValue}>{formatCurrency(stats.totalExpenses, activeGroup?.currency)}</Text></View></View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Today&apos;s menu</Text>{todayMenu ? <View style={styles.menuCard}><Text style={styles.menuItem}>Breakfast · {todayMenu.breakfast_items.map((item: any) => item.name).join(', ')}</Text><Text style={styles.menuItem}>Lunch · {todayMenu.lunch_items.map((item: any) => item.name).join(', ')}</Text><Text style={styles.menuItem}>Dinner · {todayMenu.dinner_items.map((item: any) => item.name).join(', ')}</Text></View> : <Text style={styles.emptyText}>No menu saved for today</Text>}</View>
    <View style={styles.statsGrid}><StatCard label="Total meals" value={String(stats.totalMeals)} /><StatCard label="Meal rate" value={formatCurrency(stats.mealRate, activeGroup?.currency)} /><StatCard label="Today expenses" value={formatCurrency(stats.todayExpenses, activeGroup?.currency)} /><StatCard label="Today meals" value={String(stats.todayMeals)} /></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Quick actions</Text><View style={styles.actionsRow}><ActionCard label="Add expense" onPress={() => navigation.navigate('AddExpense')} /><ActionCard label="Contribution" onPress={() => navigation.navigate('Contributions')} /><ActionCard label="Daily menu" onPress={() => navigation.navigate('DailyMenu', { date: getTodayString() })} /><ActionCard label="Members" onPress={() => navigation.navigate('Members')} /></View></View>
  </ScrollView></SafeAreaView>;
}
function StatCard({ label, value }: { label: string; value: string }) { return <View style={styles.statCard}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }
function ActionCard({ label, onPress }: { label: string; onPress: () => void }) { return <TouchableOpacity style={styles.actionCard} onPress={onPress}><Text style={styles.actionText}>{label}</Text></TouchableOpacity>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: COLORS.BACKGROUND }, scrollView: { flex: 1, padding: 16 }, groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, groupName: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT }, groupMonth: { fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 2 }, offlinePill: { backgroundColor: COLORS.PRIMARY_LIGHT, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }, offlinePillText: { color: COLORS.PRIMARY_DARK, fontWeight: '700', fontSize: 12 }, balanceCard: { backgroundColor: COLORS.CARD, borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: COLORS.BORDER }, balanceLabel: { fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '600' }, balanceAmount: { fontSize: 32, fontWeight: '800', marginVertical: 4 }, balanceRow: { flexDirection: 'row', marginTop: 8 }, balanceItem: { flex: 1 }, balanceItemLabel: { fontSize: 12, color: COLORS.TEXT_MUTED }, balanceItemValue: { fontSize: 16, fontWeight: '600', color: COLORS.TEXT, marginTop: 2 }, section: { marginBottom: 16 }, sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT, marginBottom: 10 }, menuCard: { backgroundColor: COLORS.CARD, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.BORDER }, menuItem: { fontSize: 14, color: COLORS.TEXT, marginBottom: 7 }, emptyText: { color: COLORS.TEXT_MUTED }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }, statCard: { backgroundColor: COLORS.CARD, borderRadius: 10, padding: 14, flex: 1, minWidth: '47%', borderWidth: 1, borderColor: COLORS.BORDER }, statLabel: { fontSize: 12, color: COLORS.TEXT_MUTED, textTransform: 'uppercase', fontWeight: '600' }, statValue: { fontSize: 20, fontWeight: '700', color: COLORS.PRIMARY_DARK, marginTop: 4 }, actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, actionCard: { backgroundColor: COLORS.PRIMARY, borderRadius: 10, padding: 14, flex: 1, minWidth: '47%', minHeight: 50, justifyContent: 'center' }, actionText: { color: COLORS.WHITE, fontSize: 14, fontWeight: '600', textAlign: 'center' } });
