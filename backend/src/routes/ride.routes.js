// backend/src/routes/ride.routes.js
//
// Mounted at /api/rides in app.js / server.js.
//
// ORDERING NOTE: static paths (/estimate, /active, /history, /nearby-drivers,
// /request-driver) MUST come before the /:id wildcard or Express will try to
// match them as a ride ID.

const express       = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl          = require('../controllers/ride.controller');

const router = express.Router();

// ── Every ride route requires a valid JWT ────────────────────────────────────
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// STATIC ROUTES (before /:id)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/rides/estimate
 * Full fare breakdown: surge, booking fee, driver earnings, ETA.
 */
router.get(
  '/estimate',
  [
    query('pickupLat').isFloat({ min: -90, max: 90 }),
    query('pickupLng').isFloat({ min: -180, max: 180 }),
    query('dropoffLat').isFloat({ min: -90, max: 90 }),
    query('dropoffLng').isFloat({ min: -180, max: 180 }),
    query('vehicleType').optional().isIn(['CAR', 'BIKE', 'VAN', 'MOTORCYCLE']),
  ],
  ctrl.getFareEstimate
);

/**
 * GET /api/rides/active
 * Returns the caller's active ride (REQUESTED → IN_PROGRESS).
 * Response now includes surgeMultiplier + surgeLabel so the frontend banner
 * does not need a second /estimate call.
 */
router.get('/active', ctrl.getActiveRide);

/** GET /api/rides/history — paginated COMPLETED / CANCELLED rides */
router.get(
  '/history',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  ctrl.getRideHistory
);

/**
 * GET /api/rides/nearby-drivers
 * Online, approved drivers within radiusKm of pickup, with 3 km fare preview.
 */
router.get(
  '/nearby-drivers',
  authorize('CUSTOMER'),
  [
    query('pickupLat').isFloat({ min: -90, max: 90 }),
    query('pickupLng').isFloat({ min: -180, max: 180 }),
    query('radiusKm').optional().isFloat({ min: 0.5, max: 50 }),
    query('vehicleType').optional().isIn(['CAR', 'BIKE', 'VAN', 'MOTORCYCLE']),
  ],
  ctrl.getNearbyDrivers
);

/**
 * POST /api/rides/request
 * Standard ride request — broadcast to all online drivers.
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
    body('vehicleType').optional().isIn(['CAR', 'BIKE', 'VAN', 'MOTORCYCLE']),
    body('notes').optional().isString().isLength({ max: 500 }),
    body('promoCode').optional().isString(),
  ],
  ctrl.requestRide
);

/**
 * POST /api/rides/request-driver
 * Request a specific driver from the nearby-drivers list.
 * Supports driverFloorPrice (capped at +30% above platform estimate).
 * The controller encodes the floor multiplier in the ride's notes so
 * completeRide can recover it for accurate final-fare calculation.
 */
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
    body('vehicleType').optional().isIn(['CAR', 'BIKE', 'VAN', 'MOTORCYCLE']),
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

/** GET /api/rides/:id — full detail; only customer or assigned driver */
router.get('/:id', ctrl.getRideById);

/** PUT /api/rides/:id/accept — driver accepts REQUESTED ride */
router.put('/:id/accept', authorize('DRIVER'), ctrl.acceptRide);

/** PUT /api/rides/:id/arrived — driver marks arrival at pickup */
router.put('/:id/arrived', authorize('DRIVER'), ctrl.arrivedAtPickup);

/** PUT /api/rides/:id/start — driver starts the ride; records startedAt */
router.put('/:id/start', authorize('DRIVER'), ctrl.startRide);

/**
 * PUT /api/rides/:id/complete
 * Final fare is always recalculated server-side using actual trip time
 * (startedAt → now) so Lagos traffic is automatically captured.
 * The driverFloorMultiplier is recovered from the ride's notes field.
 *
 * actualFare is OPTIONAL in the body — it is informational only and is
 * never used for billing. The server is the single source of truth.
 */
router.put(
  '/:id/complete',
  authorize('DRIVER'),
  [
    body('actualFare').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['CASH', 'CARD', 'WALLET']),
  ],
  ctrl.completeRide
);

/**
 * PUT /api/rides/:id/cancel
 * Customer or driver. ₦200 cancellation fee if customer cancels post-accept.
 */
router.put(
  '/:id/cancel',
  [body('reason').optional().isString().isLength({ max: 300 })],
  ctrl.cancelRide
);

/**
 * POST /api/rides/:id/rate
 * Customer rates completed ride (1–5 stars).
 */
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