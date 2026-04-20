// mobile/src/hooks/useBiometric.js
// ── Biometric authentication hook ────────────────────────────────────────────
// Uses expo-local-authentication for on-device verification.
// The token is stored in expo-secure-store so it can't be read without
// OS-level permission. Biometric just acts as the key to unlock it.
//
// Install:  npx expo install expo-local-authentication expo-secure-store
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore         from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';
const SECURE_TOKEN_KEY      = 'secureAuthToken';

export const useBiometric = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled,   setIsEnabled]   = useState(false);
  const [biometricType, setBiometricType] = useState(null); // 'fingerprint' | 'faceid' | 'iris'

  // ── Check device capability and user preference on mount ─────────────────
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      const capable    = compatible && enrolled;
      setIsAvailable(capable);

      if (capable) {
        // Get the biometric type(s) available on this device
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))
          setBiometricType('faceid');
        else if (types.includes(LocalAuthentication.AuthenticationType.IRIS))
          setBiometricType('iris');
        else
          setBiometricType('fingerprint');
      }

      // Load saved preference
      try {
        const stored = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        setIsEnabled(stored === 'true');
      } catch {
        setIsEnabled(false);
      }
    })();
  }, []);

  // ── Prompt the user to authenticate biometrically ─────────────────────────
  // Returns true if authentication succeeded, false otherwise.
  const authenticate = useCallback(async () => {
    if (!isAvailable) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:       'Verify your identity',
        fallbackLabel:       'Use PIN',
        cancelLabel:         'Cancel',
        disableDeviceFallback: false, // allow PIN/pattern fallback
      });
      return result.success;
    } catch {
      return false;
    }
  }, [isAvailable]);

  // ── Store token in SecureStore and mark biometric as enabled ──────────────
  // Call this immediately after a successful password login when the user
  // opts in to biometric login.
  const enable = useCallback(async (token) => {
    try {
      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      setIsEnabled(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Remove biometric enrollment ───────────────────────────────────────────
  const disable = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(false);
    } catch {}
  }, []);

  // ── Retrieve the securely stored token (after biometric passes) ───────────
  const getSecureToken = useCallback(async () => {
    try {
      return await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    } catch {
      return null;
    }
  }, []);

  // ── Update the stored token (call after every successful normal login) ────
  // This keeps the secure token fresh so biometric login stays valid.
  const updateSecureToken = useCallback(async (token) => {
    if (!isEnabled) return;
    try {
      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
    } catch {}
  }, [isEnabled]);

  return {
    isAvailable,
    isEnabled,
    biometricType,  // 'fingerprint' | 'faceid' | 'iris' | null
    authenticate,
    enable,
    disable,
    getSecureToken,
    updateSecureToken,
  };
};