// backend/src/routes/admin.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All admin routes require authentication and ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
router.get('/dashboard/stats', adminController.getDashboardStats);

// ─────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────
router.get('/users', adminController.getUsers);
router.get('/users/:id', param('id').isUUID(), adminController.getUserById);
router.put(
  '/users/:id/suspend',
  param('id').isUUID(),
  body('reason').optional().isString(),
  adminController.suspendUser
);
router.put('/users/:id/activate', param('id').isUUID(), adminController.activateUser);

// ─────────────────────────────────────────────
// DRIVER MANAGEMENT
// ─────────────────────────────────────────────
router.get('/drivers/pending', adminController.getPendingDrivers);
router.put('/drivers/:id/approve', param('id').isUUID(), adminController.approveDriver);
router.put(
  '/drivers/:id/reject',
  param('id').isUUID(),
  body('reason').notEmpty(),
  adminController.rejectDriver
);

// ─────────────────────────────────────────────
// PARTNER MANAGEMENT
// ─────────────────────────────────────────────
router.get('/partners/pending', adminController.getPendingPartners);
router.put('/partners/:id/approve', param('id').isUUID(), adminController.approvePartner);
router.put(
  '/partners/:id/reject',
  param('id').isUUID(),
  body('reason').notEmpty(),
  adminController.rejectPartner
);

// ─────────────────────────────────────────────
// RIDE & DELIVERY MANAGEMENT
// ─────────────────────────────────────────────
router.get('/rides', adminController.getRides);
router.get('/deliveries', adminController.getDeliveries);

// ─────────────────────────────────────────────
// PAYMENT MANAGEMENT
// ─────────────────────────────────────────────
router.get('/payments', adminController.getPayments);

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/user-growth', adminController.getUserGrowth);

// ─────────────────────────────────────────────
// SYSTEM SETTINGS
// ─────────────────────────────────────────────
router.get('/settings', adminController.getSettings);
router.put(
  '/settings/:key',
  [body('value').notEmpty()],
  adminController.updateSetting
);

// ─────────────────────────────────────────────
// PROMO CODES
// ─────────────────────────────────────────────
router.get('/promo-codes', adminController.getPromoCodes);
router.post(
  '/promo-codes',
  [
    body('code').notEmpty().isLength({ min: 3, max: 20 }),
    body('discountType').isIn(['percentage', 'fixed']),
    body('discountValue').isFloat({ min: 0 }),
    body('validFrom').isISO8601(),
    body('validUntil').isISO8601(),
    body('applicableFor').isIn(['rides', 'deliveries', 'both'])
  ],
  adminController.createPromoCode
);
router.put('/promo-codes/:id/toggle', param('id').isUUID(), adminController.togglePromoCode);

// ─────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────
router.get('/tickets', adminController.getTickets);
router.put(
  '/tickets/:id',
  param('id').isUUID(),
  [
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    body('assignedTo').optional().isString(),
    body('resolution').optional().isString()
  ],
  adminController.updateTicket
);

// ─────────────────────────────────────────────
// ACTIVITY LOGS
// ─────────────────────────────────────────────
router.get('/logs', adminController.getActivityLogs);

// ─────────────────────────────────────────────
// WALLET MANAGEMENT
// ─────────────────────────────────────────────
router.get('/wallets', adminController.getWallets);
router.post(
  '/wallets/:userId/adjust',
  param('userId').isUUID(),
  [
    body('amount').isFloat({ min: 0.01 }),
    body('type').isIn(['credit', 'debit']),
    body('reason').optional().isString()
  ],
  adminController.adjustWallet
);

// ─────────────────────────────────────────────
// BROADCAST NOTIFICATIONS
// ─────────────────────────────────────────────
router.post(
  '/notifications/broadcast',
  [
    body('title').notEmpty(),
    body('message').notEmpty(),
    body('role').optional().isIn(['CUSTOMER', 'DRIVER', 'DELIVERY_PARTNER'])
  ],
  adminController.broadcastNotification
);

// ─────────────────────────────────────────────
// ONBOARDING BONUS  (SUPER_ADMIN only)
// POST /api/admin/bonuses/onboarding
//
// Credits every approved driver / delivery partner whose wallet is ₦0
// with the configured onboarding bonus so they can immediately accept
// their first ride or delivery (wallet balance >= fare is required).
// ─────────────────────────────────────────────
router.post(
  '/bonuses/onboarding',
  authorize('SUPER_ADMIN'),   // tighter restriction — overrides the outer ADMIN/SUPER_ADMIN middleware
  [
    body('driverBonus')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Driver bonus must be a positive number'),
    body('partnerBonus')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Partner bonus must be a positive number'),
  ],
  adminController.disburseOnboardingBonuses
);

module.exports = router;