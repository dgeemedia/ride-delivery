// backend/src/server.js
require('dotenv').config();
const http = require('http');
const app  = require('./app');
const { Server } = require('socket.io');
const { logger } = require('./utils/logger');
const { initializeSocketHandlers } = require('./services/socket.service');
const { markOverdue }       = require('./services/duopay.service');
const { resetMonthlySpend } = require('./services/corporate.service');

const PORT   = parseInt(process.env.PORT) || 3000;
const HOST   = '0.0.0.0';
const IS_DEV = process.env.NODE_ENV !== 'production';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (IS_DEV) return callback(null, true);
      if (!origin)  return callback(null, true);

      const allowed = [
        process.env.CLIENT_URL,
        process.env.ADMIN_URL,
      ].filter(Boolean);

      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error(`Socket CORS blocked: ${origin}`));
    },
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
  transports:   ['polling', 'websocket'],
});

// ✅ Make io accessible in controllers via req.app.get('io')
app.set('io', io);

// Wire socket handlers AND inject io into notification.service
initializeSocketHandlers(io);

// ─── Lightweight cron jobs ────────────────────────────────────────────────────
// We use a simple hourly tick rather than a cron library to keep dependencies
// minimal. Both jobs check the WAT hour/day inside the tick so they only run
// once at the right moment even if the server has been up for days.
//
// For production at scale, replace these with Supabase pg_cron or node-cron.

const HOUR_MS = 60 * 60 * 1000;

setInterval(async () => {
  // WAT = UTC + 1
  const now     = new Date();
  const watHour = (now.getUTCHours() + 1) % 24;
  const watDay  = now.getUTCDate();

  // DuoPay: mark overdue transactions daily at 6 AM WAT
  if (watHour === 6) {
    logger.info('[Cron] Running DuoPay overdue check...');
    markOverdue()
      .then(r => logger.info(`[Cron] DuoPay: ${r.overdue} overdue, ${r.suspended} suspended`))
      .catch(err => logger.error('[Cron] DuoPay overdue error:', err.message));
  }

  // Corporate: reset employee monthly spend on 1st of month at midnight WAT
  if (watDay === 1 && watHour === 0) {
    logger.info('[Cron] Resetting corporate monthly spend...');
    resetMonthlySpend()
      .then(r => logger.info(`[Cron] Corporate: reset ${r.count} employees`))
      .catch(err => logger.error('[Cron] Corporate reset error:', err.message));
  }
}, HOUR_MS);

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

  logger.info(` Server running on port ${PORT}`);
  logger.info(` Environment : ${process.env.NODE_ENV || 'development'}`);
  logger.info(` Local       : http://localhost:${PORT}/api`);
  logger.info(` On network  : http://${lanIP}:${PORT}/api  ← use this in .env`);
  logger.info(` Health      : http://${lanIP}:${PORT}/health`);
  logger.info(` WebSockets  : Socket.io ready`);
  logger.info(` Payments    : Paystack + Flutterwave (NGN)`);
  logger.info(` Corporate   : /api/corporate`);
  logger.info(` DuoPay      : /api/duopay`);
});

module.exports = { server, io };