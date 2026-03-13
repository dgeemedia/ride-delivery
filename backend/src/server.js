// backend/src/server.js
require('dotenv').config();
const http = require('http');
const app  = require('./app');
const { Server } = require('socket.io');
const { logger } = require('./utils/logger');
const { initializeSocketHandlers } = require('./services/socket.service');

const PORT = parseInt(process.env.PORT) || 3000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = [
        process.env.CLIENT_URL,
        process.env.ADMIN_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
      ].filter(Boolean);
      if (allowed.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      callback(new Error(`Socket CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
});

// ✅ Make io accessible in controllers via req.app.get('io')
app.set('io', io);

// Wire socket handlers AND inject io into notification.service
initializeSocketHandlers(io);

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

server.listen(PORT, () => {
  logger.info(`🚀  Server running on port ${PORT}`);
  logger.info(`📍  Environment : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗  API         : http://localhost:${PORT}/api`);
  logger.info(`💓  Health      : http://localhost:${PORT}/health`);
  logger.info(`🔔  WebSockets  : Socket.io ready`);
  logger.info(`💳  Payments    : Paystack + Flutterwave (NGN)`);
});

module.exports = { server, io };
