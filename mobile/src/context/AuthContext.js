// mobile/src/context/AuthContext.js
import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { authAPI } from '../services/api';
import { onForceLogout } from '../services/authEvents';
import socketService from '../services/socket';

const AuthContext = createContext();

const getOrCreateDeviceId = async () => {
  try {
    let id = await AsyncStorage.getItem('deviceId');
    if (!id) {
      id =
        Date.now().toString(36) + '-' +
        Math.random().toString(36).substring(2, 10) + '-' +
        Math.random().toString(36).substring(2, 10);
      await AsyncStorage.setItem('deviceId', id);
    }
    return id;
  } catch {
    return 'fallback-' + Math.random().toString(36).substring(2);
  }
};

export const AuthProvider = ({ children }) => {
  const [user,            setUser]           = useState(null);
  const [token,           setToken]          = useState(null);
  const [loading,         setLoading]        = useState(true);
  const [biometricLocked, setBiometricLocked] = useState(false);

  const logoutRef = useRef(null);

  useEffect(() => { loadStoredAuth(); }, []);

  useEffect(() => {
    const unsubscribe = onForceLogout((reason) => {
      setToken(null);
      setUser(null);
      setBiometricLocked(false);
      try { socketService.disconnect(); } catch {}
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

  // ─────────────────────────────────────────────────────────────────────────
  // biometricLogin
  // Called from LoginScreen after on-device biometric passes.
  // Uses the SecureStore token to call /auth/me and restore the full session
  // by updating React state directly — no navigation tricks needed.
  //
  // Returns { success: true } or { success: false, message }
  // ─────────────────────────────────────────────────────────────────────────
  const biometricLogin = async (secureToken) => {
    try {
      // Temporarily write the token so the request interceptor can attach it
      await AsyncStorage.setItem('authToken', secureToken);

      const response = await authAPI.getCurrentUser();
      const { user: u } = response.data;

      // Session is valid — persist and update state
      await _persistSession(u, secureToken);
      return { success: true };
    } catch (error) {
      // Token expired or invalid — clean up so we don't keep a dead token
      await AsyncStorage.multiRemove(['authToken', 'user']).catch(() => {});
      const message =
        error.response?.status === 401
          ? 'Your session has expired. Please sign in with your password.'
          : error.message || 'Biometric login failed.';
      return { success: false, message };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // login
  // ─────────────────────────────────────────────────────────────────────────
  const login = async (credentials) => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await authAPI.login({ ...credentials, deviceId });

      if (response.requiresOtp) {
        return {
          success:       true,
          requiresOtp:   true,
          tempToken:     response.data.tempToken,
          method:        response.data.method,
          maskedContact: response.data.maskedContact,
        };
      }

      const { user: u, token: t } = response.data;
      await _persistSession(u, t);
      return { success: true, token: t };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        error.message || 'Login failed';
      return { success: false, message };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // verifyOtp — completes 2FA login
  // ─────────────────────────────────────────────────────────────────────────
  const verifyOtp = async (code, tempToken) => {
    try {
      const response = await authAPI.verifyOtp({ code, tempToken });
      const { user: u, token: t } = response.data;
      await _persistSession(u, t);
      return { success: true, token: t };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Verification failed',
      };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // resendOtp
  // ─────────────────────────────────────────────────────────────────────────
  const resendOtp = async (tempToken) => {
    try {
      const response = await authAPI.resendOtp({ tempToken });
      return { success: true, ...response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Could not resend code',
      };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // register
  // ─────────────────────────────────────────────────────────────────────────
  const register = async (userData) => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await authAPI.register({ ...userData, deviceId });
      const { user: u, token: t } = response.data;
      await _persistSession(u, t);
      return { success: true, token: t };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Biometric lock / unlock
  // ─────────────────────────────────────────────────────────────────────────
  const biometricLock   = () => setBiometricLocked(true);
  const biometricUnlock = () => setBiometricLocked(false);

  // ─────────────────────────────────────────────────────────────────────────
  // updateUser / logout
  // ─────────────────────────────────────────────────────────────────────────
  const updateUser = async (updatedFields) => {
    const updated = { ...user, ...updatedFields };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setBiometricLocked(false);
    try { socketService.disconnect(); } catch {}
    try { await AsyncStorage.multiRemove(['authToken', 'user']); } catch {}
    try { await authAPI.logout(); } catch {}
  };

  logoutRef.current = logout;

  // ─────────────────────────────────────────────────────────────────────────
  // _persistSession — write storage + update all React state in one shot
  // ─────────────────────────────────────────────────────────────────────────
  const _persistSession = async (u, t) => {
    await AsyncStorage.setItem('authToken', t);
    await AsyncStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
    setBiometricLocked(false);
    socketService.connect().catch(() => {});
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      biometricLocked,
      login, register, logout, updateUser,
      biometricLogin,
      verifyOtp, resendOtp,
      biometricLock, biometricUnlock,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};