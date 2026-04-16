// backend/src/routes/admin.routes.js
'use strict';
const express = require('express');
const { body, param } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize, requireScope } = require('../middleware/auth.middleware');

const router = express.Router();

// Base auth — must be logged in + have an admin-level role
router.use(authenticate);
router.use((req, res, next) => {
  if (!['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].includes(req.user.role))
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  next();
});

// DASHBOARD
router.get('/dashboard/stats', adminController.getDashboardStats);

// USER MANAGEMENT
router.get('/users',     adminController.getUsers);
router.get('/users/:id', param('id').isUUID(), adminController.getUserById);
router.put('/users/:id/suspend',  param('id').isUUID(), body('reason').optional().isString(), authorize('ADMIN','SUPER_ADMIN'), adminController.suspendUser);
router.put('/users/:id/activate', param('id').isUUID(), authorize('ADMIN','SUPER_ADMIN'), adminController.activateUser);
router.delete('/users/:id',       param('id').isUUID(), authorize('SUPER_ADMIN'), adminController.deleteUser);

// Create admin/staff users — SUPER_ADMIN only
router.post('/users/create-admin', authorize('SUPER_ADMIN'), [
  body('email').isEmail().normalizeEmail(),
  body('phone').isMobilePhone(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').isIn(['ADMIN', 'SUPPORT', 'MODERATOR']),
  body('adminDepartment').optional().isIn(['RIDES', 'DELIVERIES', 'SUPPORT']),
], adminController.createAdminUser);

// DRIVER MANAGEMENT — RIDES scope
router.get('/drivers',          requireScope('RIDES'),           adminController.getDrivers);
router.get('/drivers/pending',  requireScope('RIDES'),           adminController.getPendingDrivers);
router.get('/drivers/:id',      param('id').isUUID(), requireScope('RIDES'), adminController.getDriverById);
router.put('/drivers/:id/approve', param('id').isUUID(), requireScope('RIDES'), adminController.approveDriver);
router.put('/drivers/:id/reject',  param('id').isUUID(), body('reason').notEmpty(), requireScope('RIDES'), adminController.rejectDriver);

// PARTNER MANAGEMENT — DELIVERIES scope
router.get('/partners',         requireScope('DELIVERIES'),           adminController.getPartners);
router.get('/partners/pending', requireScope('DELIVERIES'),           adminController.getPendingPartners);
router.get('/partners/:id',     param('id').isUUID(), requireScope('DELIVERIES'), adminController.getPartnerById);
router.put('/partners/:id/approve', param('id').isUUID(), requireScope('DELIVERIES'), adminController.approvePartner);
router.put('/partners/:id/reject',  param('id').isUUID(), body('reason').notEmpty(), requireScope('DELIVERIES'), adminController.rejectPartner);

// RIDE MANAGEMENT — RIDES scope (/live before /:id)
router.get('/rides/live', requireScope('RIDES'),           adminController.getLiveRides);
router.get('/rides',      requireScope('RIDES','SUPPORT'), adminController.getRides);
router.get('/rides/:id',  param('id').isUUID(), requireScope('RIDES','SUPPORT'), adminController.getAdminRideById);
router.put('/rides/:id/cancel', param('id').isUUID(), body('reason').optional().isString(), requireScope('RIDES'), adminController.adminCancelRide);

// DELIVERY MANAGEMENT — DELIVERIES scope (/live before /:id)
router.get('/deliveries/live', requireScope('DELIVERIES'),           adminController.getLiveDeliveries);
router.get('/deliveries',      requireScope('DELIVERIES','SUPPORT'), adminController.getDeliveries);
router.get('/deliveries/:id',  param('id').isUUID(), requireScope('DELIVERIES','SUPPORT'), adminController.getDeliveryById);
router.put('/deliveries/:id/cancel', param('id').isUUID(), body('reason').optional().isString(), requireScope('DELIVERIES'), adminController.cancelDelivery);

// PAYMENTS
router.get('/payments',        authorize('ADMIN','SUPER_ADMIN'), adminController.getPayments);
router.get('/payments/stats',  authorize('ADMIN','SUPER_ADMIN'), adminController.getPaymentStats);
router.get('/payments/:id',    authorize('ADMIN','SUPER_ADMIN'), param('id').isUUID(), adminController.getPaymentById);

// COMMISSION ANALYTICS
router.get('/analytics/commission', authorize('ADMIN','SUPER_ADMIN'), adminController.getCommissionAnalytics);

// ANALYTICS
router.get('/analytics/revenue',     authorize('ADMIN','SUPER_ADMIN'), adminController.getRevenueAnalytics);
router.get('/analytics/user-growth', authorize('ADMIN','SUPER_ADMIN'), adminController.getUserGrowth);

// SETTINGS
router.get('/settings',      authorize('ADMIN','SUPER_ADMIN'), adminController.getSettings);
router.put('/settings/:key', [body('value').notEmpty()], authorize('SUPER_ADMIN'), adminController.updateSetting);
router.patch('/settings/batch',  authorize('ADMIN','SUPER_ADMIN'), adminController.updateSettingsBatch);

// PROMO CODES
router.get('/promo-codes', authorize('ADMIN','SUPER_ADMIN'), adminController.getPromoCodes);
router.post('/promo-codes', authorize('ADMIN','SUPER_ADMIN'), [
  body('code').notEmpty().isLength({ min: 3, max: 20 }),
  body('discountType').isIn(['percentage', 'fixed']),
  body('discountValue').isFloat({ min: 0 }),
  body('validFrom').isISO8601(),
  body('validUntil').isISO8601(),
  body('applicableFor').isIn(['rides', 'deliveries', 'both']),
], adminController.createPromoCode);
router.put('/promo-codes/:id/toggle', param('id').isUUID(), authorize('ADMIN','SUPER_ADMIN'), adminController.togglePromoCode);

// SUPPORT TICKETS — all admin roles can read; SUPPORT + ADMIN + SUPER_ADMIN can update
router.get('/tickets',     adminController.getTickets);
router.get('/tickets/:id', param('id').isUUID(), adminController.getTicketById);
router.put('/tickets/:id', param('id').isUUID(), [
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
  body('assignedTo').optional().isString(),
  body('resolution').optional().isString(),
  body('replyMessage').optional().isString(),
], adminController.updateTicket);

// LOGS
router.get('/logs', authorize('ADMIN','SUPER_ADMIN'), adminController.getActivityLogs);

// WALLETS
router.get('/wallets', authorize('ADMIN','SUPER_ADMIN'), adminController.getWallets);
router.post('/wallets/:userId/adjust', param('userId').isUUID(), authorize('ADMIN','SUPER_ADMIN'), [
  body('amount').isFloat({ min: 0.01 }),
  body('type').isIn(['credit', 'debit']),
  body('reason').optional().isString(),
], adminController.adjustWallet);

// NOTIFICATIONS
router.post('/notifications/broadcast', authorize('ADMIN','SUPER_ADMIN'), [
  body('title').notEmpty(),
  body('message').notEmpty(),
  body('role').optional().isIn(['CUSTOMER', 'DRIVER', 'DELIVERY_PARTNER']),
], adminController.broadcastNotification);

// ONBOARDING BONUS
router.get('/bonuses/onboarding/preview', authorize('SUPER_ADMIN'), adminController.previewOnboardingBonuses);
router.post('/bonuses/onboarding', authorize('SUPER_ADMIN'), [
  body('driverBonus').optional().isFloat({ min: 0 }),
  body('partnerBonus').optional().isFloat({ min: 0 }),
], adminController.disburseOnboardingBonuses);

// SHIELD MONITORING — all admin roles can read; SUPER_ADMIN can close sessions
router.get('/shield/stats',            adminController.getShieldStats);
router.get('/shield/sessions',         adminController.getShieldSessions);
router.get('/shield/sessions/:id',     param('id').isUUID(), adminController.getShieldSessionById);
router.put('/shield/sessions/:id/close', param('id').isUUID(), authorize('ADMIN', 'SUPER_ADMIN'), adminController.closeShieldSession);

// ─────────────────────────────────────────────────────────────────────────────
// ADD TO: backend/src/routes/admin.routes.js
//
// Paste these lines before  module.exports = router;
// They sit after the existing SHIELD MONITORING block.
// ─────────────────────────────────────────────────────────────────────────────

// CORPORATE ADMIN — all admin roles can view; ADMIN/SUPER_ADMIN can activate/suspend
router.get('/corporate/companies',                                          adminController.getCompanies);
router.get('/corporate/companies/:id',         param('id').isUUID(),        adminController.getCompanyById);
router.get('/corporate/companies/:id/employees', param('id').isUUID(),      adminController.getCompanyEmployees);
router.get('/corporate/companies/:id/trips',   param('id').isUUID(),        adminController.getCompanyTrips);
router.put('/corporate/companies/:id/activate', param('id').isUUID(),       authorize('ADMIN', 'SUPER_ADMIN'), adminController.activateCompany);
router.put('/corporate/companies/:id/suspend',  param('id').isUUID(),       authorize('ADMIN', 'SUPER_ADMIN'), body('reason').optional().isString(), adminController.suspendCompany);

// DUOPAY ADMIN — viewPayments scope; only ADMIN/SUPER_ADMIN can waive
router.get('/duopay/stats',                                                  adminController.getDuoPayStats);
router.get('/duopay/accounts',                                               adminController.getDuoPayAccounts);
router.post('/duopay/accounts/:id/waive',           param('id').isUUID(),   authorize('ADMIN', 'SUPER_ADMIN'), adminController.waiveDuoPayAccount);
router.post('/duopay/accounts/:id/transactions/:txId/waive', param('id').isUUID(), param('txId').isUUID(), authorize('ADMIN', 'SUPER_ADMIN'), adminController.waiveDuoPayTransaction);
router.post('/duopay/run-overdue-check',                                     authorize('ADMIN', 'SUPER_ADMIN'), adminController.runDuoPayOverdueCheck);

module.exports = router;