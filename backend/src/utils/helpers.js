/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

/**
 * Convert degrees to radians
 */
const toRad = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate fare based on distance
 * @param {number} distance - Distance in kilometers
 * @returns {number} Fare amount
 * 
 * FUTURE: Implement dynamic pricing
 * - Surge pricing during peak hours
 * - Weather-based pricing
 * - Different rates for different vehicle types
 */
exports.calculateFare = (distance) => {
  const baseFare = 2.0; // Base fare
  const perKmRate = 1.5; // Per kilometer rate
  const minFare = 3.0; // Minimum fare
  
  let fare = baseFare + (distance * perKmRate);
  
  if (fare < minFare) {
    fare = minFare;
  }
  
  return parseFloat(fare.toFixed(2));
};

/**
 * Calculate delivery fee based on distance and package details
 * @param {number} distance - Distance in kilometers
 * @param {number} packageWeight - Weight in kg (optional)
 * @returns {number} Delivery fee
 */
exports.calculateDeliveryFee = (distance, packageWeight = 0) => {
  const baseFee = 3.0;
  const perKmRate = 1.0;
  const weightSurcharge = packageWeight > 5 ? (packageWeight - 5) * 0.5 : 0;
  const minFee = 4.0;
  
  let fee = baseFee + (distance * perKmRate) + weightSurcharge;
  
  if (fee < minFee) {
    fee = minFee;
  }
  
  return parseFloat(fee.toFixed(2));
};

/**
 * Generate random OTP
 * @param {number} length - Length of OTP
 * @returns {string} OTP
 */
exports.generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  
  return otp;
};

/**
 * Format phone number to E.164 format
 * @param {string} phone - Phone number
 * @param {string} countryCode - Country code (default: +1)
 * @returns {string} Formatted phone number
 */
exports.formatPhoneNumber = (phone, countryCode = '+1') => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Add country code if not present
  if (!cleaned.startsWith(countryCode.replace('+', ''))) {
    return `${countryCode}${cleaned}`;
  }
  
  return `+${cleaned}`;
};

/**
 * Paginate results
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {object} Skip and take values for Prisma
 */
exports.paginate = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const take = parseInt(limit);
  
  return { skip, take };
};

/**
 * Calculate estimated time of arrival
 * @param {number} distance - Distance in kilometers
 * @param {number} avgSpeed - Average speed in km/h
 * @returns {number} ETA in minutes
 */
exports.calculateETA = (distance, avgSpeed = 30) => {
  const hours = distance / avgSpeed;
  const minutes = Math.ceil(hours * 60);
  
  return minutes;
};

/**
 * Check if location is within service area
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {object} serviceArea - Service area boundaries
 * @returns {boolean} True if within service area
 * 
 * FUTURE: Implement geofencing with polygon boundaries
 */
exports.isWithinServiceArea = (lat, lng, serviceArea) => {
  // Simple circular boundary check
  // In production, use actual city/region boundaries
  const centerLat = serviceArea.centerLat || 0;
  const centerLng = serviceArea.centerLng || 0;
  const radius = serviceArea.radius || 50; // km
  
  const distance = exports.calculateDistance(lat, lng, centerLat, centerLng);
  
  return distance <= radius;
};

/**
 * Sanitize user input
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
exports.sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, ''); // Remove basic XSS vectors
};

/**
 * Generate unique reference code
 * @param {string} prefix - Prefix for the code
 * @returns {string} Reference code
 */
exports.generateReferenceCode = (prefix = 'REF') => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

/**
 * Check if time is within business hours
 * @param {Date} date - Date to check
 * @param {object} hours - Business hours config
 * @returns {boolean} True if within business hours
 * 
 * FUTURE: Use for restaurant delivery timing
 */
exports.isWithinBusinessHours = (date = new Date(), hours = {}) => {
  const defaultHours = {
    start: 6, // 6 AM
    end: 23, // 11 PM
    ...hours
  };
  
  const currentHour = date.getHours();
  
  return currentHour >= defaultHours.start && currentHour < defaultHours.end;
};

module.exports = exports;