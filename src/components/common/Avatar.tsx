import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/utils/constants';
import { getInitials } from '@/utils/formatters';

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = getInitials(name);
  const fontSize = size * 0.4;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: COLORS.WHITE,
    fontWeight: '700',
  },
});