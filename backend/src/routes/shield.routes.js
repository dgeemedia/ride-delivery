// backend/src/routes/shield.routes.js
// Mounted at /api/shield in app.js / server.js
//
// Mount example:
//   const shieldRoutes = require('./routes/shield.routes');
//   app.use('/api/shield', shieldRoutes);

'use strict';

const express       = require('express');
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl          = require('../controllers/shield.controller');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES — no authentication (beneficiary browser view)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/shield/view/:token
 * Returns safe ride/delivery info for the beneficiary's web page.
 */
router.get(
  '/view/:token',
  param('token').isLength({ min: 10, max: 100 }).isAlphanumeric(),
  ctrl.getSessionView
);

/**
 * POST /api/shield/view/:token/ping
 * Beneficiary heartbeat — called every 30 s by the web viewer.
 */
router.post(
  '/view/:token/ping',
  param('token').isLength({ min: 10, max: 100 }).isAlphanumeric(),
  ctrl.pingSession
);

/**
 * POST /api/shield/view/:token/alert
 * Beneficiary triggers a safety-check alert to the driver.
 */
router.post(
  '/view/:token/alert',
  param('token').isLength({ min: 10, max: 100 }).isAlphanumeric(),
  ctrl.beneficiaryAlert
);

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE ROUTES — require JWT
// ─────────────────────────────────────────────────────────────────────────────

router.use(authenticate);

// ── Beneficiary management ────────────────────────────────────────────────────

/**
 * GET /api/shield/beneficiaries
 * List all saved guardians for the current user.
 */
router.get('/beneficiaries', authorize('CUSTOMER'), ctrl.listBeneficiaries);

/**
 * POST /api/shield/beneficiaries
 */
router.post(
  '/beneficiaries',
  authorize('CUSTOMER'),
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('phone').isMobilePhone(),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('isDefault').optional().isBoolean(),
  ],
  ctrl.addBeneficiary
);

/**
 * PUT /api/shield/beneficiaries/:id
 */
router.put(
  '/beneficiaries/:id',
  authorize('CUSTOMER'),
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('phone').optional().isMobilePhone(),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('isDefault').optional().isBoolean(),
  ],
  ctrl.updateBeneficiary
);

/**
 * DELETE /api/shield/beneficiaries/:id
 */
router.delete('/beneficiaries/:id', authorize('CUSTOMER'), ctrl.deleteBeneficiary);

// ── Session lifecycle ─────────────────────────────────────────────────────────

/**
 * POST /api/shield/activate
 * Creates a new SHIELD session and returns share link + WhatsApp deep-link.
 */
router.post(
  '/activate',
  authorize('CUSTOMER'),
  [
    body('rideId').optional().isString(),
    body('deliveryId').optional().isString(),
    body('beneficiaryId').optional().isString(),
    body('beneficiaryName').optional().trim().notEmpty(),
    body('beneficiaryPhone').optional().isMobilePhone(),
    body('beneficiaryEmail').optional({ checkFalsy: true }).isEmail(),
  ],
  ctrl.activateShield
);

/**
 * POST /api/shield/deactivate
 */
router.post(
  '/deactivate',
  authorize('CUSTOMER'),
  [
    body('rideId').optional().isString(),
    body('deliveryId').optional().isString(),
  ],
  ctrl.deactivateShield
);

/**
 * POST /api/shield/arrived-safe
 * Customer taps "I'm safe" at destination.
 */
router.post(
  '/arrived-safe',
  authorize('CUSTOMER'),
  [
    body('rideId').optional().isString(),
    body('deliveryId').optional().isString(),
  ],
  ctrl.arrivedSafe
);

/**
 * GET /api/shield/session?rideId=&deliveryId=
 * Returns current active SHIELD session for a ride or delivery.
 */
router.get('/session', authorize('CUSTOMER'), ctrl.getActiveSession);

/**
 * POST /api/shield/driver/confirm-safe
 * Driver/partner responds to a beneficiary safety-check notification.
 */
router.post(
  '/driver/confirm-safe',
  authorize('DRIVER', 'DELIVERY_PARTNER'),
  [body('sessionId').notEmpty().isString()],
  ctrl.driverConfirmSafe
);

module.exports = router;