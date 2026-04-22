// mobile/App.js
import React, { useEffect, useCallback, useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';   // ✅ Platform now imported
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

// ✅ REMOVED: expo-navigation-bar 'absolute' mode — this was the root cause.
//    Setting the nav bar to absolute made it float OVER the app, and the tab
//    bar was not tall enough to clear it. Now the system nav bar pushes the
//    app content up naturally, and safe-area insets are zero on the bottom,
//    so the tab bar sits cleanly above it with no overlap.

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