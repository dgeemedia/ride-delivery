// mobile/src/hooks/useInactivityLogout.js
// ─────────────────────────────────────────────────────────────────────────────
// Two-tier security:
//  1. App goes to background → logout after BACKGROUND_GRACE_MS (default 30 s).
//     This covers "closed from recent apps" and "phone locked" scenarios.
//     A short grace period avoids signing the user out if they just switch apps
//     briefly (e.g. to copy a phone number).
//
//  2. App stays in foreground but is idle → logout after INACTIVITY_TIMEOUT
//     (default 10 min). Call resetTimer() on any user interaction (tap, scroll).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';

// How long the app can be in the background before the session is killed.
// 30 seconds is short enough to be secure, long enough not to irritate someone
// who briefly switches to their camera or contacts.
const BACKGROUND_GRACE_MS = 30 * 1000;

// How long the app can sit idle in the foreground before logging out.
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

export const useInactivityLogout = () => {
  const { logout } = useAuth();
  const inactivityRef = useRef(null);
  const backgroundRef = useRef(null);
  const appStateRef   = useRef(AppState.currentState);

  // ── Clear both timers ───────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    if (backgroundRef.current) clearTimeout(backgroundRef.current);
  }, []);

  // ── Reset the in-foreground inactivity timer ────────────────────────────────
  const resetTimer = useCallback(() => {
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      console.log('[Security] Inactivity timeout → logging out');
      logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  // ── AppState change handler ─────────────────────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'active') {
        // App came back to foreground — cancel the background timer and
        // restart the foreground inactivity timer.
        if (backgroundRef.current) {
          clearTimeout(backgroundRef.current);
          backgroundRef.current = null;
        }
        resetTimer();
      } else if (
        (prev === 'active' || prev === 'inactive') &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        // App moved to background / phone locked.
        // Start a grace-period timer; if the app isn't foregrounded within it,
        // log the user out.
        if (backgroundRef.current) clearTimeout(backgroundRef.current);
        backgroundRef.current = setTimeout(() => {
          console.log('[Security] Background grace period expired → logging out');
          logout();
        }, BACKGROUND_GRACE_MS);
      }
    });

    // Kick off the initial foreground inactivity timer
    resetTimer();

    return () => {
      subscription.remove();
      clearTimers();
    };
  }, [resetTimer, logout, clearTimers]);

  // Return resetTimer so screens can call it on user interactions
  // e.g. wrap a ScrollView's onScroll, or call on any button press.
  return { resetTimer };
};