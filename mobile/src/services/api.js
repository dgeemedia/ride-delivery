// mobile/src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — unwrap .data, handle 401
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

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register:       (data) => api.post('/auth/register', data),
  login:          (data) => api.post('/auth/login', data),
  getCurrentUser: ()     => api.get('/auth/me'),
  logout:         ()     => api.post('/auth/logout'),
};

// ── Ride ──────────────────────────────────────────────────────────────────────
export const rideAPI = {
  getEstimate:   (params)     => api.get('/rides/estimate', { params }),
  requestRide:   (data)       => api.post('/rides/request', data),
  getActiveRide: ()           => api.get('/rides/active'),
  getRideHistory:(params)     => api.get('/rides/history', { params }),
  getRideById:   (id)         => api.get(`/rides/${id}`),

  // Driver actions
  acceptRide:        (id)       => api.put(`/rides/${id}/accept`),
  arrivedAtPickup:   (id)       => api.put(`/rides/${id}/arrived`),  // ← was missing
  startRide:         (id)       => api.put(`/rides/${id}/start`),
  completeRide:      (id, data) => api.put(`/rides/${id}/complete`, data),
  cancelRide:        (id, data) => api.put(`/rides/${id}/cancel`, data),

  // Customer — find & book a specific driver
  getNearbyDrivers:      (params) => api.get('/rides/nearby-drivers', { params }),
  requestSpecificDriver: (data)   => api.post('/rides/request-driver', data),
};

// ── Delivery ──────────────────────────────────────────────────────────────────
export const deliveryAPI = {
  getEstimate:       (params)     => api.get('/deliveries/estimate', { params }),
  requestDelivery:   (data)       => api.post('/deliveries/request', data),
  getActiveDelivery: ()           => api.get('/deliveries/active'),
  acceptDelivery:    (id)         => api.put(`/deliveries/${id}/accept`),
  pickupDelivery:    (id)         => api.put(`/deliveries/${id}/pickup`),
  completeDelivery:  (id, data)   => api.put(`/deliveries/${id}/complete`, data),
  getNearbyPartners: (params)     => api.get('/deliveries/nearby-partners', { params }),
};

// ── User ──────────────────────────────────────────────────────────────────────
export const userAPI = {
  getProfile:    ()     => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  getStats:      ()     => api.get('/users/stats'),
};

// ── Driver ────────────────────────────────────────────────────────────────────
export const driverAPI = {
  getProfile:        ()     => api.get('/drivers/profile'),
  updateProfile:     (data) => api.post('/drivers/profile', data),
  updateStatus:      (data) => api.put('/drivers/status', data),
  getEarnings:       ()     => api.get('/drivers/earnings'),
  getNearbyRequests: ()     => api.get('/drivers/nearby-requests'),
};

// ── Partner ───────────────────────────────────────────────────────────────────
export const partnerAPI = {
  getProfile:        ()     => api.get('/partners/profile'),
  updateProfile:     (data) => api.post('/partners/profile', data),
  updateStatus:      (data) => api.put('/partners/status', data),
  getEarnings:       ()     => api.get('/partners/earnings'),
  getNearbyRequests: ()     => api.get('/partners/nearby-requests'),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  getUnreadCount:   ()       => api.get('/notifications/count'),
  markAsRead:       (id)     => api.put(`/notifications/${id}/read`),
  markAllAsRead:    ()       => api.put('/notifications/read-all'),
  deleteOne:        (id)     => api.delete(`/notifications/${id}`),
  clearAll:         ()       => api.delete('/notifications'),
};

// ── Wallet ────────────────────────────────────────────────────────────────────
export const walletAPI = {
  getWallet:              ()       => api.get('/wallet'),
  getTransactions:        (params) => api.get('/wallet/transactions', { params }),
  paystackTopup:          (data)   => api.post('/wallet/topup/paystack', data),
  verifyPaystackTopup:    (data)   => api.post('/wallet/topup/paystack/verify', data),
  flutterwaveTopup:       (data)   => api.post('/wallet/topup/flutterwave', data),
  verifyFlutterwaveTopup: (data)   => api.post('/wallet/topup/flutterwave/verify', data),
  transfer:               (data)   => api.post('/wallet/transfer', data),
  withdraw:               (data)   => api.post('/wallet/withdraw', data),
};

export default api;