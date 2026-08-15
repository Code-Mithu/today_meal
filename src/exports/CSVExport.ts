import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Expense, Contribution, DailyMeal, MealGroup } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';

function escapeCSV(value: any): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * CSVExport — generates a CSV file and shares it via the native share sheet.
 */
export async function generateExpenseReportCSV(params: {
  group: MealGroup;
  expenses: Expense[];
  contributions: Contribution[];
  startDate: string;
  endDate: string;
  currency: string;
}): Promise<void> {
  const { group, expenses, contributions, startDate, endDate, currency } = params;

  const lines: string[] = [];
  lines.push(`Today Meal Report: ${escapeCSV(group.name)}`);
  lines.push(`Period,${escapeCSV(formatDate(startDate))},${escapeCSV(formatDate(endDate))}`);
  lines.push('');
  lines.push('EXPENSES');
  lines.push('Date,Spent By,Meals,Food Amount,Other Amount,Total,Cost Per Meal,Vendor,Category');
  for (const e of expenses) {
    lines.push([
      escapeCSV(e.date),
      escapeCSV(e.spent_by || e.created_by_name || ''),
      e.number_of_meals,
      e.food_expense_amount,
      e.other_expense_amount,
      e.total_daily_expense,
      e.cost_per_meal,
      escapeCSV(e.vendor_shop_name || ''),
      escapeCSV(e.category || ''),
    ].join(','));
  }
  lines.push('');
  lines.push('CONTRIBUTIONS');
  lines.push('Date,Member,Amount,Payment Method,Note');
  for (const c of contributions) {
    lines.push([
      escapeCSV(c.date),
      escapeCSV(c.member_name),
      c.amount,
      escapeCSV(c.payment_method),
      escapeCSV(c.note || ''),
    ].join(','));
  }

  const csv = lines.join('\n');
  const fileName = `${group.name.replace(/\s+/g, '_')}_report.csv`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `${group.name} Report` });
}
