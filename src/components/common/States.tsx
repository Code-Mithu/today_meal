import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/utils/constants';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: string }) {
  return (
    <View style={styles.container}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    fontSize: 15,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: COLORS.DANGER,
    textAlign: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
});