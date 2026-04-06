// backend/src/routes/driver.routes.js
// Mounted at /api/drivers in app.js / server.js.

const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/driver.controller');

const router = express.Router();

router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/drivers/profile
 * Create or update driver profile + vehicle info.
 * Document URLs are required on first submission.
 *
 * FIX: Added TRICYCLE to vehicleType allowlist — it is present in VEHICLE_TYPES
 * constants, the VehicleType enum, and the DB schema but was missing here.
 */
router.post(
  '/profile',
  authorize('DRIVER'),
  [
    body('licenseNumber').notEmpty(),
    body('vehicleType').isIn(['BIKE', 'CAR', 'MOTORCYCLE', 'VAN', 'TRICYCLE']), // ← FIX
    body('vehicleMake').notEmpty(),
    body('vehicleModel').notEmpty(),
    body('vehicleYear').isInt({ min: 1990, max: new Date().getFullYear() + 1 }),
    body('vehicleColor').notEmpty(),
    body('vehiclePlate').notEmpty(),
    body('licenseImageUrl').optional().isURL(),
    body('vehicleRegUrl').optional().isURL(),
    body('insuranceUrl').optional().isURL(),
  ],
  ctrl.createOrUpdateProfile
);

/** GET /api/drivers/profile — current driver's profile + user fields */
router.get('/profile', authorize('DRIVER'), ctrl.getProfile);

/**
 * POST /api/drivers/documents
 * Upload / refresh document URLs without touching vehicle data.
 */
router.post(
  '/documents',
  authorize('DRIVER'),
  [
    body('licenseImageUrl').optional().isURL(),
    body('vehicleRegUrl').optional().isURL(),
    body('insuranceUrl').optional().isURL(),
  ],
  ctrl.uploadDocuments
);

// ─────────────────────────────────────────────────────────────────────────────
// ONLINE / LOCATION STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /api/drivers/status
 * Toggle online/offline. Requires GPS coordinates when going online.
 * Rejects going offline while an active ride exists.
 */
router.put(
  '/status',
  authorize('DRIVER'),
  [
    body('isOnline').isBoolean(),
    body('currentLat').optional().isFloat({ min: -90, max: 90 }),
    body('currentLng').optional().isFloat({ min: -180, max: 180 }),
  ],
  ctrl.updateStatus
);

// ─────────────────────────────────────────────────────────────────────────────
// EARNINGS & STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/drivers/earnings?period=today|week|month|all
 * Returns net earnings using the stored payment.driverEarnings field
 * (which already accounts for the booking-fee deduction before commission).
 * Also returns wallet balance and per-ride breakdown.
 */
router.get(
  '/earnings',
  authorize('DRIVER'),
  [
    query('period').optional().isIn(['today', 'week', 'month', 'all']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  ctrl.getEarnings
);

/** GET /api/drivers/stats — totals, ratings, acceptance rate */
router.get('/stats', authorize('DRIVER'), ctrl.getStats);

/**
 * GET /api/drivers/nearby-requests
 * Returns open REQUESTED rides near the driver's current location.
 * Driver must be online with a stored location.
 */
router.get('/nearby-requests', authorize('DRIVER'), ctrl.getNearbyRequests);

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/drivers/payout/request
 * Verify bank account → create Paystack recipient → initiate transfer.
 * Minimum payout ₦1,000. Deducts withdrawable wallet balance only
 * (non-withdrawable onboarding bonus is excluded).
 */
router.post(
  '/payout/request',
  authorize('DRIVER'),
  [
    body('amount').isFloat({ min: 1000 }).withMessage('Minimum payout is ₦1,000'),
    body('accountNumber').notEmpty().isLength({ min: 10, max: 10 }).withMessage('Account number must be 10 digits'),
    body('bankCode').notEmpty(),
    body('accountName').optional().isString(),
  ],
  ctrl.requestPayout
);

/**
 * GET /api/drivers/payout/history?status=PENDING|COMPLETED|FAILED
 */
router.get(
  '/payout/history',
  authorize('DRIVER'),
  [query('status').optional().isIn(['PENDING', 'COMPLETED', 'FAILED'])],
  ctrl.getPayoutHistory
);

module.exports = router;