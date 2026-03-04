const express = require('express');
const { body } = require('express-validator');
const driverController = require('../controllers/driver.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/drivers/profile
 * @desc    Create or update driver profile
 * @access  Private (DRIVER)
 */
router.post(
  '/profile',
  authorize('DRIVER'),
  [
    body('licenseNumber').notEmpty(),
    body('vehicleType').isIn(['BIKE', 'CAR', 'MOTORCYCLE', 'VAN']),
    body('vehicleMake').notEmpty(),
    body('vehicleModel').notEmpty(),
    body('vehicleYear').isInt({ min: 1990, max: new Date().getFullYear() + 1 }),
    body('vehicleColor').notEmpty(),
    body('vehiclePlate').notEmpty(),
    body('licenseImageUrl').optional().isURL(),
    body('vehicleRegUrl').optional().isURL(),
    body('insuranceUrl').optional().isURL()
  ],
  driverController.createOrUpdateProfile
);

/**
 * @route   GET /api/drivers/profile
 * @desc    Get driver profile
 * @access  Private (DRIVER)
 */
router.get('/profile', authorize('DRIVER'), driverController.getProfile);

/**
 * @route   PUT /api/drivers/status
 * @desc    Update online/offline status
 * @access  Private (DRIVER)
 */
router.put(
  '/status',
  authorize('DRIVER'),
  [
    body('isOnline').isBoolean(),
    body('currentLat').optional().isFloat({ min: -90, max: 90 }),
    body('currentLng').optional().isFloat({ min: -180, max: 180 })
  ],
  driverController.updateStatus
);

/**
 * @route   GET /api/drivers/earnings
 * @desc    Get driver earnings
 * @access  Private (DRIVER)
 */
router.get('/earnings', authorize('DRIVER'), driverController.getEarnings);

/**
 * @route   GET /api/drivers/stats
 * @desc    Get driver statistics
 * @access  Private (DRIVER)
 */
router.get('/stats', authorize('DRIVER'), driverController.getStats);

/**
 * @route   GET /api/drivers/nearby-requests
 * @desc    Get nearby ride requests
 * @access  Private (DRIVER)
 */
router.get('/nearby-requests', authorize('DRIVER'), driverController.getNearbyRequests);

/**
 * @route   POST /api/drivers/documents
 * @desc    Upload driver documents
 * @access  Private (DRIVER)
 */
router.post(
  '/documents',
  authorize('DRIVER'),
  [
    body('licenseImageUrl').optional().isURL(),
    body('vehicleRegUrl').optional().isURL(),
    body('insuranceUrl').optional().isURL()
  ],
  driverController.uploadDocuments
);

// FUTURE: Payout requests
// router.post('/payout/request', driverController.requestPayout);
// router.get('/payout/history', driverController.getPayoutHistory);

module.exports = router;