// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    await AsyncStorage.setItem('authToken', response.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    setToken(response.data.token);
    setUser(response.data.user);
    return response;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    await AsyncStorage.setItem('authToken', response.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    setToken(response.data.token);
    setUser(response.data.user);
    return response;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);