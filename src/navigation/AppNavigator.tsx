import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GroupProvider } from '@/context/GroupContext';
import MainNavigator from './MainNavigator';

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <GroupProvider>
        <MainNavigator />
      </GroupProvider>
    </NavigationContainer>
  );
}
