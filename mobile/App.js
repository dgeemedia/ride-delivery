// mobile/App.js
import React, { useEffect, useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { View, StyleSheet } from 'react-native';
import { AuthProvider }     from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { RideProvider }     from './src/context/RideContext';
import { ThemeProvider }    from './src/context/ThemeContext';
import AppNavigator         from './src/navigation/AppNavigator';
import ErrorBoundary        from './src/components/ErrorBoundary';

// Keep splash visible until we explicitly hide it
SplashScreen.preventAutoHideAsync().catch(() => {
  // preventAutoHideAsync can throw if splash was already hidden (e.g. hot-reload)
  // Safe to ignore.
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Minimum splash duration — swap this for real asset pre-loading
        await new Promise(resolve => setTimeout(resolve, 400));
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
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Already hidden on hot-reload — safe to ignore
      }
    }
  }, [appIsReady]);

  // Render a dark-background placeholder while getting ready.
  // This prevents the white flash between JS load and first render.
  if (!appIsReady) {
    return <View style={styles.splash} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <RideProvider>
              <LocationProvider>
                <NavigationContainer>
                  {/* onLayout fires once the root view is painted — safe to hide splash here */}
                  <View style={styles.root} onLayout={onLayoutRootView}>
                    <StatusBar style="auto" />
                    <AppNavigator />
                  </View>
                </NavigationContainer>
              </LocationProvider>
            </RideProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#080C18' },
  root:   { flex: 1, backgroundColor: '#080C18' },
});