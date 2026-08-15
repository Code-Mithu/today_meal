import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import DashboardScreen from '@/screens/DashboardScreen';
import ExpensesScreen from '@/screens/ExpensesScreen';
import MealsScreen from '@/screens/MealsScreen';
import ReportsScreen from '@/screens/ReportsScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import { COLORS } from '@/utils/constants';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.PRIMARY_DARK,
        tabBarInactiveTintColor: COLORS.TEXT_MUTED,
        tabBarStyle: {
          backgroundColor: COLORS.CARD,
          borderTopColor: COLORS.BORDER,
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} options={{ tabBarLabel: 'Expenses' }} />
      <Tab.Screen name="Meals" component={MealsScreen} options={{ tabBarLabel: 'Meals' }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarLabel: 'Reports' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}