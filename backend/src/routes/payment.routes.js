// backend/src/routes/payment.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// ─────────────────────────────────────────────
// PAYSTACK
// ─────────────────────────────────────────────

/**
 * @route   POST /api/payments/paystack/initialize
 * @desc    Initialize Paystack transaction
 * @access  Private
 */
router.post(
  '/paystack/initialize',
  authenticate,
  [
    body('amount').isFloat({ min: 1 }),
    body('rideId').optional().isUUID(),
    body('deliveryId').optional().isUUID()
  ],
  paymentController.paystackInitialize
);

/**
 * @route   POST /api/payments/paystack/verify
 * @desc    Verify Paystack transaction
 * @access  Private
 */
router.post(
  '/paystack/verify',
  authenticate,
  [body('reference').notEmpty()],
  paymentController.paystackVerify
);

/**
 * @route   POST /api/payments/paystack/webhook
 * @desc    Paystack webhook (raw body set in app.js)
 * @access  Public
 */
router.post('/paystack/webhook', paymentController.paystackWebhook);

// ─────────────────────────────────────────────
// FLUTTERWAVE
// ─────────────────────────────────────────────

/**
 * @route   POST /api/payments/flutterwave/initialize
 * @desc    Initialize Flutterwave payment
 * @access  Private
 */
router.post(
  '/flutterwave/initialize',
  authenticate,
  [
    body('amount').isFloat({ min: 1 }),
    body('rideId').optional().isUUID(),
    body('deliveryId').optional().isUUID()
  ],
  paymentController.flutterwaveInitialize
);

/**
 * @route   POST /api/payments/flutterwave/verify
 * @desc    Verify Flutterwave transaction
 * @access  Private
 */
router.post(
  '/flutterwave/verify',
  authenticate,
  [body('transactionId').notEmpty()],
  paymentController.flutterwaveVerify
);

/**
 * @route   POST /api/payments/flutterwave/webhook
 * @desc    Flutterwave webhook (raw body set in app.js)
 * @access  Public
 */
router.post('/flutterwave/webhook', paymentController.flutterwaveWebhook);

// ─────────────────────────────────────────────
// CASH & WALLET
// ─────────────────────────────────────────────

/**
 * @route   POST /api/payments/cash
 * @desc    Record a cash payment
 * @access  Private
 */
router.post(
  '/cash',
  authenticate,
  [
    body('amount').isFloat({ min: 0 }),
    body('rideId').optional().isUUID(),
    body('deliveryId').optional().isUUID()
  ],
  paymentController.processCash
);

/**
 * @route   POST /api/payments/wallet
 * @desc    Pay via wallet balance
 * @access  Private
 */
router.post(
  '/wallet',
  authenticate,
  [
    body('amount').isFloat({ min: 1 }),
    body('rideId').optional().isUUID(),
    body('deliveryId').optional().isUUID()
  ],
  paymentController.processWalletPayment
);

// ─────────────────────────────────────────────
// REFUND
// ─────────────────────────────────────────────

/**
 * @route   POST /api/payments/:id/refund
 * @desc    Request refund
 * @access  Private
 */
router.post(
  '/:id/refund',
  authenticate,
  param('id').isUUID(),
  [body('amount').optional().isFloat({ min: 1 })],
  paymentController.requestRefund
);

// ─────────────────────────────────────────────
// BANK UTILITIES
// ─────────────────────────────────────────────

/**
 * @route   GET /api/payments/banks
 * @desc    List Nigerian banks
 * @access  Private
 */
router.get('/banks', authenticate, paymentController.listBanks);

/**
 * @route   POST /api/payments/verify-account
 * @desc    Verify bank account number
 * @access  Private
 */
router.post(
  '/verify-account',
  authenticate,
  [body('accountNumber').notEmpty(), body('bankCode').notEmpty()],
  paymentController.verifyBankAccount
);

// ─────────────────────────────────────────────
// HISTORY & STATS
// ─────────────────────────────────────────────

/**
 * @route   GET /api/payments/history
 * @desc    Get payment history
 * @access  Private
 */
router.get('/history', authenticate, paymentController.getHistory);

/**
 * @route   GET /api/payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
router.get('/stats', authenticate, paymentController.getStats);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
router.get('/:id', authenticate, param('id').isUUID(), paymentController.getPaymentById);

module.exports = router;