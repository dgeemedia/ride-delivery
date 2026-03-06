// backend/src/services/notification.service.js
// Central service for creating DB notifications + emitting Socket.io events
// Used by: ride, delivery, admin, auth, wallet controllers

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Socket.io instance — set once when server starts
let _io = null;

/**
 * Call this once from server.js after io is created
 */
exports.setIO = (io) => {
  _io = io;
};

// Expose _io so controllers can use socket rooms (e.g. broadcastToDrivers)
Object.defineProperty(exports, '_io', {
  get: () => _io,
  enumerable: true
});

/**
 * Create a notification in DB and emit to user via Socket.io
 *
 * @param {object}  opts
 * @param {string}  opts.userId       - recipient user id
 * @param {string}  opts.title        - short title shown in UI
 * @param {string}  opts.message      - full message body
 * @param {string}  opts.type         - event type key (see TYPES below)
 * @param {object}  [opts.data]       - extra JSON payload
 * @param {boolean} [opts.socketOnly] - skip DB write (ephemeral alerts only)
 */
exports.notify = async ({ userId, title, message, type, data = {}, socketOnly = false }) => {
  let notification = null;

  // 1. Persist to DB so user sees it on next app open
  if (!socketOnly) {
    notification = await prisma.notification.create({
      data: { userId, title, message, type, data }
    });
  }

  // 2. Emit in real-time if user is connected
  if (_io) {
    _io.to(`user:${userId}`).emit('notification', {
      id: notification?.id,
      title,
      message,
      type,
      data,
      createdAt: new Date()
    });
  }

  return notification;
};

/**
 * Emit live location update to a ride/delivery room (no DB write needed)
 */
exports.emitLocation = ({ roomId, lat, lng, userId }) => {
  if (_io) {
    _io.to(roomId).emit('location_update', { userId, lat, lng, timestamp: new Date() });
  }
};

/**
 * Emit a ride/delivery status change to all parties in the room
 */
exports.emitStatusChange = ({ roomId, status, entityId, entityType }) => {
  if (_io) {
    _io.to(roomId).emit('status_change', { entityId, entityType, status, timestamp: new Date() });
  }
};

/**
 * Standard notification type constants.
 * Use these everywhere for consistency — never hardcode strings.
 */
exports.TYPES = {
  // Rides
  RIDE_REQUESTED:   'ride_requested',
  RIDE_ACCEPTED:    'ride_accepted',
  RIDE_ARRIVED:     'ride_arrived',
  RIDE_STARTED:     'ride_started',
  RIDE_COMPLETED:   'ride_completed',
  RIDE_CANCELLED:   'ride_cancelled',

  // Deliveries
  DELIVERY_REQUESTED:  'delivery_requested',
  DELIVERY_ASSIGNED:   'delivery_assigned',
  DELIVERY_PICKED_UP:  'delivery_picked_up',
  DELIVERY_IN_TRANSIT: 'delivery_in_transit',
  DELIVERY_COMPLETED:  'delivery_completed',
  DELIVERY_CANCELLED:  'delivery_cancelled',

  // Payments
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_REFUNDED: 'payment_refunded',

  // Wallet
  WALLET_CREDITED:  'wallet_credited',
  WALLET_DEBITED:   'wallet_debited',
  WALLET_WITHDRAWAL:'wallet_withdrawal',

  // Account
  ACCOUNT_WELCOME:   'account_welcome',
  ACCOUNT_VERIFIED:  'account_verified',
  ACCOUNT_SUSPENDED: 'account_suspended',
  ACCOUNT_ACTIVATED: 'account_activated',
  PASSWORD_RESET:    'password_reset',

  // Driver / Partner approval
  DRIVER_APPROVED:  'driver_approved',
  DRIVER_REJECTED:  'driver_rejected',
  PARTNER_APPROVED: 'partner_approved',
  PARTNER_REJECTED: 'partner_rejected',
};

module.exports = exports;