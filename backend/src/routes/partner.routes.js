const express = require('express');
const { body } = require('express-validator');
const partnerController = require('../controllers/partner.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/partners/profile
 * @desc    Create or update delivery partner profile
 * @access  Private (DELIVERY_PARTNER)
 */
router.post(
  '/profile',
  authorize('DELIVERY_PARTNER'),
  [
    body('vehicleType').isIn(['BIKE', 'CAR', 'MOTORCYCLE', 'VAN']),
    body('vehiclePlate').optional().isString(),
    body('idImageUrl').optional().isURL(),
    body('vehicleImageUrl').optional().isURL()
  ],
  partnerController.createOrUpdateProfile
);

/**
 * @route   GET /api/partners/profile
 * @desc    Get delivery partner profile
 * @access  Private (DELIVERY_PARTNER)
 */
router.get('/profile', authorize('DELIVERY_PARTNER'), partnerController.getProfile);

/**
 * @route   PUT /api/partners/status
 * @desc    Update online/offline status
 * @access  Private (DELIVERY_PARTNER)
 */
router.put(
  '/status',
  authorize('DELIVERY_PARTNER'),
  [
    body('isOnline').isBoolean(),
    body('currentLat').optional().isFloat({ min: -90, max: 90 }),
    body('currentLng').optional().isFloat({ min: -180, max: 180 })
  ],
  partnerController.updateStatus
);

/**
 * @route   GET /api/partners/earnings
 * @desc    Get partner earnings
 * @access  Private (DELIVERY_PARTNER)
 */
router.get('/earnings', authorize('DELIVERY_PARTNER'), partnerController.getEarnings);

/**
 * @route   GET /api/partners/stats
 * @desc    Get partner statistics
 * @access  Private (DELIVERY_PARTNER)
 */
router.get('/stats', authorize('DELIVERY_PARTNER'), partnerController.getStats);

/**
 * @route   GET /api/partners/nearby-requests
 * @desc    Get nearby delivery requests
 * @access  Private (DELIVERY_PARTNER)
 */
router.get('/nearby-requests', authorize('DELIVERY_PARTNER'), partnerController.getNearbyRequests);

/**
 * @route   POST /api/partners/documents
 * @desc    Upload partner documents
 * @access  Private (DELIVERY_PARTNER)
 */
router.post(
  '/documents',
  authorize('DELIVERY_PARTNER'),
  [
    body('idImageUrl').optional().isURL(),
    body('vehicleImageUrl').optional().isURL()
  ],
  partnerController.uploadDocuments
);

module.exports = router;