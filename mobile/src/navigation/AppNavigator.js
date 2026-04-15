// mobile/src/navigation/AppNavigator.js
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import DriverNavigator from './DriverNavigator';
import PartnerNavigator from './PartnerNavigator';

const Stack = createStackNavigator();

const LoadingScreen = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={[styles.loadingText, { color: theme.hint }]}>Loading...</Text>
    </View>
  );
};

const AppNavigator = () => {
  const { user, loading } = useAuth();
  const { loaded: themeLoaded } = useTheme();

  if (loading || !themeLoaded) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName={!user ? "Auth" : user.role === 'CUSTOMER' ? "Customer" : user.role === 'DRIVER' ? "Driver" : "Partner"}
    >
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
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
});

export default AppNavigator;