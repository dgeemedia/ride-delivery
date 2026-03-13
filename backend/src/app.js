// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('express-async-errors');

// ─── Routes ──────────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const userRoutes         = require('./routes/user.routes');
const rideRoutes         = require('./routes/ride.routes');
const deliveryRoutes     = require('./routes/delivery.routes');
const driverRoutes       = require('./routes/driver.routes');
const partnerRoutes      = require('./routes/partner.routes');
const paymentRoutes      = require('./routes/payment.routes');
const uploadRoutes       = require('./routes/upload.routes');
const adminRoutes        = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const walletRoutes       = require('./routes/wallet.routes');

// ─── Middleware ───────────────────────────────────────────────────────────────
const { errorHandler } = require('./middleware/errorHandler');
const { logger }       = require('./utils/logger');

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3001',   // admin dev
  'http://localhost:5173',   // vite default
  'http://localhost:3000',   // any local dev
  process.env.CLIENT_URL,    // production frontend
  process.env.ADMIN_URL,     // production admin panel
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    if (
      process.env.NODE_ENV !== 'production' ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ─── Global rate limit ────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message:  'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders:   false
});
app.use('/api/', globalLimiter);

// ─── Stricter limit on auth endpoints ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many auth attempts, please try again later.'
});
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/register',        authLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK RAW BODY  ← Must be registered BEFORE express.json()
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  '/api/payments/paystack/webhook',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => { req.rawBody = req.body; next(); }
);

app.use(
  '/api/payments/flutterwave/webhook',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => { req.rawBody = req.body; next(); }
);

// ─── JSON / URL-encoded body parsing ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/rides',         rideRoutes);
app.use('/api/deliveries',    deliveryRoutes);
app.use('/api/drivers',       driverRoutes);
app.use('/api/partners',      partnerRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/upload',        uploadRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wallet',        walletRoutes);

// ─── API index ────────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.status(200).json({
    message: 'DuoRide API v1.0',
    endpoints: {
      auth:          '/api/auth',
      users:         '/api/users',
      rides:         '/api/rides',
      deliveries:    '/api/deliveries',
      drivers:       '/api/drivers',
      partners:      '/api/partners',
      payments:      '/api/payments',
      wallet:        '/api/wallet',
      notifications: '/api/notifications',
      upload:        '/api/upload',
      admin:         '/api/admin'
    }
  });
});
app.use('/api/debug', require('./routes/debug.route'));
// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
