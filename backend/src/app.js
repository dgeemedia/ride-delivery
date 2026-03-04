const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('express-async-errors');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const rideRoutes = require('./routes/ride.routes');
const deliveryRoutes = require('./routes/delivery.routes');
const driverRoutes = require('./routes/driver.routes');
const partnerRoutes = require('./routes/partner.routes');
const paymentRoutes = require('./routes/payment.routes');
const uploadRoutes = require('./routes/upload.routes');
const adminRoutes = require('./routes/admin.routes');

// Middleware
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Replace with your production domain
    : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

// FUTURE: Add analytics routes
// app.use('/api/analytics', analyticsRoutes);

// FUTURE: Add notification routes
// app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;