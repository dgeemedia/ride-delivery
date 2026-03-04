// src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';

// Import navigators
import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import DriverNavigator from './DriverNavigator';
import PartnerNavigator from './PartnerNavigator';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : user.role === 'CUSTOMER' ? (
          <Stack.Screen name="Customer" component={CustomerNavigator} />
        ) : user.role === 'DRIVER' ? (
          <Stack.Screen name="Driver" component={DriverNavigator} />
        ) : (
          <Stack.Screen name="Partner" component={PartnerNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;