import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import MainTabNavigator from './MainTabNavigator';
import ExpenseDetailScreen from '@/screens/ExpenseDetailScreen';
import AddExpenseScreen from '@/screens/AddExpenseScreen';
import EditExpenseScreen from '@/screens/EditExpenseScreen';
import ContributionsScreen from '@/screens/ContributionsScreen';
import DailyMenuScreen from '@/screens/DailyMenuScreen';
import MenuArchiveScreen from '@/screens/MenuArchiveScreen';
import MembersScreen from '@/screens/MembersScreen';
import MemberDetailScreen from '@/screens/MemberDetailScreen';
import GroupSettingsScreen from '@/screens/GroupSettingsScreen';
import CategoriesScreen from '@/screens/CategoriesScreen';
import VendorsScreen from '@/screens/VendorsScreen';
import AuditLogScreen from '@/screens/AuditLogScreen';
import PlanningScreen from '@/screens/PlanningScreen';
import { COLORS } from '@/utils/constants';

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.BACKGROUND } }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
      <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
      <Stack.Screen name="Contributions" component={ContributionsScreen} />
      <Stack.Screen name="DailyMenu" component={DailyMenuScreen} />
      <Stack.Screen name="MenuArchive" component={MenuArchiveScreen} />
      <Stack.Screen name="Members" component={MembersScreen} />
      <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Vendors" component={VendorsScreen} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} />
      <Stack.Screen name="Planning" component={PlanningScreen} />
    </Stack.Navigator>
  );
}
