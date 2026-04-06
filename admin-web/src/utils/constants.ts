// admin-web/src/utils/constants.ts
export const USER_ROLES = {
  CUSTOMER: 'Customer',
  DRIVER: 'Driver',
  DELIVERY_PARTNER: 'Delivery Partner',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  MODERATOR: 'Moderator',
  SUPPORT: 'Support',
} as const;

export const RIDE_STATUSES = {
  REQUESTED: 'Requested',
  ACCEPTED: 'Accepted',
  ARRIVED: 'Arrived',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const;

export const DELIVERY_STATUSES = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
} as const;

export const PAYMENT_STATUSES = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'Cash',
  CARD: 'Card',
  WALLET: 'Wallet',
} as const;

export const VEHICLE_TYPES = {
  BIKE: 'Bike',
  CAR: 'Car',
  MOTORCYCLE: 'Motorcycle',
  VAN: 'Van',
  TRICYCLE:   'Tricycle',
} as const;

export const STATUS_COLORS = {
  // Ride statuses
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  ARRIVED: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  // Delivery statuses
  PENDING: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  PICKED_UP: 'bg-indigo-100 text-indigo-800',
  IN_TRANSIT: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
  // Payment statuses
  FAILED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
} as const;