// mobile/App.js
import React, { useEffect, useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import { AuthProvider }     from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import { RideProvider }     from './src/context/RideContext';
import { ThemeProvider }    from './src/context/ThemeContext';
import AppNavigator         from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
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
    if (appIsReady) await SplashScreen.hideAsync();
  }, [appIsReady]);

  if (!appIsReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          {/* RideProvider must be inside AuthProvider so it can access the token */}
          <RideProvider>
            <LocationProvider>
              <NavigationContainer>
                <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
                  <StatusBar style="auto" />
                  <AppNavigator />
                </View>
              </NavigationContainer>
            </LocationProvider>
          </RideProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}