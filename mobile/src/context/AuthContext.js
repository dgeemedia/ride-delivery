// mobile/src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import socketService from '../services/socket';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStoredAuth(); }, []);

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

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
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
        message: error.response?.data?.message || 'Login failed',
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
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
  // responds immediately on web (where AsyncStorage & network can be slow).
  // The backend call and storage cleanup happen after in the background.
  // ─────────────────────────────────────────────────────────────────────────
  const logout = async () => {
    // 1. Immediately clear React state → UI navigates to Auth screen right away
    setToken(null);
    setUser(null);

    // 2. Disconnect socket
    try { socketService.disconnect(); } catch {}

    // 3. Clear persisted storage (non-blocking — failure is acceptable)
    try {
      await AsyncStorage.multiRemove(['authToken', 'user']);
    } catch (e) {
      console.warn('AsyncStorage clear failed (non-critical):', e);
    }

    // 4. Tell the backend to invalidate the session (non-blocking)
    try { await authAPI.logout(); } catch {}
  };

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