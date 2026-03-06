// backend/src/services/socket.service.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient();

// Store active socket connections: userId -> socketId
const activeSockets = new Map();

// ─────────────────────────────────────────────
// AUTHENTICATION MIDDLEWARE
// ─────────────────────────────────────────────

const verifySocketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) return next(new Error('Authentication error: no token'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, firstName: true, lastName: true, isActive: true }
    });

    if (!user) return next(new Error('User not found'));
    if (!user.isActive) return next(new Error('Account is deactivated'));

    socket.userId   = user.id;
    socket.userRole = user.role;
    socket.userName = `${user.firstName} ${user.lastName}`;

    next();
  } catch (error) {
    logger.error('Socket auth error:', error.message);
    next(new Error('Authentication error'));
  }
};

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────

const initializeSocketHandlers = (io) => {
  // Inject io into notification service so controllers can emit
  const notificationService = require('./notification.service');
  notificationService.setIO(io);

  io.use(verifySocketAuth);

  io.on('connection', (socket) => {
    logger.info(`[Socket] Connected: ${socket.userName} (${socket.userId}) role=${socket.userRole}`);

    activeSockets.set(socket.userId, socket.id);

    // Every user joins their private room
    socket.join(`user:${socket.userId}`);

    // ── DRIVER EVENTS ──────────────────────────────

    socket.on('driver:online', async (data) => {
      if (socket.userRole !== 'DRIVER') return;
      try {
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: {
            isOnline: true,
            currentLat: data?.lat ?? null,
            currentLng: data?.lng ?? null
          }
        });
        socket.join('drivers:online');
        logger.info(`[Socket] Driver online: ${socket.userId}`);
      } catch (err) {
        logger.error('[Socket] driver:online error:', err.message);
      }
    });

    socket.on('driver:offline', async () => {
      if (socket.userRole !== 'DRIVER') return;
      try {
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: { isOnline: false }
        });
        socket.leave('drivers:online');
        logger.info(`[Socket] Driver offline: ${socket.userId}`);
      } catch (err) {
        logger.error('[Socket] driver:offline error:', err.message);
      }
    });

    socket.on('driver:location', async (data) => {
      if (socket.userRole !== 'DRIVER') return;
      try {
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: { currentLat: data.lat, currentLng: data.lng }
        });

        // Forward real-time location to the customer in the active ride
        const activeRide = await prisma.ride.findFirst({
          where: {
            driverId: socket.userId,
            status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] }
          }
        });

        if (activeRide) {
          io.to(`user:${activeRide.customerId}`).emit('driver:location:update', {
            lat: data.lat,
            lng: data.lng,
            heading: data.heading ?? null,
            timestamp: new Date()
          });
        }
      } catch (err) {
        logger.error('[Socket] driver:location error:', err.message);
      }
    });

    // ── DELIVERY PARTNER EVENTS ────────────────────

    socket.on('partner:online', async (data) => {
      if (socket.userRole !== 'DELIVERY_PARTNER') return;
      try {
        await prisma.deliveryPartnerProfile.update({
          where: { userId: socket.userId },
          data: {
            isOnline: true,
            currentLat: data?.lat ?? null,
            currentLng: data?.lng ?? null
          }
        });
        socket.join('partners:online');
        logger.info(`[Socket] Partner online: ${socket.userId}`);
      } catch (err) {
        logger.error('[Socket] partner:online error:', err.message);
      }
    });

    socket.on('partner:offline', async () => {
      if (socket.userRole !== 'DELIVERY_PARTNER') return;
      try {
        await prisma.deliveryPartnerProfile.update({
          where: { userId: socket.userId },
          data: { isOnline: false }
        });
        socket.leave('partners:online');
      } catch (err) {
        logger.error('[Socket] partner:offline error:', err.message);
      }
    });

    socket.on('partner:location', async (data) => {
      if (socket.userRole !== 'DELIVERY_PARTNER') return;
      try {
        await prisma.deliveryPartnerProfile.update({
          where: { userId: socket.userId },
          data: { currentLat: data.lat, currentLng: data.lng }
        });

        const activeDelivery = await prisma.delivery.findFirst({
          where: {
            partnerId: socket.userId,
            status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
          }
        });

        if (activeDelivery) {
          io.to(`user:${activeDelivery.customerId}`).emit('partner:location:update', {
            lat: data.lat,
            lng: data.lng,
            heading: data.heading ?? null,
            timestamp: new Date()
          });
        }
      } catch (err) {
        logger.error('[Socket] partner:location error:', err.message);
      }
    });

    // ── RIDE ROOM ──────────────────────────────────

    socket.on('ride:join', (rideId) => {
      socket.join(`ride:${rideId}`);
    });

    socket.on('ride:leave', (rideId) => {
      socket.leave(`ride:${rideId}`);
    });

    // ── DELIVERY ROOM ──────────────────────────────

    socket.on('delivery:join', (deliveryId) => {
      socket.join(`delivery:${deliveryId}`);
    });

    socket.on('delivery:leave', (deliveryId) => {
      socket.leave(`delivery:${deliveryId}`);
    });

    // ── SOS / EMERGENCY ────────────────────────────

    socket.on('emergency:trigger', async (data) => {
      try {
        logger.warn(`[EMERGENCY] User ${socket.userId} triggered SOS. Location: ${JSON.stringify(data)}`);

        // Notify all admins
        io.to('admins:online').emit('emergency:alert', {
          userId: socket.userId,
          userName: socket.userName,
          userRole: socket.userRole,
          location: data,
          timestamp: new Date()
        });

        // Acknowledge to the user
        socket.emit('emergency:acknowledged', { message: 'Help is on the way. Stay safe.' });
      } catch (err) {
        logger.error('[Socket] emergency:trigger error:', err.message);
      }
    });

    // ── ADMIN ROOM ─────────────────────────────────

    if (['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT'].includes(socket.userRole)) {
      socket.join('admins:online');
    }

    // ── DISCONNECT ─────────────────────────────────

    socket.on('disconnect', async () => {
      logger.info(`[Socket] Disconnected: ${socket.userName} (${socket.userId})`);
      activeSockets.delete(socket.userId);

      try {
        if (socket.userRole === 'DRIVER') {
          await prisma.driverProfile.updateMany({
            where: { userId: socket.userId },
            data: { isOnline: false }
          });
        }

        if (socket.userRole === 'DELIVERY_PARTNER') {
          await prisma.deliveryPartnerProfile.updateMany({
            where: { userId: socket.userId },
            data: { isOnline: false }
          });
        }
      } catch (err) {
        logger.error('[Socket] disconnect cleanup error:', err.message);
      }
    });
  });
};

// ─────────────────────────────────────────────
// UTILITY EXPORTS
// ─────────────────────────────────────────────

/** Emit an event to a specific user's private room */
const emitToUser = (io, userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

/** Broadcast to all online drivers */
const broadcastToDrivers = (io, event, data) => {
  if (io) io.to('drivers:online').emit(event, data);
};

/** Broadcast to all online delivery partners */
const broadcastToPartners = (io, event, data) => {
  if (io) io.to('partners:online').emit(event, data);
};

/** Get socket ID for a user (if connected) */
const getSocketId = (userId) => activeSockets.get(userId) || null;

module.exports = {
  initializeSocketHandlers,
  emitToUser,
  broadcastToDrivers,
  broadcastToPartners,
  getSocketId
};