// mobile/src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Ride API
export const rideAPI = {
  getEstimate: (params) => api.get('/rides/estimate', { params }),
  requestRide: (data) => api.post('/rides/request', data),
  getActiveRide: () => api.get('/rides/active'),
  getRideHistory: (params) => api.get('/rides/history', { params }),
  acceptRide: (id) => api.put(`/rides/${id}/accept`),
  startRide: (id) => api.put(`/rides/${id}/start`),
  completeRide: (id, data) => api.put(`/rides/${id}/complete`, data),
  cancelRide: (id, data) => api.put(`/rides/${id}/cancel`, data),
};

// Delivery API
export const deliveryAPI = {
  getEstimate: (params) => api.get('/deliveries/estimate', { params }),
  requestDelivery: (data) => api.post('/deliveries/request', data),
  getActiveDelivery: () => api.get('/deliveries/active'),
  acceptDelivery: (id) => api.put(`/deliveries/${id}/accept`),
  pickupDelivery: (id) => api.put(`/deliveries/${id}/pickup`),
  completeDelivery: (id, data) => api.put(`/deliveries/${id}/complete`, data),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  getStats: () => api.get('/users/stats'),
};

// Driver API
export const driverAPI = {
  getProfile: () => api.get('/drivers/profile'),
  updateProfile: (data) => api.post('/drivers/profile', data),
  updateStatus: (data) => api.put('/drivers/status', data),
  getEarnings: () => api.get('/drivers/earnings'),
  getNearbyRequests: () => api.get('/drivers/nearby-requests'),
};

// Partner API
export const partnerAPI = {
  getProfile: () => api.get('/partners/profile'),
  updateProfile: (data) => api.post('/partners/profile', data),
  updateStatus: (data) => api.put('/partners/status', data),
  getEarnings: () => api.get('/partners/earnings'),
  getNearbyRequests: () => api.get('/partners/nearby-requests'),
};

export default api;