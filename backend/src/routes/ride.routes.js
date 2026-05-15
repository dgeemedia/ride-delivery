// backend/src/routes/ride.routes.js

const express         = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl            = require('../controllers/ride.controller');

const router = express.Router();

// ── Public route — no auth required ─────────────────────────────────────────

/**
 * GET /api/rides/platform-rates
 * Returns live admin-set base rates and delivery settings.
 * Public so the floor price screen can show rates before/without auth.
 */
router.get('/platform-rates', ctrl.getPlatformRates);

// ── Every route below requires a valid JWT ───────────────────────────────────
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// STATIC ROUTES (before /:id)
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/estimate',
  [
    query('pickupLat').isFloat({ min: -90, max: 90 }),
    query('pickupLng').isFloat({ min: -180, max: 180 }),
    query('dropoffLat').isFloat({ min: -90, max: 90 }),
    query('dropoffLng').isFloat({ min: -180, max: 180 }),
    query('vehicleType').optional().isIn(['CAR', 'BIKE', 'VAN', 'MOTORCYCLE', 'TRICYCLE']),
  ],
  ctrl.getFareEstimate
);

router.get('/active',   ctrl.getActiveRide);

router.get(
  '/history',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  ctrl.getRideHistory
);

router.get(
  '/nearby-drivers',
  authorize('CUSTOMER'),
  [
    query('pickupLat').isFloat({ min: -90, max: 90 }),
    query('pickupLng').isFloat({ min: -180, max: 180 }),
    query('radiusKm').optional().isFloat({ min: 0.5, max: 50 }),
    query('vehicleType').optional().isIn(['CAR', 'BIKE', 'VAN', 'MOTORCYCLE', 'TRICYCLE']),
  ],
  ctrl.getNearbyDrivers
);

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
    body('vehicleType').optional().isIn(['CAR', 'BIKE', 'VAN', 'MOTORCYCLE', 'TRICYCLE']),
    body('notes').optional().isString().isLength({ max: 500 }),
    body('promoCode').optional().isString(),
  ],
  ctrl.requestRide
);

router.post(
  '/request-driver',
  authorize('CUSTOMER'),
  [
    body('pickupAddress').notEmpty(),
    body('pickupLat').isFloat({ min: -90, max: 90 }),
    body('pickupLng').isFloat({ min: -180, max: 180 }),
    body('dropoffAddress').notEmpty(),
    body('dropoffLat').isFloat({ min: -90, max: 90 }),
    body('dropoffLng').isFloat({ min: -180, max: 180 }),
    body('driverId').notEmpty().isString(),
    body('vehicleType').optional().isIn(['CAR', 'BIKE', 'VAN', 'MOTORCYCLE', 'TRICYCLE']),
    body('paymentMethod').optional().isIn(['CASH', 'CARD', 'WALLET']),
    body('notes').optional().isString().isLength({ max: 500 }),
    body('promoCode').optional().isString(),
    body('driverFloorPrice').optional().isFloat({ min: 0 }),
  ],
  ctrl.requestSpecificDriver
);

// ─────────────────────────────────────────────────────────────────────────────
// PARAMETERISED ROUTES  (must come AFTER all static paths)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:id', ctrl.getRideById);

router.put('/:id/accept',   authorize('DRIVER'), ctrl.acceptRide);
router.put('/:id/arrived',  authorize('DRIVER'), ctrl.arrivedAtPickup);
router.put('/:id/start',    authorize('DRIVER'), ctrl.startRide);

router.put(
  '/:id/complete',
  authorize('DRIVER'),
  [
    body('actualFare').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['CASH', 'CARD', 'WALLET']),
  ],
  ctrl.completeRide
);

router.put(
  '/:id/cancel',
  [body('reason').optional().isString().isLength({ max: 300 })],
  ctrl.cancelRide
);

router.post(
  '/:id/rate',
  authorize('CUSTOMER'),
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString().isLength({ max: 1000 }),
  ],
  ctrl.rateRide
);

module.exports = router;