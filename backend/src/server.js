// backend/src/server.js
require('dotenv').config();
const http = require('http');
const app    = require('./app');
const prisma = require('./lib/prisma');   // ← import singleton here too
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
    methods: ['GET', 'POST'],
  },
  pingTimeout:  60000,
  pingInterval: 25000,
});

initializeSocketHandlers(io);

// ─────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — closing HTTP server`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('HTTP server + DB connection closed');
    process.exit(0);
  });
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
// START — verify DB before accepting traffic
// ─────────────────────────────────────────────────────────────────────────────
const start = async () => {
  // Ping DB — wakes Supabase free-tier if paused
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('🗄️   Database    : Supabase connected');
  } catch (err) {
    logger.error('❌  Database connection failed on startup:', err.message);
    logger.warn('⚠️   Server will still start — Prisma will retry on first request');
  }

  server.listen(PORT, () => {
    logger.info(`🚀  Server running on port ${PORT}`);
    logger.info(`📍  Environment : ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗  API         : http://localhost:${PORT}/api`);
    logger.info(`💓  Health      : http://localhost:${PORT}/health`);
    logger.info(`🔔  WebSockets  : Socket.io ready`);
    logger.info(`💳  Payments    : Paystack + Flutterwave (NGN)`);
  });
};

start();

module.exports = { server, io };