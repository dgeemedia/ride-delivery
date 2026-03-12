// mobile/src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import socketService from '../services/socket';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStoredAuth(); }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser  = await AsyncStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
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

      // ─────────────────────────────────────────────────────────────────
      // DEV MODE: Email verification is BYPASSED.
      // The account is active immediately after registration.
      //
      // TODO (PRODUCTION): Integrate Twilio Verify or SendGrid here.
      //   1. In auth.controller.js → register(), send the verifyToken via:
      //      - Twilio SMS:  twilioClient.verify.v2.services(SID).verifications.create(...)
      //      - SendGrid:    sendgrid.send({ to: email, subject: 'Verify', html: link })
      //   2. Add a VerifyEmailScreen.js that accepts the 6-digit code / link.
      //   3. Gate navigation: if (!u.isVerified) navigate to VerifyEmailScreen.
      //   4. On success call POST /api/auth/verify-email/:token, then proceed.
      // ─────────────────────────────────────────────────────────────────

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

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    await AsyncStorage.multiRemove(['authToken', 'user']);
    socketService.disconnect();
    setToken(null);
    setUser(null);
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