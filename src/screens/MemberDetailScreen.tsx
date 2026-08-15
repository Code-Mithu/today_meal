import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';
import { COLORS } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import { MemberRepository } from '@/database/repositories/MemberRepository';
import { MealGroupMember } from '@/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'MemberDetail'>;
type Route = RouteProp<MainStackParamList, 'MemberDetail'>;

export default function MemberDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [member, setMember] = useState<MealGroupMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    MemberRepository.getById(route.params.memberId).then((m) => {
      setMember(m);
      setIsLoading(false);
    });
  }, [route.params.memberId]);

  if (isLoading) return <SafeAreaView style={styles.container}><Text style={styles.loading}>Loading...</Text></SafeAreaView>;
  if (!member) return <SafeAreaView style={styles.container}><Text style={styles.loading}>Member not found</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Member Detail</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.memberName}>{member.member_name}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{member.role.replace('_', ' ')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={[styles.value, { color: member.status === 'frozen' ? COLORS.DANGER : COLORS.SUCCESS }]}>
              {member.status}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Start Date</Text>
            <Text style={styles.value}>{formatDate(member.start_date)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Active</Text>
            <Text style={styles.value}>{member.active ? 'Yes' : 'No'}</Text>
          </View>
        </View>

        {Object.keys(member.permissions || {}).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Permissions</Text>
            {Object.entries(member.permissions).map(([key, value]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.label}>{key}</Text>
                <Text style={[styles.value, { color: value ? COLORS.SUCCESS : COLORS.TEXT_MUTED }]}>
                  {value ? '✓' : '✕'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.CARD },
  backButton: { fontSize: 16, color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginLeft: 12 },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.CARD, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.BORDER },
  memberName: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: COLORS.TEXT_MUTED },
  value: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT, textTransform: 'capitalize' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 10 },
  loading: { fontSize: 16, color: COLORS.TEXT_MUTED, textAlign: 'center', marginTop: 40 },
});
