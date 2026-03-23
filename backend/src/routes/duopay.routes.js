// backend/src/routes/duopay.routes.js
// Mounted at /api/duopay in app.js
'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/duopay.controller');

const router = express.Router();

// ── Paystack webhook (no auth — Paystack calls this) ─────────────────────────
router.post('/webhook/paystack', ctrl.paystackWebhook);

// ── All other routes require auth ─────────────────────────────────────────────
router.use(authenticate);
router.use(authorize('CUSTOMER'));

router.get('/eligibility', ctrl.getEligibility);
router.get('/account',     ctrl.getAccount);

router.post('/activate', [
  body('paystackCustomerCode').optional().isString(),
  body('subscriptionCode').optional().isString(),
  body('cardLast4').optional().isString().isLength({ min: 4, max: 4 }),
  body('cardBrand').optional().isString(),
  body('repaymentDay').optional().isInt({ min: 1, max: 28 }),
], ctrl.activateAccount);

router.post('/repay', [
  body('amount').isFloat({ min: 100 }).withMessage('Minimum repayment is ₦100'),
  body('reference').optional().isString(),
], ctrl.manualRepay);

router.get('/transactions', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PENDING', 'PAID', 'OVERDUE', 'WAIVED']),
], ctrl.getTransactions);

module.exports = router;