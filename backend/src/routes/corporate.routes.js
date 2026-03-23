// backend/src/routes/corporate.routes.js
// Mounted at /api/corporate in app.js
'use strict';

const express       = require('express');
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl          = require('../controllers/corporate.controller');

const router = express.Router();
router.use(authenticate);

// ── Company registration & profile ────────────────────────────────────────────
router.post('/register', authorize('CUSTOMER'), [
  body('name').trim().notEmpty().isLength({ max: 200 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').isMobilePhone(),
  body('rcNumber').optional().isString().isLength({ min: 6, max: 20 }),
  body('address').optional().isString(),
  body('billingType').optional().isIn(['PREPAID', 'POSTPAID']),
], ctrl.registerCompany);

router.get('/profile', ctrl.getCompanyProfile);
router.put('/profile', [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone(),
  body('address').optional().isString(),
  body('logoUrl').optional().isURL(),
], ctrl.updateCompanyProfile);

// ── Wallet ────────────────────────────────────────────────────────────────────
router.get('/wallet', ctrl.getWallet);
router.post('/wallet/topup', [
  body('amount').isFloat({ min: 100000 }).withMessage('Minimum top-up is ₦100,000'),
], ctrl.initiateTopUp);
router.post('/wallet/verify', [
  body('reference').notEmpty(),
  body('amount').isFloat({ min: 0 }),
], ctrl.verifyTopUp);

// ── Employees (admin) ─────────────────────────────────────────────────────────
router.get('/employees', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PENDING', 'ACTIVE', 'REJECTED']),
], ctrl.listEmployees);

router.post('/employees/invite', [
  body('phone').isMobilePhone(),
  body('monthlyLimit').optional().isFloat({ min: 1000, max: 500000 }),
  body('department').optional().isString(),
  body('jobTitle').optional().isString(),
  body('requireTripPurpose').optional().isBoolean(),
  body('restrictToBusinessHours').optional().isBoolean(),
], ctrl.inviteEmployee);

router.put('/employees/:id', param('id').isUUID(), [
  body('monthlyLimit').optional().isFloat({ min: 1000 }),
  body('department').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('requireTripPurpose').optional().isBoolean(),
  body('restrictToBusinessHours').optional().isBoolean(),
], ctrl.updateEmployee);

router.delete('/employees/:id', param('id').isUUID(), ctrl.removeEmployee);

// ── Employee self-service ─────────────────────────────────────────────────────
router.get('/my-account', authorize('CUSTOMER'), ctrl.getMyEmploymentContext);
router.post('/invite/respond', authorize('CUSTOMER'), [
  body('employeeId').notEmpty().isString(),
  body('accept').isBoolean(),
], ctrl.respondToInvite);

// ── Trips & reporting ─────────────────────────────────────────────────────────
router.get('/trips', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('employeeId').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
], ctrl.getCorporateTrips);

router.get('/invoice', [
  query('year').optional().isInt({ min: 2024, max: 2030 }),
  query('month').optional().isInt({ min: 1, max: 12 }),
], ctrl.getInvoice);

module.exports = router;


// ─────────────────────────────────────────────────────────────────────────────
// SAVE AS: backend/src/routes/duopay.routes.js
// Mounted at /api/duopay in app.js
// ─────────────────────────────────────────────────────────────────────────────