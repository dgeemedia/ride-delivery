// backend/src/routes/delivery.routes.js
const express  = require('express');
const { body, param, query } = require('express-validator'); // ← added query
const deliveryController = require('../controllers/delivery.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/estimate', deliveryController.getFeeEstimate);

// ── nearby-partners MUST be before /:id ──────────────────────────────────────
router.get(
  '/nearby-partners',
  authorize('CUSTOMER'),
  [
    query('pickupLat').isFloat({ min: -90, max: 90 }),
    query('pickupLng').isFloat({ min: -180, max: 180 }),
    query('radiusKm').optional().isFloat({ min: 0.5, max: 50 }),
  ],
  deliveryController.getNearbyPartners
);

router.get('/active',   deliveryController.getActiveDelivery);
router.get('/history',  deliveryController.getDeliveryHistory);

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
    body('notes').optional().isString(),
    body('promoCode').optional().isString(),
  ],
  deliveryController.requestDelivery
);

// ── Parameterised routes (after all statics) ──────────────────────────────────
router.get('/:id',  param('id').isUUID(), deliveryController.getDeliveryById);

router.put('/:id/accept',
  authorize('DELIVERY_PARTNER'), param('id').isUUID(), deliveryController.acceptDelivery);

router.put('/:id/pickup',
  authorize('DELIVERY_PARTNER'), param('id').isUUID(), deliveryController.pickupDelivery);

router.put('/:id/transit',
  authorize('DELIVERY_PARTNER'), param('id').isUUID(), deliveryController.startTransit);

router.put(
  '/:id/complete',
  authorize('DELIVERY_PARTNER'),
  param('id').isUUID(),
  [
    body('actualFee').optional().isFloat({ min: 0 }),
    body('recipientName').notEmpty(),
    body('deliveryImageUrl').optional().isURL(),
    body('paymentMethod').optional().isIn(['CASH', 'CARD', 'WALLET']),
  ],
  deliveryController.completeDelivery
);

router.put('/:id/cancel',
  param('id').isUUID(),
  [body('reason').optional().isString()],
  deliveryController.cancelDelivery);

router.post(
  '/:id/rate',
  param('id').isUUID(),
  [body('rating').isInt({ min: 1, max: 5 }), body('comment').optional().isString()],
  deliveryController.rateDelivery
);

module.exports = router;