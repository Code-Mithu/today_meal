import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/utils/constants';

export function SyncStatusBar() {
  return <View style={styles.bar}><Text style={styles.text}>Private offline mode · stored on this device</Text></View>;
}

const styles = StyleSheet.create({ bar: { backgroundColor: COLORS.PRIMARY_LIGHT, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }, text: { color: COLORS.PRIMARY_DARK, fontSize: 12, fontWeight: '600' } });
