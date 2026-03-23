// mobile/src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach auth token ───────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — unwrap .data, handle 401 ──────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
export const authAPI = {
  register:       (data) => api.post('/auth/register', data),
  login:          (data) => api.post('/auth/login', data),
  getCurrentUser: ()     => api.get('/auth/me'),
  logout:         ()     => api.post('/auth/logout'),
};

// ─────────────────────────────────────────────────────────────────────────────
// RIDE
// ─────────────────────────────────────────────────────────────────────────────
export const rideAPI = {
  getEstimate:   (params)     => api.get('/rides/estimate', { params }),
  requestRide:   (data)       => api.post('/rides/request', data),
  getActiveRide: ()           => api.get('/rides/active'),
  getRideHistory:(params)     => api.get('/rides/history', { params }),
  getRideById:   (id)         => api.get(`/rides/${id}`),

  // Driver actions
  acceptRide:        (id)       => api.put(`/rides/${id}/accept`),
  arrivedAtPickup:   (id)       => api.put(`/rides/${id}/arrived`),
  startRide:         (id)       => api.put(`/rides/${id}/start`),
  completeRide:      (id, data) => api.put(`/rides/${id}/complete`, data),
  cancelRide:        (id, data) => api.put(`/rides/${id}/cancel`, data),

  // Customer — find & book a specific driver
  getNearbyDrivers:      (params) => api.get('/rides/nearby-drivers', { params }),
  requestSpecificDriver: (data)   => api.post('/rides/request-driver', data),
};

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY
// ─────────────────────────────────────────────────────────────────────────────
export const deliveryAPI = {
  getEstimate:        (params)   => api.get('/deliveries/estimate', { params }),
  requestDelivery:    (data)     => api.post('/deliveries/request', data),
  getActiveDelivery:  ()         => api.get('/deliveries/active'),
  getDeliveryById:    (id)       => api.get(`/deliveries/${id}`),
  acceptDelivery:     (id)       => api.put(`/deliveries/${id}/accept`),
  pickupDelivery:     (id)       => api.put(`/deliveries/${id}/pickup`),
  startTransit:       (id)       => api.put(`/deliveries/${id}/transit`),
  completeDelivery:   (id, data) => api.put(`/deliveries/${id}/complete`, data),
  cancelDelivery:     (id, data) => api.put(`/deliveries/${id}/cancel`, data),
  rateDelivery:       (id, data) => api.post(`/deliveries/${id}/rate`, data),
  getDeliveryHistory: (params)   => api.get('/deliveries/history', { params }),
  getNearbyPartners:  (params)   => api.get('/deliveries/nearby-partners', { params }),
};

// ─────────────────────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────────────────────
export const userAPI = {
  getProfile:    ()     => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  getStats:      ()     => api.get('/users/stats'),
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER
// ─────────────────────────────────────────────────────────────────────────────
export const driverAPI = {
  getProfile:         ()       => api.get('/drivers/profile'),
  updateProfile:      (data)   => api.post('/drivers/profile', data),
  updateStatus:       (data)   => api.put('/drivers/status', data),
  getEarnings:        (params) => api.get('/drivers/earnings', { params }),
  getStats:           ()       => api.get('/drivers/stats'),
  getNearbyRequests:  ()       => api.get('/drivers/nearby-requests'),

  // Payout (goes through admin approval flow)
  requestPayout:      (data)   => api.post('/drivers/payout/request', data),
  getPayoutHistory:   (params) => api.get('/drivers/payout/history', { params }),
};

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER
// ─────────────────────────────────────────────────────────────────────────────
export const partnerAPI = {
  getProfile:         ()        => api.get('/partners/profile'),
  updateProfile:      (data)    => api.post('/partners/profile', data),
  updateStatus:       (data)    => api.put('/partners/status', data),
  getEarnings:        (params)  => api.get('/partners/earnings', { params }),
  getStats:           ()        => api.get('/partners/stats'),
  getNearbyRequests:  ()        => api.get('/partners/nearby-requests'),
  updateFloorPrice:   (price)   => api.post('/partners/profile', { preferredFloorPrice: price }),

  // Payout (goes through admin approval flow)
  requestPayout:      (data)    => api.post('/partners/payout/request', data),
  getPayoutHistory:   (params)  => api.get('/partners/payout/history', { params }),
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const notificationAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  getUnreadCount:   ()       => api.get('/notifications/count'),
  markAsRead:       (id)     => api.put(`/notifications/${id}/read`),
  markAllAsRead:    ()       => api.put('/notifications/read-all'),
  deleteOne:        (id)     => api.delete(`/notifications/${id}`),
  clearAll:         ()       => api.delete('/notifications'),
};

// ─────────────────────────────────────────────────────────────────────────────
// WALLET
// All methods that require auth — the webhook /topup/verify is public-only
// and called directly by Paystack, not from the mobile app.
// ─────────────────────────────────────────────────────────────────────────────
export const walletAPI = {
  // Balance & history
  getWallet:              ()       => api.get('/wallet'),
  getTransactions:        (params) => api.get('/wallet/transactions', { params }),

  // Top-up — new unified flow (WalletTopUpScreen)
  initializeTopUp:        (data)   => api.post('/wallet/topup/initialize', data),

  // Top-up — Paystack legacy
  paystackTopup:          (data)   => api.post('/wallet/topup/paystack', data),
  verifyPaystackTopup:    (data)   => api.post('/wallet/topup/paystack/verify', data),

  // Top-up — Flutterwave
  flutterwaveTopup:       (data)   => api.post('/wallet/topup/flutterwave', data),
  verifyFlutterwaveTopup: (data)   => api.post('/wallet/topup/flutterwave/verify', data),

  // Bank account verification (for WithdrawalScreen)
  verifyBankAccount:      (params) => api.get('/wallet/verify-account', { params }),

  // Transfer between users
  transfer:               (data)   => api.post('/wallet/transfer', data),

  // Legacy direct withdrawal
  withdraw:               (data)   => api.post('/wallet/withdraw', data),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────────────────────────────────────
export const supportAPI = {
  /** POST /api/users/support-ticket */
  submitTicket: (data) => api.post('/users/support-ticket', data),
 
  /** GET /api/users/support-tickets */
  getMyTickets: (params) => api.get('/users/support-tickets', { params }),
 
  /** GET /api/users/support-tickets/:id */
  getTicketById: (id) => api.get(`/users/support-tickets/${id}`),
  /** POST /api/users/support-tickets/:id/reply */
  addReply: (id, message) => api.post(`/users/support-tickets/${id}/reply`, { message }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SHIELD
// ─────────────────────────────────────────────────────────────────────────────
export const shieldAPI = {
  // Beneficiary management
  listBeneficiaries:   ()       => api.get('/shield/beneficiaries'),
  addBeneficiary:      (data)   => api.post('/shield/beneficiaries', data),
  updateBeneficiary:   (id, d)  => api.put(`/shield/beneficiaries/${id}`, d),
  deleteBeneficiary:   (id)     => api.delete(`/shield/beneficiaries/${id}`),
 
  // Session lifecycle
  activate:       (data) => api.post('/shield/activate', data),
  deactivate:     (data) => api.post('/shield/deactivate', data),
  arrivedSafe:    (data) => api.post('/shield/arrived-safe', data),
  getSession:     (params) => api.get('/shield/session', { params }),
 
  // Driver confirms safe
  driverConfirmSafe: (sessionId) => api.post('/shield/driver/confirm-safe', { sessionId }),
 
  // Public view (no token needed — used by web viewer, but useful for testing)
  getView:  (token) => api.get(`/shield/view/${token}`),
};

export default api;