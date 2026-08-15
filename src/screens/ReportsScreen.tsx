import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGroup } from '@/context/GroupContext';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS } from '@/utils/constants';
import { formatCurrency, formatDate, getMonthString } from '@/utils/formatters';
import { ExpenseRepository } from '@/database/repositories/ExpenseRepository';
import { ContributionRepository } from '@/database/repositories/ContributionRepository';
import { MealRepository } from '@/database/repositories/MealRepository';
import { MemberRepository } from '@/database/repositories/MemberRepository';
import { sumExpenses, sumContributions, sumMeals, calculateMealRate, calculateMemberMealCost } from '@/utils/calculations';
import { generateExpenseReportPDF } from '@/exports/PDFExport';
import { generateExpenseReportCSV } from '@/exports/CSVExport';

export default function ReportsScreen() {
  const { activeGroup, activeGroupId } = useGroup();
  const [refreshing, setRefreshing] = useState(false);
  const [reportType, setReportType] = useState<'summary' | 'member' | 'daily'>('summary');
  const [exporting, setExporting] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const month = getMonthString();
  const startDate = `${month}-01`;
  const endDate = new Date().toISOString().slice(0, 10);

  const loadReport = useCallback(async () => {
    if (!activeGroupId) return;
    const expenses = await ExpenseRepository.getByGroupId(activeGroupId, { startDate, endDate });
    const contributions = await ContributionRepository.getByGroupId(activeGroupId, { startDate, endDate });
    const meals = await MealRepository.getByGroupId(activeGroupId, { startDate, endDate });
    const members = await MemberRepository.getByGroupId(activeGroupId);

    const totalExpenses = sumExpenses(expenses);
    const totalContributions = sumContributions(contributions);
    const totalMeals = sumMeals(meals);
    const mealRate = calculateMealRate(totalExpenses, totalMeals);
    const balance = totalContributions - totalExpenses;

    // Member settlement
    const memberSettlement = members.map((m) => {
      const memberMeals = meals.filter((meal) => meal.member_id === m.id);
      const memberMealCount = sumMeals(memberMeals);
      const memberMealCost = calculateMemberMealCost(memberMealCount, mealRate);
      const memberContributions = sumContributions(contributions.filter((c) => c.member_id === m.id));
      const memberBalance = memberContributions - memberMealCost;
      return { member: m, meals: memberMealCount, mealCost: memberMealCost, contributions: memberContributions, balance: memberBalance };
    });

    // Daily summary
    const dailyMap: Record<string, { expenses: number; meals: number }> = {};
    for (const e of expenses) {
      if (!dailyMap[e.date]) dailyMap[e.date] = { expenses: 0, meals: 0 };
      dailyMap[e.date].expenses += e.total_daily_expense;
    }
    for (const m of meals) {
      if (!dailyMap[m.date]) dailyMap[m.date] = { expenses: 0, meals: 0 };
      dailyMap[m.date].meals += m.total;
    }
    const dailySummary = Object.entries(dailyMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => b.date.localeCompare(a.date));

    setReportData({ totalExpenses, totalContributions, totalMeals, mealRate, balance, memberSettlement, dailySummary, expenses, contributions });
    setIsLoading(false);
  }, [activeGroupId, startDate, endDate]);

  React.useEffect(() => { loadReport(); }, [loadReport]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReport();
    setRefreshing(false);
  }, [loadReport]);

  async function handleExportPDF() {
    if (!activeGroup || !reportData) return;
    setExporting(true);
    try {
      await generateExpenseReportPDF({
        group: activeGroup,
        expenses: reportData.expenses,
        contributions: reportData.contributions,
        meals: [],
        startDate, endDate,
        currency: activeGroup.currency,
      });
    } catch (e: any) {
      console.warn('PDF export failed:', e);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportCSV() {
    if (!activeGroup || !reportData) return;
    setExporting(true);
    try {
      await generateExpenseReportCSV({
        group: activeGroup,
        expenses: reportData.expenses,
        contributions: reportData.contributions,
        startDate, endDate,
        currency: activeGroup.currency,
      });
    } catch (e: any) {
      console.warn('CSV export failed:', e);
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <SafeAreaView style={styles.container}><LoadingState /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.subtitle}>{activeGroup?.name} • {month}</Text>

        {/* Report Type Tabs */}
        <View style={styles.tabs}>
          {(['summary', 'member', 'daily'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, reportType === t && styles.tabActive]} onPress={() => setReportType(t)}>
              <Text style={[styles.tabText, reportType === t && styles.tabTextActive]}>{t === 'summary' ? 'Summary' : t === 'member' ? 'Members' : 'Daily'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {reportData && reportType === 'summary' && (
          <View style={styles.card}>
            <ReportRow label="Total Expenses" value={formatCurrency(reportData.totalExpenses, activeGroup?.currency)} />
            <ReportRow label="Total Contributions" value={formatCurrency(reportData.totalContributions, activeGroup?.currency)} />
            <ReportRow label="Total Meals" value={String(reportData.totalMeals)} />
            <ReportRow label="Meal Rate" value={formatCurrency(reportData.mealRate, activeGroup?.currency)} />
            <ReportRow label="Balance" value={formatCurrency(reportData.balance, activeGroup?.currency)} valueColor={reportData.balance >= 0 ? COLORS.SUCCESS : COLORS.DANGER} />
          </View>
        )}

        {reportData && reportType === 'member' && (
          <View style={styles.card}>
            {reportData.memberSettlement.map((s: any) => (
              <View key={s.member.id} style={styles.memberRow}>
                <Text style={styles.memberName}>{s.member.member_name}</Text>
                <Text style={styles.memberMeals}>{s.meals} meals</Text>
                <Text style={styles.memberCost}>{formatCurrency(s.mealCost, activeGroup?.currency)}</Text>
                <Text style={[styles.memberBalance, { color: s.balance >= 0 ? COLORS.SUCCESS : COLORS.DANGER }]}>{formatCurrency(s.balance, activeGroup?.currency)}</Text>
              </View>
            ))}
          </View>
        )}

        {reportData && reportType === 'daily' && (
          <View style={styles.card}>
            {reportData.dailySummary.map((d: any) => (
              <View key={d.date} style={styles.dailyRow}>
                <Text style={styles.dailyDate}>{formatDate(d.date, 'MMM d')}</Text>
                <Text style={styles.dailyMeals}>{d.meals} meals</Text>
                <Text style={styles.dailyExpenses}>{formatCurrency(d.expenses, activeGroup?.currency)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Export Buttons */}
        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF} disabled={exporting}>
            <Text style={styles.exportText}>📄 Export PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportCSV} disabled={exporting}>
            <Text style={styles.exportText}>📊 Export CSV</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.reportRow}>
      <Text style={styles.reportLabel}>{label}</Text>
      <Text style={[styles.reportValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT },
  subtitle: { fontSize: 14, color: COLORS.TEXT_MUTED, marginTop: 2, marginBottom: 16 },
  offlineBanner: { backgroundColor: COLORS.WARNING, borderRadius: 8, padding: 10, marginBottom: 12 },
  offlineText: { color: COLORS.WHITE, fontSize: 13, textAlign: 'center', fontWeight: '500' },
  tabs: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.BORDER, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.PRIMARY_DARK, borderColor: COLORS.PRIMARY_DARK },
  tabText: { fontSize: 14, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  tabTextActive: { color: COLORS.WHITE },
  card: { backgroundColor: COLORS.CARD, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.BORDER, marginBottom: 16 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  reportLabel: { fontSize: 15, color: COLORS.TEXT_MUTED },
  reportValue: { fontSize: 15, fontWeight: '700', color: COLORS.TEXT },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  memberName: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  memberMeals: { fontSize: 13, color: COLORS.TEXT_MUTED, marginRight: 8 },
  memberCost: { fontSize: 14, color: COLORS.TEXT, marginRight: 8, fontWeight: '500' },
  memberBalance: { fontSize: 14, fontWeight: '700' },
  dailyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  dailyDate: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  dailyMeals: { fontSize: 13, color: COLORS.TEXT_MUTED, marginRight: 12 },
  dailyExpenses: { fontSize: 14, fontWeight: '700', color: COLORS.PRIMARY_DARK },
  exportRow: { flexDirection: 'row', gap: 10 },
  exportButton: { flex: 1, backgroundColor: COLORS.CARD, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.BORDER, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  exportText: { fontSize: 15, fontWeight: '600', color: COLORS.PRIMARY_DARK },
});
