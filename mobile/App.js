// mobile/App.js
import React, { useEffect, useCallback, useState } from 'react';
import { Platform, View, StyleSheet, AppState } from 'react-native';   // ✅ Platform now imported
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider }     from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { RideProvider }     from './src/context/RideContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator         from './src/navigation/AppNavigator';
import ErrorBoundary        from './src/components/ErrorBoundary';
import socketService        from './src/services/socket';

// Keep splash visible until we explicitly hide it
SplashScreen.preventAutoHideAsync().catch(() => {});

// ── Inner shell — has access to ThemeContext ──────────────────────────────────
function AppShell({ onLayout }) {
  const { theme, mode } = useTheme();

  return (
    <NavigationContainer>
      <View
        style={[styles.root, { backgroundColor: theme.background }]}
        onLayout={onLayout}
      >
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <AppNavigator />
      </View>
    </NavigationContainer>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────
export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.warn('[App] prepare error:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {

    const sub = AppState.addEventListener('change', (state) => {

      if (state === 'active') {

        socketService.handleAppForeground();

      }

    });

    return () => sub.remove();

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
                <AppShell onLayout={onLayoutRootView} />
              </LocationProvider>
            </RideProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#111111' },
  root:   { flex: 1 },
});