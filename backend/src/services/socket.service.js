const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient();

// Store active socket connections
const activeSockets = new Map();

/**
 * Verify socket authentication
 */
const verifySocketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true
      }
    });
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.userId = user.id;
    socket.userRole = user.role;
    socket.userName = `${user.firstName} ${user.lastName}`;
    
    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
};

/**
 * Initialize Socket.io event handlers
 */
const initializeSocketHandlers = (io) => {
  // Authentication middleware
  io.use(verifySocketAuth);
  
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userName} (${socket.userId})`);
    
    // Store active connection
    activeSockets.set(socket.userId, socket.id);
    
    // Join user-specific room
    socket.join(`user:${socket.userId}`);
    
    // Driver goes online
    socket.on('driver:online', async (data) => {
      try {
        if (socket.userRole !== 'DRIVER') return;
        
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: {
            isOnline: true,
            currentLat: data.lat,
            currentLng: data.lng
          }
        });
        
        socket.join('drivers:online');
        logger.info(`Driver ${socket.userId} is now online`);
      } catch (error) {
        logger.error('Error setting driver online:', error);
      }
    });
    
    // Driver goes offline
    socket.on('driver:offline', async () => {
      try {
        if (socket.userRole !== 'DRIVER') return;
        
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: { isOnline: false }
        });
        
        socket.leave('drivers:online');
        logger.info(`Driver ${socket.userId} is now offline`);
      } catch (error) {
        logger.error('Error setting driver offline:', error);
      }
    });
    
    // Update driver location
    socket.on('driver:location', async (data) => {
      try {
        if (socket.userRole !== 'DRIVER') return;
        
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: {
            currentLat: data.lat,
            currentLng: data.lng
          }
        });
        
        // Find active ride and broadcast to customer
        const activeRide = await prisma.ride.findFirst({
          where: {
            driverId: socket.userId,
            status: {
              in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS']
            }
          }
        });
        
        if (activeRide) {
          io.to(`user:${activeRide.customerId}`).emit('driver:location:update', {
            lat: data.lat,
            lng: data.lng,
            heading: data.heading
          });
        }
      } catch (error) {
        logger.error('Error updating driver location:', error);
      }
    });
    
    // Delivery partner goes online
    socket.on('partner:online', async (data) => {
      try {
        if (socket.userRole !== 'DELIVERY_PARTNER') return;
        
        await prisma.deliveryPartnerProfile.update({
          where: { userId: socket.userId },
          data: {
            isOnline: true,
            currentLat: data.lat,
            currentLng: data.lng
          }
        });
        
        socket.join('partners:online');
        logger.info(`Delivery partner ${socket.userId} is now online`);
      } catch (error) {
        logger.error('Error setting partner online:', error);
      }
    });
    
    // Update delivery partner location
    socket.on('partner:location', async (data) => {
      try {
        if (socket.userRole !== 'DELIVERY_PARTNER') return;
        
        await prisma.deliveryPartnerProfile.update({
          where: { userId: socket.userId },
          data: {
            currentLat: data.lat,
            currentLng: data.lng
          }
        });
        
        // Find active delivery and broadcast to customer
        const activeDelivery = await prisma.delivery.findFirst({
          where: {
            partnerId: socket.userId,
            status: {
              in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT']
            }
          }
        });
        
        if (activeDelivery) {
          io.to(`user:${activeDelivery.customerId}`).emit('partner:location:update', {
            lat: data.lat,
            lng: data.lng,
            heading: data.heading
          });
        }
      } catch (error) {
        logger.error('Error updating partner location:', error);
      }
    });
    
    // Disconnect handler
    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${socket.userName} (${socket.userId})`);
      
      // Remove from active sockets
      activeSockets.delete(socket.userId);
      
      // Set driver/partner offline if they disconnect
      if (socket.userRole === 'DRIVER') {
        try {
          await prisma.driverProfile.update({
            where: { userId: socket.userId },
            data: { isOnline: false }
          });
        } catch (error) {
          logger.error('Error setting driver offline on disconnect:', error);
        }
      }
      
      if (socket.userRole === 'DELIVERY_PARTNER') {
        try {
          await prisma.deliveryPartnerProfile.update({
            where: { userId: socket.userId },
            data: { isOnline: false }
          });
        } catch (error) {
          logger.error('Error setting partner offline on disconnect:', error);
        }
      }
    });
    
    // FUTURE: Add chat functionality
    // socket.on('message:send', async (data) => {
    //   const { rideId, message } = data;
    //   // Save message and emit to other party
    // });
    
    // FUTURE: Add SOS/Emergency button
    // socket.on('emergency:trigger', async (data) => {
    //   // Notify emergency contacts and admin
    // });
  });
};

/**
 * Emit event to specific user
 */
const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Broadcast to all online drivers
 */
const broadcastToDrivers = (io, event, data) => {
  io.to('drivers:online').emit(event, data);
};

/**
 * Broadcast to all online delivery partners
 */
const broadcastToPartners = (io, event, data) => {
  io.to('partners:online').emit(event, data);
};

module.exports = {
  initializeSocketHandlers,
  emitToUser,
  broadcastToDrivers,
  broadcastToPartners
};