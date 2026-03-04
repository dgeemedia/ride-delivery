import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

// Create axios instance
const api = axios.create({
  baseURL: Config.API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      // Navigate to login screen
      // This will be handled by navigation context
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
  getRideById: (id) => api.get(`/rides/${id}`),
  acceptRide: (id) => api.put(`/rides/${id}/accept`),
  startRide: (id) => api.put(`/rides/${id}/start`),
  completeRide: (id, data) => api.put(`/rides/${id}/complete`, data),
  cancelRide: (id, data) => api.put(`/rides/${id}/cancel`, data),
  rateRide: (id, data) => api.post(`/rides/${id}/rate`, data),
};

// Delivery API
export const deliveryAPI = {
  getEstimate: (params) => api.get('/deliveries/estimate', { params }),
  requestDelivery: (data) => api.post('/deliveries/request', data),
  getActiveDelivery: () => api.get('/deliveries/active'),
  getDeliveryHistory: (params) => api.get('/deliveries/history', { params }),
  acceptDelivery: (id) => api.put(`/deliveries/${id}/accept`),
  pickupDelivery: (id) => api.put(`/deliveries/${id}/pickup`),
  completeDelivery: (id, data) => api.put(`/deliveries/${id}/deliver`, data),
  cancelDelivery: (id, data) => api.put(`/deliveries/${id}/cancel`, data),
};

// Driver API
export const driverAPI = {
  getProfile: () => api.get('/drivers/profile'),
  updateProfile: (data) => api.post('/drivers/profile', data),
  updateStatus: (data) => api.put('/drivers/status', data),
  getEarnings: () => api.get('/drivers/earnings'),
  getStats: () => api.get('/drivers/stats'),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
};

// Payment API
export const paymentAPI = {
  processPayment: (data) => api.post('/payments/process', data),
  getHistory: (params) => api.get('/payments/history', { params }),
  getPaymentById: (id) => api.get(`/payments/${id}`),
  addCard: (data) => api.post('/payments/card/add', data),
  getCards: () => api.get('/payments/cards'),
  removeCard: (id) => api.delete(`/payments/card/${id}`),
};

// FUTURE: Add more API endpoints
// - Notifications
// - Support/Help
// - Referrals
// - Promo codes

export default api;