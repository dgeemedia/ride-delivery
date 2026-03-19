// backend/src/routes/wallet.routes.js
const express = require('express');
const { body, query } = require('express-validator');
const walletController = require('../controllers/wallet.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Paystack webhook (no auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/topup/verify
 * @desc    Paystack webhook — verifies payment and credits wallet automatically
 * @access  Public (Paystack server calls this)
 */
router.post('/topup/verify', walletController.verifyTopUp);

// ─────────────────────────────────────────────────────────────────────────────
// All routes below require authentication
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// WALLET INFO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/wallet
 * @desc    Get wallet balance and info (auto-creates wallet if missing)
 * @access  Private
 */
router.get('/', walletController.getWallet);

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get paginated transaction history (optional ?type=CREDIT|DEBIT|WITHDRAWAL|REFUND)
 * @access  Private
 */
router.get(
  '/transactions',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['CREDIT', 'DEBIT', 'WITHDRAWAL', 'REFUND']),
  ],
  walletController.getTransactions
);

// ─────────────────────────────────────────────────────────────────────────────
// TOP-UP — Paystack
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/topup/initialize
 * @desc    Initialize Paystack top-up → returns authorizationUrl to open in browser
 *          Used by WalletTopUpScreen for drivers, partners, and customers.
 * @access  Private
 */
router.post(
  '/topup/initialize',
  [body('amount').isFloat({ min: 100, max: 1000000 }).withMessage('Amount must be between ₦100 and ₦1,000,000')],
  walletController.initializeTopUp
);

/**
 * @route   POST /api/wallet/topup/paystack
 * @desc    Legacy Paystack top-up (kept for backward compatibility)
 * @access  Private
 */
router.post(
  '/topup/paystack',
  [body('amount').isFloat({ min: 100 })],
  walletController.paystackTopup
);

/**
 * @route   POST /api/wallet/topup/paystack/verify
 * @desc    Manually verify a Paystack top-up by reference
 * @access  Private
 */
router.post(
  '/topup/paystack/verify',
  [body('reference').notEmpty()],
  walletController.verifyPaystackTopup
);

// ─────────────────────────────────────────────────────────────────────────────
// TOP-UP — Flutterwave
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/topup/flutterwave
 * @desc    Initialize Flutterwave top-up
 * @access  Private
 */
router.post(
  '/topup/flutterwave',
  [body('amount').isFloat({ min: 100 })],
  walletController.flutterwaveTopup
);

/**
 * @route   POST /api/wallet/topup/flutterwave/verify
 * @desc    Verify Flutterwave top-up by transaction ID
 * @access  Private
 */
router.post(
  '/topup/flutterwave/verify',
  [body('transactionId').notEmpty()],
  walletController.verifyFlutterwaveTopup
);

// ─────────────────────────────────────────────────────────────────────────────
// BANK ACCOUNT VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/wallet/verify-account
 * @desc    Verify a Nigerian bank account (used in WithdrawalScreen)
 *          Returns account_name from Paystack name-enquiry API.
 * @access  Private
 */
router.get(
  '/verify-account',
  [
    query('accountNumber').notEmpty().isLength({ min: 10, max: 10 }).withMessage('Account number must be 10 digits'),
    query('bankCode').notEmpty(),
  ],
  walletController.verifyBankAccount
);

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/transfer
 * @desc    Transfer funds to another Diakite user by phone number
 * @access  Private
 */
router.post(
  '/transfer',
  [
    body('recipientPhone').isMobilePhone(),
    body('amount').isFloat({ min: 1 }),
    body('note').optional().isString().isLength({ max: 200 }),
  ],
  walletController.transfer
);

// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAWAL (legacy direct — still available)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Legacy direct withdrawal (Paystack transfer). Drivers/partners should
 *          use /api/drivers/payout/request or /api/partners/payout/request which
 *          goes through the admin approval flow.
 * @access  Private
 */
router.post(
  '/withdraw',
  [
    body('amount').isFloat({ min: 500 }),
    body('accountNumber').notEmpty().isLength({ min: 10, max: 10 }),
    body('bankCode').notEmpty(),
    body('accountName').notEmpty(),
  ],
  walletController.withdraw
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Payout approval / rejection
// These are mounted at /api/wallet/admin/... for simplicity.
// Alternatively, mount a separate admin router at /api/admin.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/wallet/admin/payouts
 * @desc    List all payout requests (default: PENDING). Admin only.
 *          Query params: ?status=PENDING|PROCESSING|COMPLETED|FAILED&page=1&limit=20
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.get(
  '/admin/payouts',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [query('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])],
  walletController.adminGetPayouts
);

/**
 * @route   PUT /api/wallet/admin/payouts/:id/approve
 * @desc    Admin approves a payout → marks COMPLETED, notifies driver/partner
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.put(
  '/admin/payouts/:id/approve',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [body('note').optional().isString().isLength({ max: 500 })],
  walletController.adminApprovePayout
);

/**
 * @route   PUT /api/wallet/admin/payouts/:id/reject
 * @desc    Admin rejects a payout → refunds wallet, notifies driver/partner
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.put(
  '/admin/payouts/:id/reject',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [body('reason').optional().isString().isLength({ max: 500 })],
  walletController.adminRejectPayout
);

module.exports = router;