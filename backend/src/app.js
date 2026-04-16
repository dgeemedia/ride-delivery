// backend/src/app.js
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const path     = require('path');
const fs       = require('fs');
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
const callRoutes         = require('./routes/call.routes');
const debugRoutes        = require('./routes/debug.route');
const publicRoutes       = require('./routes/public.routes');

// ─── Feature-flagged routes (only imported when enabled) ──────────────────────
const ENABLE_SHIELD    = process.env.ENABLE_SHIELD    === 'true';
const ENABLE_CORPORATE = process.env.ENABLE_CORPORATE === 'true';
const ENABLE_DUOPAY    = process.env.ENABLE_DUOPAY    === 'true';

const shieldRoutes    = ENABLE_SHIELD    ? require('./routes/shield.routes')    : null;
const corporateRoutes = ENABLE_CORPORATE ? require('./routes/corporate.routes') : null;
const duopayRoutes    = ENABLE_DUOPAY    ? require('./routes/duopay.routes')    : null;

// ─── Middleware ───────────────────────────────────────────────────────────────
const { errorHandler } = require('./middleware/errorHandler');
const { logger }       = require('./utils/logger');
const { maintenanceMiddleware } = require('./middleware/maintenance.middleware'); // ← ADD THIS

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (ENABLE_SHIELD && req.path.startsWith('/shield/')) {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc:  ["'self'", "'unsafe-inline'", 'https://maps.googleapis.com', 'https://cdn.socket.io'],
          styleSrc:   ["'self'", "'unsafe-inline'"],
          imgSrc:     ["'self'", 'data:', 'https://*.googleapis.com', 'https://*.gstatic.com'],
          connectSrc: ["'self'", 'https://maps.googleapis.com', 'wss:', 'ws:'],
          frameSrc:   ["'none'"],
        },
      },
    })(req, res, next);
  }
  helmet()(req, res, next);
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  process.env.ADMIN_URL_PREVIEW,
].filter(Boolean);

// Vercel preview deploy pattern — covers all auto-generated preview URLs
const vercelPreviewPattern = /^https:\/\/ride-delivery-.*\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (vercelPreviewPattern.test(origin)) return callback(null, true);
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
  legacyHeaders:   false,
});
app.use('/api/', globalLimiter);

// SHIELD view limiter — only registered when SHIELD is enabled
if (ENABLE_SHIELD) {
  const shieldViewLimiter = rateLimit({
    windowMs: 60 * 1000,
    max:      60,
    message:  'Too many SHIELD pings.',
    standardHeaders: true,
    legacyHeaders:   false,
  });
  app.use('/api/shield/view', shieldViewLimiter);
}

// ─── Stricter limit on auth endpoints ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many auth attempts, please try again later.',
});
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/register',        authLimiter);

// ─── Webhook raw body (MUST be before express.json) ──────────────────────────
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
app.use(
  '/api/wallet/topup/verify',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => { req.rawBody = req.body; next(); }
);

if (ENABLE_DUOPAY) {
  app.use(
    '/api/duopay/webhook/paystack',
    express.raw({ type: 'application/json' }),
    (req, _res, next) => { req.rawBody = req.body; next(); }
  );
}

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request logging ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status:      'ok',
    timestamp:   new Date().toISOString(),
    uptime:      process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── SHIELD public web viewer — only when SHIELD is enabled ──────────────────
if (ENABLE_SHIELD) {
  app.get('/shield/:token', (req, res) => {
    const viewerPath = path.join(__dirname, '..', 'public', 'shield_viewer.html');
    try {
      let html = fs.readFileSync(viewerPath, 'utf8');
      html = html.replace('YOUR_GOOGLE_MAPS_API_KEY', process.env.GOOGLE_MAPS_API_KEY || '');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      logger.error('[SHIELD] Could not serve viewer HTML:', err.message);
      res.status(404).json({ success: false, message: 'SHIELD viewer not available.' });
    }
  });
}

app.use('/api/status', publicRoutes);
// ─── Maintenance gate
app.use(maintenanceMiddleware);

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
app.use('/api/calls',         callRoutes);
app.use('/api/debug',         debugRoutes);

if (ENABLE_SHIELD)    app.use('/api/shield',    shieldRoutes);
if (ENABLE_CORPORATE) app.use('/api/corporate', corporateRoutes);
if (ENABLE_DUOPAY)    app.use('/api/duopay',    duopayRoutes);

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
      admin:         '/api/admin',
      calls:         '/api/calls',
      debug:         '/api/debug',
      ...(ENABLE_SHIELD    && { shield:    '/api/shield'    }),
      ...(ENABLE_CORPORATE && { corporate: '/api/corporate' }),
      ...(ENABLE_DUOPAY    && { duopay:    '/api/duopay'    }),
    },
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;