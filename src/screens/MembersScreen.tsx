import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMembers } from '@/hooks/useMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { SyncStatusBar } from '@/components/common/SyncStatusBar';
import { Avatar } from '@/components/common/Avatar';
import { LoadingState, EmptyState } from '@/components/common/States';
import { COLORS } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import { MealGroupMember } from '@/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function MembersScreen() {
  const { members, isLoading, manageMember, refresh } = useMembers();
  const { canManage, isManager } = usePermissions();
  const navigation = useNavigation<Nav>();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  function handleFreeze(member: MealGroupMember) {
    const action = member.status === 'frozen' ? 'unfreeze' : 'freeze';
    Alert.alert(
      action === 'freeze' ? 'Freeze Member' : 'Unfreeze Member',
      `${action === 'freeze' ? 'Freeze' : 'Unfreeze'} ${member.member_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: action === 'freeze' ? 'Freeze' : 'Unfreeze', style: 'destructive', onPress: async () => {
          const result = await manageMember({ action, member_id: member.id });
          if (!result.success) Alert.alert('Error', result.error);
        }},
      ]
    );
  }

  if (isLoading) return <SafeAreaView style={styles.container}><LoadingState /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Members</Text>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Avatar name={item.member_name} size={40} />
            <TouchableOpacity style={styles.cardInfo} onPress={() => navigation.navigate('MemberDetail', { memberId: item.id })}>
              <Text style={styles.cardName}>{item.member_name}</Text>
              <Text style={styles.cardRole}>{item.role.replace('_', ' ')}</Text>
              <Text style={styles.cardDate}>Since {formatDate(item.start_date, 'MMM d')}</Text>
            </TouchableOpacity>
            {canManage('member') && (
              <TouchableOpacity
                style={[styles.freezeButton, item.status === 'frozen' && styles.unfreezeButton]}
                onPress={() => handleFreeze(item)}
              >
                <Text style={styles.freezeButtonText}>
                  {item.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<EmptyState message="No members found." icon="👥" />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, backgroundColor: COLORS.CARD },
  backButton: { fontSize: 16, color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginLeft: 12 },
  list: { padding: 16, paddingTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.CARD, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.BORDER },
  cardInfo: { flex: 1, marginLeft: 10 },
  cardName: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  cardRole: { fontSize: 13, color: COLORS.PRIMARY_DARK, textTransform: 'capitalize', marginTop: 2 },
  cardDate: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },
  freezeButton: { backgroundColor: COLORS.WARNING, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  unfreezeButton: { backgroundColor: COLORS.SUCCESS },
  freezeButtonText: { color: COLORS.WHITE, fontSize: 12, fontWeight: '600' },
});