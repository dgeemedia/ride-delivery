// mobile/src/hooks/useInactivityLogout.js
import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation, CommonActions } from '@react-navigation/native';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export const useInactivityLogout = () => {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const timeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      console.log('Inactivity timeout reached → logging out');
      
      await logout(); // Clear token and user data

      // Use CommonActions.reset to safely reset to root Login screen
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Auth', params: { screen: 'Login' } }],
        })
      );
    }, INACTIVITY_TIMEOUT);
  }, [logout, navigation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        resetTimer(); // App returned to foreground
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        resetTimer(); // App went to background → start inactivity timer
      }
      appStateRef.current = nextAppState;
    });

    resetTimer(); // Start initial timer

    return () => {
      subscription.remove();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer]);
};