// mobile/src/services/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants';
import { emitForceLogout } from './authEvents';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Device ID helper ──────────────────────────────────────────────────────────
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

// ── Request interceptor — attach auth token + device ID ───────────────────────
api.interceptors.request.use(
  async (config) => {
    const [token, deviceId] = await Promise.all([
      AsyncStorage.getItem('authToken'),
      getOrCreateDeviceId(),
    ]);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config.headers['X-Device-ID'] = deviceId;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — unwrap .data, handle 401 ──────────────────────────
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['authToken', 'user']).catch(() => {});
      const reason = error.response?.data?.code ?? 'session_expired';
      emitForceLogout(reason);
    }
 
    // Re-reject with the unwrapped backend payload so catch blocks can do:
    //   err?.message  or  err?.errors
    // instead of  err?.response?.data?.message
    return Promise.reject(error.response?.data ?? error);
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

  // ── 2FA ───────────────────────────────────────────────────────────────────
  verifyOtp:      (data) => api.post('/auth/verify-otp', data),
  resendOtp:      (data) => api.post('/auth/resend-otp', data),
  setup2FA:       (data) => api.post('/auth/2fa/setup', data),
  confirm2FA:     (data) => api.post('/auth/2fa/confirm', data),
  disable2FA:     (data) => api.post('/auth/2fa/disable', data),
};

