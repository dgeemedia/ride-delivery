export const SOCKET_EVENTS = {
  // Ride events
  RIDE_REQUESTED: 'ride:requested',
  RIDE_ACCEPTED: 'ride:accepted',
  RIDE_STARTED: 'ride:started',
  RIDE_COMPLETED: 'ride:completed',
  RIDE_CANCELLED: 'ride:cancelled',
  DRIVER_LOCATION_UPDATE: 'driver:location:update',

  // Delivery events
  DELIVERY_REQUESTED: 'delivery:requested',
  DELIVERY_ASSIGNED: 'delivery:assigned',
  DELIVERY_PICKED_UP: 'delivery:picked_up',
  DELIVERY_IN_TRANSIT: 'delivery:in_transit',
  DELIVERY_DELIVERED: 'delivery:delivered',
  DELIVERY_CANCELLED: 'delivery:cancelled',
  PARTNER_LOCATION_UPDATE: 'partner:location:update',

  // Admin events
  NEW_USER_REGISTERED: 'admin:new_user',
  NEW_DRIVER_APPLICATION: 'admin:new_driver',
  NEW_PARTNER_APPLICATION: 'admin:new_partner',
  PAYMENT_COMPLETED: 'admin:payment_completed',
  
  // System events
  STATS_UPDATE: 'admin:stats:update',
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];