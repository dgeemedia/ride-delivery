// mobile/src/hooks/useInactivityLogout.js
// ─────────────────────────────────────────────────────────────────────────────
// Three-tier security:
//
//  1. App goes to background (phone locked / switched apps)
//     → If biometric is enabled: lock the UI (BiometricLockScreen)
//       without destroying the session. User must verify on return.
//     → If biometric is NOT enabled: start BACKGROUND_GRACE_MS timer.
//       If the app doesn't return in time, full logout.
//
//  2. App returns to foreground
//     → Cancel background grace timer (if running).
//     → Restart foreground inactivity timer.
//     → If biometric-locked: BiometricLockScreen handles the prompt.
//
//  3. Foreground inactivity (no user interaction for INACTIVITY_TIMEOUT_MS)
//     → Full logout regardless of biometric state.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth }      from '../context/AuthContext';
import { useBiometric } from './useBiometric';

const BACKGROUND_GRACE_MS  = 30 * 1000;       // 30 seconds
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

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

  // ── Foreground inactivity timer — full logout after idle ──────────────────
  const resetTimer = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      console.log('[Security] Foreground inactivity timeout → logging out');
      logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  // ── AppState handler ───────────────────────────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active') {
        // Returned to foreground — cancel background timer, restart inactivity
        if (backgroundRef.current) {
          clearTimeout(backgroundRef.current);
          backgroundRef.current = null;
        }
        resetTimer();
        // Note: if biometricLocked === true, AppNavigator is already showing
        // BiometricLockScreen. We don't need to trigger the prompt here.
      } else if (
        (prev === 'active' || prev === 'inactive') &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        // App moved to background
        if (bioEnabled) {
          // Biometric enrolled → lock UI immediately (session preserved)
          console.log('[Security] App backgrounded + biometric enabled → locking');
          biometricLock();
        } else {
          // No biometric → grace-period timer before full logout
          if (backgroundRef.current) clearTimeout(backgroundRef.current);
          backgroundRef.current = setTimeout(() => {
            console.log('[Security] Background grace period expired → logging out');
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

  // Expose resetTimer so screens can call it on user interactions
  return { resetTimer };
};