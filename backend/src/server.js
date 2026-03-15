// backend/src/server.js
require('dotenv').config();
const http = require('http');
const app  = require('./app');
const { Server } = require('socket.io');
const { logger } = require('./utils/logger');
const { initializeSocketHandlers } = require('./services/socket.service');

const PORT = parseInt(process.env.PORT) || 3000;
const HOST = '0.0.0.0'; // ← bind to all interfaces so phone + web can reach it
const IS_DEV = process.env.NODE_ENV !== 'production';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // In development: allow every origin so Expo Web (localhost:8081/19006),
    // the Android device on your LAN, and any browser tab all connect freely.
    // In production: restrict to explicit CLIENT_URL / ADMIN_URL env vars.
    origin: (origin, callback) => {
      if (IS_DEV) return callback(null, true); // ← open for all dev origins

      if (!origin) return callback(null, true); // same-origin / curl / mobile

      const allowed = [
        process.env.CLIENT_URL,
        process.env.ADMIN_URL,
      ].filter(Boolean);

      if (allowed.includes(origin)) return callback(null, true);

      callback(new Error(`Socket CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
  // Allow both polling (web fallback) and websocket (preferred on native)
  transports: ['polling', 'websocket'],
});

// ✅ Make io accessible in controllers via req.app.get('io')
app.set('io', io);

// Wire socket handlers AND inject io into notification.service
initializeSocketHandlers(io);

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — closing HTTP server`);
  server.close(() => { logger.info('HTTP server closed'); process.exit(0); });
  setTimeout(() => { logger.error('Forced shutdown after timeout'); process.exit(1); }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  // Get the actual LAN IP so it's easy to copy into .env
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let lanIP = 'localhost';
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        lanIP = iface.address;
        break;
      }
    }
    if (lanIP !== 'localhost') break;
  }

  logger.info(`🚀  Server running on port ${PORT}`);
  logger.info(`📍  Environment : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗  Local       : http://localhost:${PORT}/api`);
  logger.info(`📱  On network  : http://${lanIP}:${PORT}/api  ← use this in .env`);
  logger.info(`💓  Health      : http://${lanIP}:${PORT}/health`);
  logger.info(`🔔  WebSockets  : Socket.io ready`);
  logger.info(`💳  Payments    : Paystack + Flutterwave (NGN)`);
});

module.exports = { server, io };