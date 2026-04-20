// mobile/src/context/AuthContext.js
import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { authAPI } from '../services/api';
import { onForceLogout } from '../services/authEvents';
import socketService from '../services/socket';

const AuthContext = createContext();

// ── Device ID helper (duplicated here so AuthContext is self-contained) ───────
// api.js also uses this helper — both read from the same AsyncStorage key,
// so the ID is always consistent within the same app installation.
const getOrCreateDeviceId = async () => {
  try {
    let id = await AsyncStorage.getItem('deviceId');
    if (!id) {
      id =
        Date.now().toString(36) +
        '-' +
        Math.random().toString(36).substring(2, 10) +
        '-' +
        Math.random().toString(36).substring(2, 10);
      await AsyncStorage.setItem('deviceId', id);
    }
    return id;
  } catch {
    return 'fallback-' + Math.random().toString(36).substring(2);
  }
};

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Keep a ref to the latest logout so the force-logout listener always
  // calls the most-recent version without needing to re-subscribe.
  const logoutRef = useRef(null);

  useEffect(() => { loadStoredAuth(); }, []);

  // ── Subscribe to force-logout events from the API 401 interceptor ──────────
  useEffect(() => {
    const unsubscribe = onForceLogout((reason) => {
      console.log('[AuthContext] force-logout received, reason:', reason);

      // Clear React state immediately (UI redirects to Auth via AppNavigator)
      setToken(null);
      setUser(null);

      // Disconnect socket
      try { socketService.disconnect(); } catch {}

      // Inform the user why they were signed out
      const message =
        reason === 'device_conflict'
          ? 'Your account was signed in on another device. You have been signed out.'
          : 'Your session has expired. Please sign in again.';

      Alert.alert('Signed Out', message);
    });

    return unsubscribe;
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUser] = await AsyncStorage.multiGet(['authToken', 'user']);
      const t = storedToken[1];
      const u = storedUser[1];
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
        socketService.connect().catch(() => {});
      }
    } catch (e) {
      console.error('Error loading auth:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Login — sends deviceId so the backend can enforce single-device policy ──
  const login = async (credentials) => {
    try {
      const deviceId = await getOrCreateDeviceId();

      // Pass deviceId in the body — backend uses it to invalidate other sessions
      const response = await authAPI.login({ ...credentials, deviceId });

      const { user: u, token: t } = response.data;

      await AsyncStorage.setItem('authToken', t);
      await AsyncStorage.setItem('user', JSON.stringify(u));
      setToken(t);
      setUser(u);
      socketService.connect().catch(() => {});
      return { success: true };
    } catch (error) {
      console.log('LOGIN ERROR FULL:', error.response?.data);
      const message =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        error.message ||
        'Login failed';
      return { success: false, message };
    }
  };

  const register = async (userData) => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await authAPI.register({ ...userData, deviceId });
      const { user: u, token: t } = response.data;
      await AsyncStorage.setItem('authToken', t);
      await AsyncStorage.setItem('user', JSON.stringify(u));
      setToken(t);
      setUser(u);
      socketService.connect().catch(() => {});
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const updateUser = async (updatedFields) => {
    const updated = { ...user, ...updatedFields };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // logout — state is cleared FIRST, unconditionally, so the UI always
  // responds immediately. Backend call and storage cleanup happen after.
  // ─────────────────────────────────────────────────────────────────────────
  const logout = async () => {
    // 1. Immediately clear React state → AppNavigator redirects to Auth
    setToken(null);
    setUser(null);

    // 2. Disconnect socket
    try { socketService.disconnect(); } catch {}

    // 3. Clear persisted storage (non-blocking)
    try {
      await AsyncStorage.multiRemove(['authToken', 'user']);
    } catch (e) {
      console.warn('AsyncStorage clear failed (non-critical):', e);
    }

    // 4. Tell the backend to invalidate the session (non-blocking)
    try { await authAPI.logout(); } catch {}
  };

  // Keep ref in sync so the force-logout closure can call it
  logoutRef.current = logout;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};