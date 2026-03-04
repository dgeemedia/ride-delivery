export const API_ENDPOINTS = {
  AUTH: '/auth',
  RIDES: '/rides',
  DELIVERIES: '/deliveries',
  DRIVERS: '/drivers',
  PARTNERS: '/partners',
  PAYMENTS: '/payments',
  UPLOAD: '/upload',
};

export const RIDE_STATUS = {
  REQUESTED: 'REQUESTED',
  ACCEPTED: 'ACCEPTED',
  ARRIVED: 'ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const DELIVERY_STATUS = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
};

export const USER_ROLES = {
  CUSTOMER: 'CUSTOMER',
  DRIVER: 'DRIVER',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
  ADMIN: 'ADMIN',
};

export const VEHICLE_TYPES = {
  BIKE: 'BIKE',
  CAR: 'CAR',
  MOTORCYCLE: 'MOTORCYCLE',
  VAN: 'VAN',
};

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  WALLET: 'WALLET',
};

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  DRIVER_ONLINE: 'driver:online',
  DRIVER_OFFLINE: 'driver:offline',
  DRIVER_LOCATION: 'driver:location',
  PARTNER_ONLINE: 'partner:online',
  PARTNER_LOCATION: 'partner:location',
  LOCATION_UPDATE: 'driver:location:update',
  RIDE_REQUESTED: 'ride:requested',
  DELIVERY_REQUESTED: 'delivery:requested',
};

export const NOTIFICATION_TYPES = {
  RIDE_ACCEPTED: 'ride_accepted',
  RIDE_STARTED: 'ride_started',
  RIDE_COMPLETED: 'ride_completed',
  DELIVERY_ASSIGNED: 'delivery_assigned',
  DELIVERY_PICKED_UP: 'delivery_picked_up',
  DELIVERY_COMPLETED: 'delivery_completed',
  PAYMENT_RECEIVED: 'payment_received',
};

export const MAP_DEFAULTS = {
  LATITUDE_DELTA: 0.0922,
  LONGITUDE_DELTA: 0.0421,
  ZOOM_LEVEL: 15,
};

export const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 10000,
  distanceFilter: 10,
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  LOCATION_PERMISSION_DENIED: 'Location permission denied',
  LOCATION_UNAVAILABLE: 'Location unavailable',
  INVALID_CREDENTIALS: 'Invalid email or password',
  SESSION_EXPIRED: 'Session expired. Please login again.',
};