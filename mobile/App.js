// mobile/App.js
import React, { useEffect, useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';

// Keep the splash screen visible while we fetch resources / auth state.
// This MUST be called before any rendering happens.
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Add any async pre-load work here (fonts, cached assets, etc.)
        // For now a short artificial delay ensures the splash renders
        // at least one frame so the logo is visible on every device.
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.warn('[App] prepare error:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Hide the splash screen once our root view has laid out.
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    // Still loading — keep splash screen visible, render nothing.
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <LocationProvider>
            <NavigationContainer>
              {/* onLayout fires after first render, then we hide splash */}
              <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
                <StatusBar style="auto" />
                <AppNavigator />
              </View>
            </NavigationContainer>
          </LocationProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}