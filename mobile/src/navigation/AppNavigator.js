// mobile/src/navigation/AppNavigator.js
import React from 'react';
import {View, Text, ActivityIndicator, StyleSheet} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {useAuth} from '../context/AuthContext';
import {colors} from '../theme/colors';

import AuthNavigator from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import DriverNavigator from './DriverNavigator';
import PartnerNavigator from './PartnerNavigator';

const Stack = createStackNavigator();

const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.loadingText}>Loading...</Text>
  </View>
);

const AppNavigator = () => {
  const {user, loading} = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
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
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.text.secondary,
  },
});

export default AppNavigator;