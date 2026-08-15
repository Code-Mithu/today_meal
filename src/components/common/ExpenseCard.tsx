import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '@/utils/constants';
import { formatCurrency } from '@/utils/formatters';
import { Expense } from '@/types';
import { Avatar } from '@/components/common/Avatar';

export function ExpenseCard({ expense, currency, onPress }: { expense: Expense; currency?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Avatar name={expense.spent_by || expense.created_by_name || '?'} size={36} />
        <View style={styles.headerInfo}>
          <Text style={styles.spentBy} numberOfLines={1}>{expense.spent_by || expense.created_by_name || 'Unknown'}</Text>
          <Text style={styles.date}>{expense.date}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amount}>{formatCurrency(expense.total_daily_expense, currency)}</Text>
        </View>
      </View>
      <View style={styles.details}>
        {expense.food_expense_amount > 0 && (
          <Text style={styles.detail}>Food: {formatCurrency(expense.food_expense_amount, currency)}</Text>
        )}
        {expense.other_expense_amount > 0 && (
          <Text style={styles.detail}>Other: {formatCurrency(expense.other_expense_amount, currency)}</Text>
        )}
        <Text style={styles.detail}>Meals: {expense.number_of_meals} • Rate: {formatCurrency(expense.cost_per_meal, currency)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  spentBy: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  date: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.PRIMARY_DARK,
  },
  localBadge: {
    fontSize: 10,
    color: COLORS.WARNING,
    fontWeight: '600',
    marginTop: 2,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detail: {
    fontSize: 13,
    color: COLORS.TEXT_MUTED,
  },
});
