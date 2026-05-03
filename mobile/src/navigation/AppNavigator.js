// mobile/src/navigation/AppNavigator.js
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Location from 'expo-location';
import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

import AuthNavigator     from './AuthNavigator';
import CustomerNavigator from './CustomerNavigator';
import DriverNavigator   from './DriverNavigator';
import PartnerNavigator  from './PartnerNavigator';
import BiometricLockScreen      from '../screens/Auth/BiometricLockScreen';
import LocationPermissionScreen from '../screens/Auth/LocationPermissionScreen';

const Stack = createStackNavigator();

const LoadingScreen = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={[styles.loadingTxt, { color: theme.hint }]}>Loading…</Text>
    </View>
  );
};

// ─── Root screen that handles everything ─────────────────────────────────────
const RootScreen = () => {
  const { user, loading, biometricLocked } = useAuth();
  const { loaded: themeLoaded }            = useTheme();
  const [locationGranted, setLocationGranted] = useState(null); // null = loading

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      // First check if the device's location services are switched on at all
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        setLocationGranted(false);
        return;
      }
      // Then check if the app has been granted permission
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationGranted(status === 'granted');
    } catch {
      setLocationGranted(false);
    }
  };

  // 1. Wait for auth + theme to load
  if (loading || !themeLoaded) return <LoadingScreen />;

  // 2. Biometric lock gate (only while logged in)
  if (user && biometricLocked) return <BiometricLockScreen />;

  // 3. Not logged in → auth flow
  if (!user) return <AuthNavigator />;

  // 4. Still checking location permission
  if (locationGranted === null) return <LoadingScreen />;

  // 5. Location not granted → show custom gate (explain + enable)
  if (!locationGranted) {
    return (
      <LocationPermissionScreen
        onRequest={(granted) => setLocationGranted(granted)}
        onSkip={() => setLocationGranted(true)}
      />
    );
  }

  // 6. Everything good → role navigator
  if (user.role === 'CUSTOMER') return <CustomerNavigator />;
  if (user.role === 'DRIVER')   return <DriverNavigator />;
  return <PartnerNavigator />;
};

// ── Minimal Stack ─────────────────────────────────────────────────────────────
const AppNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Root" component={RootScreen} />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  loading:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingTxt: { marginTop: 12, fontSize: 15, fontWeight: '500' },
});

export default AppNavigator;