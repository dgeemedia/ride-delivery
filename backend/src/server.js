// backend/src/server.js
require('dotenv').config();
const http = require('http');
const app  = require('./app');
const { Server } = require('socket.io');
const { logger } = require('./utils/logger');
const { initializeSocketHandlers } = require('./services/socket.service');

const PORT = parseInt(process.env.PORT) || 3000;

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.CLIENT_URL || 'https://yourdomain.com']
      : '*',
    methods: ['GET', 'POST']
  },
  // Ping settings — keeps mobile connections alive
  pingTimeout:  60000,
  pingInterval: 25000
});

// Wire socket handlers AND inject io into notification.service in one call
initializeSocketHandlers(io);

// ─────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — closing HTTP server`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force-exit if server hasn't closed within 10 s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─────────────────────────────────────────────────────────────────────────────
// UNHANDLED ERRORS
// ─────────────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`🚀  Server running on port ${PORT}`);
  logger.info(`📍  Environment : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗  API         : http://localhost:${PORT}/api`);
  logger.info(`💓  Health      : http://localhost:${PORT}/health`);
  logger.info(`🔔  WebSockets  : Socket.io ready`);
  logger.info(`💳  Payments    : Paystack + Flutterwave (NGN)`);
});

module.exports = { server, io };