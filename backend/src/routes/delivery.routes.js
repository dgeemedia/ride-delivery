const express = require('express');
const { body, param } = require('express-validator');
const deliveryController = require('../controllers/delivery.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/deliveries/estimate
 * @desc    Get delivery fee estimate
 * @access  Private
 */
router.get('/estimate', deliveryController.getFeeEstimate);

/**
 * @route   POST /api/deliveries/request
 * @desc    Request a new delivery
 * @access  Private (CUSTOMER)
 */
router.post(
  '/request',
  authorize('CUSTOMER'),
  [
    body('pickupAddress').notEmpty(),
    body('pickupLat').isFloat({ min: -90, max: 90 }),
    body('pickupLng').isFloat({ min: -180, max: 180 }),
    body('pickupContact').notEmpty(),
    body('dropoffAddress').notEmpty(),
    body('dropoffLat').isFloat({ min: -90, max: 90 }),
    body('dropoffLng').isFloat({ min: -180, max: 180 }),
    body('dropoffContact').notEmpty(),
    body('packageDescription').notEmpty(),
    body('packageWeight').optional().isFloat({ min: 0 }),
    body('packageValue').optional().isFloat({ min: 0 }),
    body('notes').optional().isString()
  ],
  deliveryController.requestDelivery
);

/**
 * @route   GET /api/deliveries/active
 * @desc    Get active delivery
 * @access  Private
 */
router.get('/active', deliveryController.getActiveDelivery);

/**
 * @route   GET /api/deliveries/history
 * @desc    Get delivery history
 * @access  Private
 */
router.get('/history', deliveryController.getDeliveryHistory);

/**
 * @route   GET /api/deliveries/:id
 * @desc    Get delivery details
 * @access  Private
 */
router.get('/:id', param('id').isUUID(), deliveryController.getDeliveryById);

/**
 * @route   PUT /api/deliveries/:id/accept
 * @desc    Partner accepts delivery
 * @access  Private (DELIVERY_PARTNER)
 */
router.put(
  '/:id/accept',
  authorize('DELIVERY_PARTNER'),
  param('id').isUUID(),
  deliveryController.acceptDelivery
);

/**
 * @route   PUT /api/deliveries/:id/pickup
 * @desc    Confirm package pickup
 * @access  Private (DELIVERY_PARTNER)
 */
router.put(
  '/:id/pickup',
  authorize('DELIVERY_PARTNER'),
  param('id').isUUID(),
  deliveryController.pickupDelivery
);

/**
 * @route   PUT /api/deliveries/:id/transit
 * @desc    Start transit to dropoff
 * @access  Private (DELIVERY_PARTNER)
 */
router.put(
  '/:id/transit',
  authorize('DELIVERY_PARTNER'),
  param('id').isUUID(),
  deliveryController.startTransit
);

/**
 * @route   PUT /api/deliveries/:id/complete
 * @desc    Complete delivery
 * @access  Private (DELIVERY_PARTNER)
 */
router.put(
  '/:id/complete',
  authorize('DELIVERY_PARTNER'),
  param('id').isUUID(),
  [
    body('actualFee').optional().isFloat({ min: 0 }),
    body('recipientName').notEmpty(),
    body('deliveryImageUrl').optional().isURL()
  ],
  deliveryController.completeDelivery
);

/**
 * @route   PUT /api/deliveries/:id/cancel
 * @desc    Cancel delivery
 * @access  Private
 */
router.put(
  '/:id/cancel',
  param('id').isUUID(),
  [body('reason').optional().isString()],
  deliveryController.cancelDelivery
);

/**
 * @route   POST /api/deliveries/:id/rate
 * @desc    Rate completed delivery
 * @access  Private
 */
router.post(
  '/:id/rate',
  param('id').isUUID(),
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString()
  ],
  deliveryController.rateDelivery
);

// FUTURE: Add proof of delivery image upload
// router.post('/:id/proof', upload.single('image'), deliveryController.uploadProof);

module.exports = router;