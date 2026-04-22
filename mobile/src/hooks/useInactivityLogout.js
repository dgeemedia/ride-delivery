// mobile/src/hooks/useInactivityLogout.js
import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth }      from '../context/AuthContext';
import { useBiometric } from './useBiometric';

const BACKGROUND_GRACE_MS   = 30 * 1000;       // 30 s  — non-biometric full logout
const BIOMETRIC_GRACE_MS    =  2 * 1000;       // 2 s   — biometric lock grace (new)
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — foreground idle logout

export const useInactivityLogout = () => {
  const { logout, biometricLock } = useAuth();
  const { isEnabled: bioEnabled }  = useBiometric();

  const inactivityRef = useRef(null);
  const backgroundRef = useRef(null);
  const appStateRef   = useRef(AppState.currentState);

  const clearTimers = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (backgroundRef.current) clearTimeout(backgroundRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      console.log('[Security] Foreground inactivity timeout → logging out');
      logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active') {
        // Returned to foreground — cancel any pending lock/logout timer
        if (backgroundRef.current) {
          clearTimeout(backgroundRef.current);
          backgroundRef.current = null;
        }
        resetTimer();

      } else if (prev === 'active' && nextState === 'background') {
        // ✅ Only react to a direct active → background transition.
        //    Ignore 'inactive' — it's transient on iOS (alerts, gestures, navigation).
        if (bioEnabled) {
          // Small grace period so system dialogs / mid-navigation don't false-trigger
          if (backgroundRef.current) clearTimeout(backgroundRef.current);
          backgroundRef.current = setTimeout(() => {
            console.log('[Security] App backgrounded + biometric → locking');
            biometricLock();
          }, BIOMETRIC_GRACE_MS);
        } else {
          if (backgroundRef.current) clearTimeout(backgroundRef.current);
          backgroundRef.current = setTimeout(() => {
            console.log('[Security] Background grace expired → logging out');
            logout();
          }, BACKGROUND_GRACE_MS);
        }
      }
    });

    resetTimer();

    return () => {
      subscription.remove();
      clearTimers();
    };
  }, [resetTimer, logout, biometricLock, bioEnabled, clearTimers]);

  return { resetTimer };
};