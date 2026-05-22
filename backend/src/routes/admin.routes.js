'use strict';
const express = require('express');
const { body, param } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize, requireScope } = require('../middleware/auth.middleware');

const router = express.Router();

// Base auth — must be logged in + have an admin-level role
router.use(authenticate);
router.use((req, res, next) => {
  if (!['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'MODERATOR'].includes(req.user.role))
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  next();
});

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
router.get('/dashboard/stats', adminController.getDashboardStats);

// ─────────────────────────────────────────────
// USER MANAGEMENT
// NOTE: Static routes (/create-admin) MUST come before dynamic routes (/:id)
// ─────────────────────────────────────────────
router.get('/users', adminController.getUsers);

// ✅ FIX: Moved BEFORE /users/:id so 'create-admin' isn't swallowed as a UUID param
router.post('/users/create-admin',
  authorize('SUPER_ADMIN'),
  [
    body('email').isEmail().normalizeEmail(),
    // ✅ FIX 1: was isMobilePhone() — fails Nigerian +234 numbers without a locale
    body('phone').isMobilePhone('any'),
    body('password').isLength({ min: 8 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MODERATOR', 'CUSTOMER', 'DRIVER', 'DELIVERY_PARTNER']),

    // ✅ FIX 2: optional({ nullable: true }) so sending null for general admin doesn't fail validation
    body('adminDepartment')
      .optional({ nullable: true })
      .if(body('adminDepartment').notEmpty())
      .isIn(['RIDES', 'DELIVERIES', 'SUPPORT']),

    // Driver fields
    body('licenseNumber')
      .if(body('role').equals('DRIVER'))
      .notEmpty().withMessage('License number required for drivers'),
    body('vehicleType')
      .if(body('role').equals('DRIVER'))
      .isIn(['BIKE', 'CAR', 'MOTORCYCLE', 'VAN', 'TRICYCLE']),
    body('vehicleMake')
      .if(body('role').equals('DRIVER'))
      .notEmpty(),
    body('vehicleModel')
      .if(body('role').equals('DRIVER'))
      .notEmpty(),
    body('vehicleYear')
      .if(body('role').equals('DRIVER'))
      .isInt({ min: 2000, max: new Date().getFullYear() + 1 }),
    body('vehicleColor')
      .if(body('role').equals('DRIVER'))
      .notEmpty(),
    body('vehiclePlate')
      .if(body('role').equals('DRIVER'))
      .notEmpty(),

    // Delivery partner fields
    body('vehicleType')
      .if(body('role').equals('DELIVERY_PARTNER'))
      .isIn(['BIKE', 'CAR', 'MOTORCYCLE', 'VAN', 'TRICYCLE']),
  ],
  validate,
  adminController.createAdminUser
);

router.get('/users/:id',
  param('id').isUUID(),
  validate,
  adminController.getUserById
);

router.put('/users/:id/suspend',
  param('id').isUUID(),
  body('reason').optional().isString(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.suspendUser
);

router.put('/users/:id/activate',
  param('id').isUUID(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.activateUser
);

router.delete('/users/:id',
  param('id').isUUID(),
  authorize('SUPER_ADMIN'),
  validate,
  adminController.deleteUser
);

// ─────────────────────────────────────────────
// DRIVER MANAGEMENT — RIDES scope
// /pending and static segments MUST come before /:id
// ─────────────────────────────────────────────
router.get('/drivers/pending',
  requireScope('RIDES'),
  adminController.getPendingDrivers
);

router.get('/drivers',
  requireScope('RIDES'),
  adminController.getDrivers
);

router.get('/drivers/:id',
  param('id').isUUID(),
  requireScope('RIDES'),
  validate,
  adminController.getDriverById
);

router.put('/drivers/:id/approve',
  param('id').isUUID(),
  requireScope('RIDES'),
  validate,
  adminController.approveDriver
);

router.put('/drivers/:id/reject',
  param('id').isUUID(),
  body('reason').notEmpty().withMessage('A rejection reason is required.'),
  requireScope('RIDES'),
  validate,
  adminController.rejectDriver
);

// ─────────────────────────────────────────────
// PARTNER MANAGEMENT — DELIVERIES scope
// ─────────────────────────────────────────────
router.get('/partners/pending',
  requireScope('DELIVERIES'),
  adminController.getPendingPartners
);

router.get('/partners',
  requireScope('DELIVERIES'),
  adminController.getPartners
);

router.get('/partners/:id',
  param('id').isUUID(),
  requireScope('DELIVERIES'),
  validate,
  adminController.getPartnerById
);

router.put('/partners/:id/approve',
  param('id').isUUID(),
  requireScope('DELIVERIES'),
  validate,
  adminController.approvePartner
);

router.put('/partners/:id/reject',
  param('id').isUUID(),
  body('reason').notEmpty().withMessage('A rejection reason is required.'),
  requireScope('DELIVERIES'),
  validate,
  adminController.rejectPartner
);

// ─────────────────────────────────────────────
// RIDE MANAGEMENT — RIDES scope
// /live before /:id
// ─────────────────────────────────────────────
router.get('/rides/live',
  requireScope('RIDES'),
  adminController.getLiveRides
);

router.get('/rides',
  requireScope('RIDES', 'SUPPORT'),
  adminController.getRides
);

router.get('/rides/:id',
  param('id').isUUID(),
  requireScope('RIDES', 'SUPPORT'),
  validate,
  adminController.getAdminRideById
);

router.put('/rides/:id/cancel',
  param('id').isUUID(),
  body('reason').optional().isString(),
  requireScope('RIDES'),
  validate,
  adminController.adminCancelRide
);

// ─────────────────────────────────────────────
// DELIVERY MANAGEMENT — DELIVERIES scope
// /live before /:id
// ─────────────────────────────────────────────
router.get('/deliveries/live',
  requireScope('DELIVERIES'),
  adminController.getLiveDeliveries
);

router.get('/deliveries',
  requireScope('DELIVERIES', 'SUPPORT'),
  adminController.getDeliveries
);

router.get('/deliveries/:id',
  param('id').isUUID(),
  requireScope('DELIVERIES', 'SUPPORT'),
  validate,
  adminController.getDeliveryById
);

router.put('/deliveries/:id/cancel',
  param('id').isUUID(),
  body('reason').optional().isString(),
  requireScope('DELIVERIES'),
  validate,
  adminController.cancelDelivery
);

// ─────────────────────────────────────────────
// PAYMENTS
// /stats before /:id to prevent 'stats' being treated as a UUID
// ─────────────────────────────────────────────
router.get('/payments/stats',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getPaymentStats
);

router.get('/payments',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getPayments
);

router.get('/payments/:id',
  param('id').isUUID(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.getPaymentById
);

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────
router.get('/analytics/commission',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getCommissionAnalytics
);

router.get('/analytics/revenue',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getRevenueAnalytics
);

router.get('/analytics/performance',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getPerformanceAnalytics
);

router.get('/analytics/user-growth',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getUserGrowth
);

// ─────────────────────────────────────────────
// SETTINGS
// SUPER_ADMIN only for write operations.
// /batch and /invalidate-cache before /:key to prevent being swallowed as a key param.
// ✅ FIX 3: Removed duplicate /settings/invalidate-cache route (was registered twice)
// ─────────────────────────────────────────────
router.get('/settings',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getSettings
);

router.patch('/settings/batch',
  authorize('SUPER_ADMIN'),
  adminController.updateSettingsBatch
);

router.post('/settings/invalidate-cache',
  authorize('SUPER_ADMIN'),
  (req, res) => {
    const { invalidateFareCache } = require('../utils/fareEngine');
    invalidateFareCache();
    res.json({ success: true, message: 'Fare cache cleared' });
  }
);

router.put('/settings/:key',
  body('value').notEmpty(),
  authorize('SUPER_ADMIN'),
  validate,
  adminController.updateSetting
);

// ─────────────────────────────────────────────
// PROMO CODES
// ─────────────────────────────────────────────
router.get('/promo-codes',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getPromoCodes
);

router.post('/promo-codes',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    body('code').notEmpty().isLength({ min: 3, max: 20 }),
    body('discountType').isIn(['percentage', 'fixed']),
    body('discountValue').isFloat({ min: 0 }),
    body('validFrom').isISO8601(),
    body('validUntil').isISO8601(),
    body('applicableFor').isIn(['rides', 'deliveries', 'both']),
  ],
  validate,
  adminController.createPromoCode
);

router.put('/promo-codes/:id/toggle',
  param('id').isUUID(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.togglePromoCode
);

// ─────────────────────────────────────────────
// SUPPORT TICKETS
// All admin roles can read; SUPPORT + ADMIN + SUPER_ADMIN can update.
// /:id routes after static segments.
// ─────────────────────────────────────────────
router.get('/tickets', adminController.getTickets);

router.get('/tickets/:id',
  param('id').isUUID(),
  validate,
  adminController.getTicketById
);

router.put('/tickets/:id',
  param('id').isUUID(),
  [
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    body('assignedTo').optional().isString(),
    body('resolution').optional().isString(),
    body('replyMessage').optional().isString(),
  ],
  validate,
  adminController.updateTicket
);

// ─────────────────────────────────────────────
// ACTIVITY LOGS
// ─────────────────────────────────────────────
router.get('/logs',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getActivityLogs
);

// ─────────────────────────────────────────────
// WALLETS
// ─────────────────────────────────────────────
router.get('/wallets',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.getWallets
);

router.post('/wallets/:userId/adjust',
  param('userId').isUUID(),
  authorize('SUPER_ADMIN'),
  [
    body('amount').isFloat({ min: 0.01 }),
    body('type').isIn(['credit', 'debit']),
    body('reason').optional().isString(),
  ],
  validate,
  adminController.adjustWallet
);

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────
router.post('/notifications/broadcast',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    body('title').notEmpty(),
    body('message').notEmpty(),
    body('role').optional().isIn(['CUSTOMER', 'DRIVER', 'DELIVERY_PARTNER']),
  ],
  validate,
  adminController.broadcastNotification
);

// ─────────────────────────────────────────────
// ONBOARDING BONUS — SUPER_ADMIN only
// /preview before / to avoid route ambiguity
// ─────────────────────────────────────────────
router.get('/bonuses/onboarding/preview',
  authorize('SUPER_ADMIN'),
  adminController.previewOnboardingBonuses
);

router.post('/bonuses/onboarding',
  authorize('SUPER_ADMIN'),
  [
    body('driverBonus').optional().isFloat({ min: 0 }),
    body('partnerBonus').optional().isFloat({ min: 0 }),
  ],
  validate,
  adminController.disburseOnboardingBonuses
);

// ─────────────────────────────────────────────
// CUSTOM BONUS DISBURSEMENT — SUPER_ADMIN only
// ─────────────────────────────────────────────
router.post('/bonuses/disburse',
  authorize('SUPER_ADMIN'),
  [
    body('userIds').isArray({ min: 1 }).withMessage('Select at least one recipient.'),
    body('userIds.*').isUUID(),
    body('amount').isFloat({ min: 1 }).withMessage('Bonus must be at least ₦1'),
    body('description').optional().isString().isLength({ max: 300 }),
    body('nonWithdrawable').optional().isBoolean(),
  ],
  validate,
  adminController.disburseCustomBonuses
);

// ─────────────────────────────────────────────
// SHIELD MONITORING
// Static segments before /:id
// ─────────────────────────────────────────────
router.get('/shield/stats', adminController.getShieldStats);

router.get('/shield/sessions', adminController.getShieldSessions);

router.get('/shield/sessions/:id',
  param('id').isUUID(),
  validate,
  adminController.getShieldSessionById
);

router.put('/shield/sessions/:id/close',
  param('id').isUUID(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.closeShieldSession
);

// ─────────────────────────────────────────────
// CORPORATE ADMIN
// Static actions before /:id sub-routes
// ─────────────────────────────────────────────
router.get('/corporate/companies', adminController.getCompanies);

router.get('/corporate/companies/:id',
  param('id').isUUID(),
  validate,
  adminController.getCompanyById
);

router.get('/corporate/companies/:id/employees',
  param('id').isUUID(),
  validate,
  adminController.getCompanyEmployees
);

router.get('/corporate/companies/:id/trips',
  param('id').isUUID(),
  validate,
  adminController.getCompanyTrips
);

router.put('/corporate/companies/:id/activate',
  param('id').isUUID(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.activateCompany
);

router.put('/corporate/companies/:id/suspend',
  param('id').isUUID(),
  body('reason').optional().isString(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.suspendCompany
);

// ─────────────────────────────────────────────
// DUOPAY ADMIN
// Static segments before /:id
// ─────────────────────────────────────────────
router.get('/duopay/stats', adminController.getDuoPayStats);

router.get('/duopay/accounts', adminController.getDuoPayAccounts);

router.post('/duopay/run-overdue-check',
  authorize('ADMIN', 'SUPER_ADMIN'),
  adminController.runDuoPayOverdueCheck
);

router.post('/duopay/accounts/:id/waive',
  param('id').isUUID(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.waiveDuoPayAccount
);

router.post('/duopay/accounts/:id/transactions/:txId/waive',
  param('id').isUUID(),
  param('txId').isUUID(),
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate,
  adminController.waiveDuoPayTransaction
);

// ─────────────────────────────────────────────
// APP FEEDBACK
// /stats before / to prevent shadowing
// ─────────────────────────────────────────────
router.get('/feedback/stats', adminController.getAppFeedbackStats);

router.get('/feedback', adminController.getAppFeedback);

module.exports = router;