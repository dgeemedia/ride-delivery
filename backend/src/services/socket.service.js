// backend/src/services/socket.service.js
const jwt    = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { logger } = require('../utils/logger');

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
      where:  { id: decoded.userId },
      select: { id: true, role: true, firstName: true, lastName: true, isActive: true },
    });

    if (!user)          return next(new Error('User not found'));
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

    // Every user joins their private room — this room is ALWAYS available
    // and is used by emitToPartner / emitToUser for targeted delivery.
    socket.join(`user:${socket.userId}`);

    // ── AUTO-REJOIN: if this is a DELIVERY_PARTNER who is still marked
    //    online in the DB (e.g. app reconnected after a network drop),
    //    immediately rejoin the broadcast room so they can receive both
    //    targeted and broadcast delivery requests without having to toggle
    //    the switch off and on again.
    if (socket.userRole === 'DELIVERY_PARTNER') {
      prisma.deliveryPartnerProfile.findUnique({
        where:  { userId: socket.userId },
        select: { isOnline: true },
      }).then((profile) => {
        if (profile?.isOnline) {
          socket.join('partners:online');
          logger.info(`[Socket] Partner auto-rejoined partners:online on reconnect: ${socket.userId}`);
        }
      }).catch((err) => {
        logger.error('[Socket] partner auto-rejoin error:', err.message);
      });
    }

    // ── DRIVER EVENTS ─────────────────────────────

    socket.on('driver:online', async (data) => {
      if (socket.userRole !== 'DRIVER') return;
      try {
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: {
            isOnline:   true,
            currentLat: data?.lat ?? null,
            currentLng: data?.lng ?? null,
          },
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
          data:  { isOnline: false },
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
          data:  { currentLat: data.lat, currentLng: data.lng },
        });

        const activeRide = await prisma.ride.findFirst({
          where: {
            driverId: socket.userId,
            status:   { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
          },
        });

        if (activeRide) {
          // Emit to customer
          io.to(`user:${activeRide.customerId}`).emit('driver:location:update', {
            lat:       data.lat,
            lng:       data.lng,
            heading:   data.heading ?? null,
            timestamp: new Date(),
          });

          // ── SHIELD: also broadcast to beneficiary's browser tab ──────────
          try {
            const shieldSession = await prisma.shieldSession.findFirst({
              where: { rideId: activeRide.id, isActive: true },
            });
            if (shieldSession) {
              io.to(`shield:${shieldSession.token}`).emit('driver:location:update', {
                lat:       data.lat,
                lng:       data.lng,
                heading:   data.heading ?? null,
                timestamp: new Date(),
              });
            }
          } catch (shieldErr) {
            logger.error('[Socket] SHIELD ride location broadcast error:', shieldErr.message);
          }
          // ────────────────────────────────────────────────────────────────
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
            isOnline:   true,
            currentLat: data?.lat ?? null,
            currentLng: data?.lng ?? null,
          },
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
          data:  { isOnline: false },
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
          data:  { currentLat: data.lat, currentLng: data.lng },
        });

        const activeDelivery = await prisma.delivery.findFirst({
          where: {
            partnerId: socket.userId,
            status:    { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
          },
        });

        if (activeDelivery) {
          // Emit to customer
          io.to(`user:${activeDelivery.customerId}`).emit('partner:location:update', {
            lat:       data.lat,
            lng:       data.lng,
            heading:   data.heading ?? null,
            timestamp: new Date(),
          });

          // ── SHIELD: also broadcast to beneficiary's browser tab ──────────
          try {
            const shieldSession = await prisma.shieldSession.findFirst({
              where: { deliveryId: activeDelivery.id, isActive: true },
            });
            if (shieldSession) {
              io.to(`shield:${shieldSession.token}`).emit('partner:location:update', {
                lat:       data.lat,
                lng:       data.lng,
                heading:   data.heading ?? null,
                timestamp: new Date(),
              });
            }
          } catch (shieldErr) {
            logger.error('[Socket] SHIELD delivery location broadcast error:', shieldErr.message);
          }
          // ────────────────────────────────────────────────────────────────
        }
      } catch (err) {
        logger.error('[Socket] partner:location error:', err.message);
      }
    });

    // ── RIDE ROOM ──────────────────────────────────

    socket.on('ride:join',  (rideId)  => socket.join(`ride:${rideId}`));
    socket.on('ride:leave', (rideId)  => socket.leave(`ride:${rideId}`));

    // ── DELIVERY ROOM ──────────────────────────────

    socket.on('delivery:join',  (deliveryId) => socket.join(`delivery:${deliveryId}`));
    socket.on('delivery:leave', (deliveryId) => socket.leave(`delivery:${deliveryId}`));

    // ── SHIELD ROOM ────────────────────────────────
    //
    // Beneficiary browsers join shield:<token>.
    // The customer's app also joins when SHIELD is active on their ride
    // so it can receive shield:arrived_safe and shield:driver_confirmed_safe events.

    socket.on('shield:join', (token) => {
      if (!token || typeof token !== 'string') return;
      socket.join(`shield:${token}`);
      logger.info(`[Socket] shield:join token=${token} user=${socket.userId ?? 'anon'}`);
    });

    socket.on('shield:leave', (token) => {
      if (!token || typeof token !== 'string') return;
      socket.leave(`shield:${token}`);
    });

    // Driver taps "All Good" from the in-app safety check notification
    socket.on('shield:driver_safe_ack', async (data) => {
      // data: { sessionId, token }
      if (!data?.token) return;
      try {
        io.to(`shield:${data.token}`).emit('shield:driver_confirmed_safe', {
          confirmedBy: socket.userName,
          timestamp:   new Date(),
        });
        logger.info(`[Socket] shield:driver_safe_ack by ${socket.userId} token=${data.token}`);
      } catch (err) {
        logger.error('[Socket] shield:driver_safe_ack error:', err.message);
      }
    });

    // Customer broadcasts their own location to the shield room
    // (optional — useful if customer is on foot after being dropped off)
    socket.on('customer:location', (data) => {
      // data: { token, lat, lng }
      if (!data?.token) return;
      io.to(`shield:${data.token}`).emit('customer:location:update', {
        lat:       data.lat,
        lng:       data.lng,
        timestamp: new Date(),
      });
    });

    // ── CALL SIGNALING ─────────────────────────────

    socket.on('call:initiate', async (data) => {
      try {
        const caller = await prisma.user.findUnique({
          where:  { id: socket.userId },
          select: { id: true, firstName: true, lastName: true, profileImage: true, role: true },
        });

        io.to(`user:${data.targetUserId}`).emit('call:incoming', {
          callerId:    socket.userId,
          callerName:  `${caller.firstName} ${caller.lastName}`,
          callerImage: data.callerImage ?? caller.profileImage,
          channelName: data.channelName,
          callType:    data.callType ?? 'voice',
        });

        logger.info(`[Socket] call:initiate ${socket.userId} → ${data.targetUserId} (${data.callType})`);
      } catch (err) {
        logger.error('[Socket] call:initiate error:', err.message);
      }
    });

    socket.on('call:accept', (data) => {
      io.to(`user:${data.callerId}`).emit('call:accepted', {
        acceptedBy:  socket.userId,
        channelName: data.channelName,
      });
      logger.info(`[Socket] call:accept ${socket.userId} accepted call from ${data.callerId}`);
    });

    socket.on('call:reject', (data) => {
      io.to(`user:${data.callerId}`).emit('call:rejected', {
        rejectedBy:  socket.userId,
        channelName: data.channelName,
        reason:      data.reason ?? 'declined',
      });
      logger.info(`[Socket] call:reject ${socket.userId} rejected call from ${data.callerId}`);
    });

    socket.on('call:end', (data) => {
      io.to(`user:${data.targetUserId}`).emit('call:ended', {
        endedBy:     socket.userId,
        channelName: data.channelName,
      });
      logger.info(`[Socket] call:end ${socket.userId} ended call with ${data.targetUserId}`);
    });

    socket.on('call:toggle_video', (data) => {
      io.to(`user:${data.targetUserId}`).emit('call:video_toggled', {
        byUserId:     socket.userId,
        videoEnabled: data.videoEnabled,
      });
    });

    // ── SOS / EMERGENCY ────────────────────────────

    socket.on('emergency:trigger', async (data) => {
      try {
        logger.warn(`[EMERGENCY] User ${socket.userId} triggered SOS. Location: ${JSON.stringify(data)}`);

        io.to('admins:online').emit('emergency:alert', {
          userId:    socket.userId,
          userName:  socket.userName,
          userRole:  socket.userRole,
          location:  data,
          timestamp: new Date(),
        });

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
            data:  { isOnline: false },
          });
        }
        if (socket.userRole === 'DELIVERY_PARTNER') {
          await prisma.deliveryPartnerProfile.updateMany({
            where: { userId: socket.userId },
            data:  { isOnline: false },
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

const emitToUser          = (io, userId, event, data) => io?.to(`user:${userId}`).emit(event, data);
const broadcastToDrivers  = (io, event, data)          => io?.to('drivers:online').emit(event, data);
const broadcastToPartners = (io, event, data)          => io?.to('partners:online').emit(event, data);

// ── FIX: emit to the partner via their user:X room which is joined on
//         every connection — not partner:X which only exists after the
//         partner:online socket event fires. This guarantees delivery
//         even after a socket reconnect where partner:online was not
//         re-emitted by the client.
const emitToPartner = (io, partnerId, event, data) =>
  io?.to(`user:${partnerId}`).emit(event, data);

const getSocketId      = (userId)                 => activeSockets.get(userId) || null;

// SHIELD helper — emit to a beneficiary's live tracker room
const emitToShieldRoom = (io, token, event, data) => io?.to(`shield:${token}`).emit(event, data);

module.exports = {
  initializeSocketHandlers,
  emitToUser,
  broadcastToDrivers,
  broadcastToPartners,
  emitToPartner,
  getSocketId,
  emitToShieldRoom,
};