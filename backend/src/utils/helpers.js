// backend/src/utils/helpers.js

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Calculate ride fare in NGN
 * Base fare: ₦200 + ₦150/km
 */
const calculateFare = (distanceKm) => {
  const BASE_FARE  = 200;
  const PER_KM     = 150;
  return Math.max(BASE_FARE, BASE_FARE + distanceKm * PER_KM);
};

/**
 * Calculate delivery fee in NGN
 * Base fee: ₦500 + ₦100/km + ₦20/kg (weight surcharge)
 */
const calculateDeliveryFee = (distanceKm, weightKg = 0) => {
  const BASE_FEE      = 500;
  const PER_KM        = 100;
  const WEIGHT_CHARGE = 20; // per kg over 1 kg
  const weightSurcharge = weightKg > 1 ? (weightKg - 1) * WEIGHT_CHARGE : 0;
  return Math.max(BASE_FEE, BASE_FEE + distanceKm * PER_KM + weightSurcharge);
};

/**
 * Format currency in NGN
 */
const formatNGN = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(amount);
};

/**
 * Generate a random alphanumeric reference string
 */
const generateReference = (prefix = 'REF') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};

/**
 * Paginate helper — returns skip and take from page/limit
 */
const getPagination = (page = 1, limit = 20) => ({
  skip: (parseInt(page) - 1) * parseInt(limit),
  take: parseInt(limit)
});

module.exports = {
  calculateDistance,
  calculateFare,
  calculateDeliveryFee,
  formatNGN,
  generateReference,
  getPagination
};