// ─────────────────────────────────────────────────────────────────────────────
// RIDE
// ─────────────────────────────────────────────────────────────────────────────
export const rideAPI = {
  getEstimate:           (params)     => api.get('/rides/estimate', { params }),
  requestRide:           (data)       => api.post('/rides/request', data),
  getActiveRide:         ()           => api.get('/rides/active'),
  getRideHistory:        (params)     => api.get('/rides/history', { params }),
  getRideById:           (id)         => api.get(`/rides/${id}`),
  acceptRide:            (id)         => api.put(`/rides/${id}/accept`),
  arrivedAtPickup:       (id)         => api.put(`/rides/${id}/arrived`),
  startRide:             (id)         => api.put(`/rides/${id}/start`),
  completeRide:          (id, data)   => api.put(`/rides/${id}/complete`, data),
  cancelRide:            (id, data)   => api.put(`/rides/${id}/cancel`, data),
  getNearbyDrivers:      (params)     => api.get('/rides/nearby-drivers', { params }),
  requestSpecificDriver: (data)       => api.post('/rides/request-driver', data),
  rateRide:              (id, data)   => api.post(`/rides/${id}/rate`, data),
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
  submitFeedback: (data) => api.post('/users/feedback', data),
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER
// ─────────────────────────────────────────────────────────────────────────────
export const driverAPI = {
  getProfile:        ()       => api.get('/drivers/profile'),
  updateProfile:     (data)   => api.post('/drivers/profile', data),
  updateStatus:      (data)   => api.put('/drivers/status', data),
  getEarnings:       (params) => api.get('/drivers/earnings', { params }),
  getStats:          ()       => api.get('/drivers/stats'),
  getNearbyRequests: ()       => api.get('/drivers/nearby-requests'),
  requestPayout:     (data)   => api.post('/drivers/payout/request', data),
  getPayoutHistory:  (params) => api.get('/drivers/payout/history', { params }),
  uploadDocuments:   (data)   => api.post('/drivers/documents', data),
};

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER
// ─────────────────────────────────────────────────────────────────────────────
export const partnerAPI = {
  getProfile:        ()        => api.get('/partners/profile'),
  updateProfile:     (data)    => api.post('/partners/profile', data),
  updateStatus:      (data)    => api.put('/partners/status', data),
  getEarnings:       (params)  => api.get('/partners/earnings', { params }),
  getStats:          ()        => api.get('/partners/stats'),
  getNearbyRequests: ()        => api.get('/partners/nearby-requests'),
  updateFloorPrice:  (price)   => api.post('/partners/profile', { preferredFloorPrice: price }),
  uploadDocuments:   (data)    => api.post('/partners/documents', data),   // ← NEW
  requestPayout:     (data)    => api.post('/partners/payout/request', data),
  getPayoutHistory:  (params)  => api.get('/partners/payout/history', { params }),
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
// ─────────────────────────────────────────────────────────────────────────────
export const walletAPI = {
  getWallet:              ()       => api.get('/wallet'),
  getTransactions:        (params) => api.get('/wallet/transactions', { params }),
  lookupUser:             (phone)  => api.get('/wallet/lookup-user', { params: { phone } }),
  initializeTopUp:        (data)   => api.post('/wallet/topup/initialize', data),
  paystackTopup:          (data)   => api.post('/wallet/topup/paystack', data),
  verifyPaystackTopup:    (data)   => api.post('/wallet/topup/paystack/verify', data),
  flutterwaveTopup:       (data)   => api.post('/wallet/topup/flutterwave', data),
  verifyFlutterwaveTopup: (data)   => api.post('/wallet/topup/flutterwave/verify', data),
  verifyBankAccount:      (params) => api.get('/wallet/verify-account', { params }),
  transfer:               (data)   => api.post('/wallet/transfer', data),
  withdraw:               (data)   => api.post('/wallet/withdraw', data),
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT
// ─────────────────────────────────────────────────────────────────────────────
export const paymentAPI = {
  initializePaystack:    (data)     => api.post('/payments/paystack/initialize', data),
  verifyPaystack:        (data)     => api.post('/payments/paystack/verify', data),
  initializeFlutterwave: (data)     => api.post('/payments/flutterwave/initialize', data),
  verifyFlutterwave:     (data)     => api.post('/payments/flutterwave/verify', data),
  payWithWallet:         (data)     => api.post('/payments/wallet', data),
  payWithCash:           (data)     => api.post('/payments/cash', data),
  getHistory:            (params)   => api.get('/payments/history', { params }),
  getStats:              (params)   => api.get('/payments/stats', { params }),
  getById:               (id)       => api.get(`/payments/${id}`),
  requestRefund:         (id, data) => api.post(`/payments/${id}/refund`, data),
  listBanks:             ()         => api.get('/payments/banks'),
  verifyBankAccount:     (data)     => api.post('/payments/verify-account', data),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────────────────────────────────────
export const supportAPI = {
  submitTicket: (data)        => api.post('/users/support-ticket', data),
  getMyTickets: (params)      => api.get('/users/support-tickets', { params }),
  getTicketById:(id)          => api.get(`/users/support-tickets/${id}`),
  addReply:     (id, message) => api.post(`/users/support-tickets/${id}/reply`, { message }),
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC SETTINGS  (no auth token required)
// ─────────────────────────────────────────────────────────────────────────────
export const settingsAPI = {
  getContactSettings: () => api.get('/status/contact'),
  getLegalContent:    () => api.get('/status/legal'),
};

// ─────────────────────────────────────────────────────────────────────────────
// SHIELD
// ─────────────────────────────────────────────────────────────────────────────
export const shieldAPI = {
  listBeneficiaries: ()          => api.get('/shield/beneficiaries'),
  addBeneficiary:    (data)      => api.post('/shield/beneficiaries', data),
  updateBeneficiary: (id, d)     => api.put(`/shield/beneficiaries/${id}`, d),
  deleteBeneficiary: (id)        => api.delete(`/shield/beneficiaries/${id}`),
  activate:          (data)      => api.post('/shield/activate', data),
  deactivate:        (data)      => api.post('/shield/deactivate', data),
  arrivedSafe:       (data)      => api.post('/shield/arrived-safe', data),
  getSession:        (params)    => api.get('/shield/session', { params }),
  driverConfirmSafe: (sessionId) => api.post('/shield/driver/confirm-safe', { sessionId }),
  getView:           (token)     => api.get(`/shield/view/${token}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// CORPORATE
// ─────────────────────────────────────────────────────────────────────────────
export const corporateAPI = {
  register:      (data)     => api.post('/corporate/register', data),
  getProfile:    ()         => api.get('/corporate/profile'),
  updateProfile: (data)     => api.put('/corporate/profile', data),
  getWallet:     ()         => api.get('/corporate/wallet'),
  initiateTopUp: (data)     => api.post('/corporate/wallet/topup', data),
  verifyTopUp:   (data)     => api.post('/corporate/wallet/verify', data),
  listEmployees: (params)   => api.get('/corporate/employees', { params }),
  inviteEmployee:(data)     => api.post('/corporate/employees/invite', data),
  updateEmployee:(id, data) => api.put(`/corporate/employees/${id}`, data),
  removeEmployee:(id)       => api.delete(`/corporate/employees/${id}`),
  getMyAccount:  ()         => api.get('/corporate/my-account'),
  respondInvite: (data)     => api.post('/corporate/invite/respond', data),
  getTrips:      (params)   => api.get('/corporate/trips', { params }),
  getInvoice:    (params)   => api.get('/corporate/invoice', { params }),
};

// ─────────────────────────────────────────────────────────────────────────────
// DUOPAY
// ─────────────────────────────────────────────────────────────────────────────
export const duopayAPI = {
  getEligibility:  ()     => api.get('/duopay/eligibility'),
  getAccount:      ()     => api.get('/duopay/account'),
  activate:        (data) => api.post('/duopay/activate', data),
  manualRepay:     (data) => api.post('/duopay/repay', data),
  getTransactions: (p)    => api.get('/duopay/transactions', { params: p }),
};

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOADS
// ─────────────────────────────────────────────────────────────────────────────

/** Helper: wraps a file picker result into a multipart POST */
const uploadSingle = async (url, fieldName, file) => {
  const form = new FormData();
  form.append(fieldName, {
    uri: file.uri,
    name: file.name || file.uri.split('/').pop(),
    type: file.type || 'image/jpeg',
  });

  // Override Content-Type to multipart/form-data – the interceptor will
  // still attach the Authorization header and X-Device-ID automatically.
  return api.post(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadAPI = {
  // Driver documents
  uploadDriverLicense:       (image) => uploadSingle('/upload/driver/license',              'license',      image),
  uploadVehicleRegistration: (image) => uploadSingle('/upload/driver/vehicle-registration', 'registration', image),
  uploadInsurance:           (image) => uploadSingle('/upload/driver/insurance',            'insurance',    image),

  // Partner documents
  uploadPartnerId:           (image) => uploadSingle('/upload/partner/id',      'id',      image),
  uploadPartnerVehicle:      (image) => uploadSingle('/upload/partner/vehicle', 'vehicle', image),

  // Profile image
  uploadProfileImage:        (image) => uploadSingle('/upload/profile-image',   'image',   image),

  // Base64 fallback (already exists on backend)
  uploadBase64:              (base64, folder) => api.post('/upload/base64', { base64Data: base64, folder }),
};

export default api;