require('dotenv').config();
const http = require('http');
const app = require('./app');
const { Server } = require('socket.io');
const { logger } = require('./utils/logger');
const { initializeSocketHandlers } = require('./services/socket.service');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://yourdomain.com']
      : '*',
    methods: ['GET', 'POST']
  }
});

// Initialize socket event handlers
initializeSocketHandlers(io);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 API: http://localhost:${PORT}/api`);
  logger.info(`💓 Health Check: http://localhost:${PORT}/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // FUTURE: Send alert to monitoring service
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = { server, io };