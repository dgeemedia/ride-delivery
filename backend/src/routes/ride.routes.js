const express = require('express');
const { body, param } = require('express-validator');
const rideController = require('../controllers/ride.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/rides/request
 * @desc    Request a new ride
 * @access  Private (CUSTOMER)
 */
router.post(
  '/request',
  authorize('CUSTOMER'),
  [
    body('pickupAddress').notEmpty(),
    body('pickupLat').isFloat({ min: -90, max: 90 }),
    body('pickupLng').isFloat({ min: -180, max: 180 }),
    body('dropoffAddress').notEmpty(),
    body('dropoffLat').isFloat({ min: -90, max: 90 }),
    body('dropoffLng').isFloat({ min: -180, max: 180 }),
    body('notes').optional().isString()
  ],
  rideController.requestRide
);

/**
 * @route   GET /api/rides/estimate
 * @desc    Get fare estimate
 * @access  Private
 */
router.get('/estimate', rideController.getFareEstimate);

/**
 * @route   GET /api/rides/active
 * @desc    Get user's active ride
 * @access  Private
 */
router.get('/active', rideController.getActiveRide);

/**
 * @route   GET /api/rides/history
 * @desc    Get ride history
 * @access  Private
 */
router.get('/history', rideController.getRideHistory);

/**
 * @route   GET /api/rides/:id
 * @desc    Get ride details
 * @access  Private
 */
router.get('/:id', param('id').isUUID(), rideController.getRideById);

/**
 * @route   PUT /api/rides/:id/accept
 * @desc    Driver accepts ride
 * @access  Private (DRIVER)
 */
router.put(
  '/:id/accept',
  authorize('DRIVER'),
  param('id').isUUID(),
  rideController.acceptRide
);

/**
 * @route   PUT /api/rides/:id/start
 * @desc    Driver starts ride
 * @access  Private (DRIVER)
 */
router.put(
  '/:id/start',
  authorize('DRIVER'),
  param('id').isUUID(),
  rideController.startRide
);

/**
 * @route   PUT /api/rides/:id/complete
 * @desc    Driver completes ride
 * @access  Private (DRIVER)
 */
router.put(
  '/:id/complete',
  authorize('DRIVER'),
  param('id').isUUID(),
  [body('actualFare').isFloat({ min: 0 })],
  rideController.completeRide
);

/**
 * @route   PUT /api/rides/:id/cancel
 * @desc    Cancel ride
 * @access  Private
 */
router.put(
  '/:id/cancel',
  param('id').isUUID(),
  [body('reason').optional().isString()],
  rideController.cancelRide
);

/**
 * @route   POST /api/rides/:id/rate
 * @desc    Rate completed ride
 * @access  Private
 */
router.post(
  '/:id/rate',
  param('id').isUUID(),
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString()
  ],
  rideController.rateRide
);

// FUTURE: Add scheduled rides
// router.post('/schedule', authorize('CUSTOMER'), rideController.scheduleRide);
// router.get('/scheduled', rideController.getScheduledRides);

// FUTURE: Add ride sharing
// router.post('/share', authorize('CUSTOMER'), rideController.shareRide);

module.exports = router;