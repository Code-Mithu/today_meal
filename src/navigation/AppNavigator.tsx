import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GroupProvider } from '@/context/GroupContext';
import { SyncProvider } from '@/context/SyncContext';
import AuthScreen from '@/screens/AuthScreen';
import { COLORS } from '@/utils/constants';
import MainNavigator from './MainNavigator';

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.BACKGROUND }}><ActivityIndicator color={COLORS.PRIMARY_DARK} /></View>;
  if (!user) return <AuthScreen />;
  return <GroupProvider><SyncProvider><MainNavigator /></SyncProvider></GroupProvider>;
}

export default function AppNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AuthenticatedApp />
      </NavigationContainer>
    </AuthProvider>
  );
}
