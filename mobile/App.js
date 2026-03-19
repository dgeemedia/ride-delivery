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
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator         from './src/navigation/AppNavigator';
import ErrorBoundary        from './src/components/ErrorBoundary';

// Keep splash visible until we explicitly hide it
SplashScreen.preventAutoHideAsync().catch(() => {});

// ── Inner shell — has access to ThemeContext ──────────────────────────────────
// We separate this so NavigationContainer and StatusBar can read the live theme.
function AppShell({ onLayout }) {
  const { theme, mode } = useTheme();

  return (
    <NavigationContainer>
      <View
        style={[styles.root, { backgroundColor: theme.background }]}
        onLayout={onLayout}
      >
        {/* StatusBar style follows theme mode */}
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
        // Minimum splash hold — replace with real asset pre-loading if needed
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.warn('[App] prepare error:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  // onLayout fires once the root view is painted — safe to hide splash here.
  // AppNavigator additionally waits for themeLoaded before rendering, so the
  // correct background is always painted before the splash disappears.
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Already hidden on hot-reload — safe to ignore
      }
    }
  }, [appIsReady]);

  // Render a solid dark placeholder while JS initialises.
  // This prevents the white flash between bundle load and first paint.
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
  splash: { flex: 1, backgroundColor: '#111111' }, // matches onyx dark background
  root:   { flex: 1 },
});