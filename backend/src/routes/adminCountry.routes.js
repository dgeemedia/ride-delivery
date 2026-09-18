// backend/src/routes/adminCountry.routes.js
//
// Mounted under /api/admin/countries by admin.routes.js, so it inherits the
// authenticate + admin-role gate already applied there. Writes are further
// restricted to SUPER_ADMIN: changing a country's payment providers or payout
// rail moves real money, so it sits at the same privilege level as editing
// system settings.

const express = require('express');
const { body, param } = require('express-validator');
const controller = require('../controllers/adminCountry.controller');
const { authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// ── Read ──────────────────────────────────────────────────────────────────
// Static paths first — 'overview' would otherwise be captured by ':code'.
router.get('/overview', authorize('ADMIN', 'SUPER_ADMIN'), controller.getAllCountriesOverview);
router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), controller.listCountries);

router.get(
  '/:code/overview',
  param('code').isLength({ min: 2, max: 2 }),
  authorize('ADMIN', 'SUPER_ADMIN'),
  controller.getCountryOverview
);

router.get(
  '/:code',
  param('code').isLength({ min: 2, max: 2 }),
  authorize('ADMIN', 'SUPER_ADMIN'),
  controller.getCountry
);

// ── Write ─────────────────────────────────────────────────────────────────
router.post(
  '/',
  authorize('SUPER_ADMIN'),
  [
    body('code').isLength({ min: 2, max: 2 }).withMessage('code must be a 2-letter ISO code'),
    body('name').notEmpty(),
    body('currencyCode').isLength({ min: 3, max: 3 }),
    body('phoneDialCode').notEmpty(),
  ],
  controller.createCountry
);

router.put(
  '/:code',
  authorize('SUPER_ADMIN'),
  param('code').isLength({ min: 2, max: 2 }),
  controller.updateCountry
);

// Separate from the full update so an admin can pause a market in one click
// without resubmitting the whole payment configuration.
router.patch(
  '/:code/status',
  authorize('SUPER_ADMIN'),
  param('code').isLength({ min: 2, max: 2 }),
  [body('isActive').isBoolean()],
  controller.setCountryStatus
);

module.exports = router;
