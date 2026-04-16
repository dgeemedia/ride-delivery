// backend/src/routes/wallet.routes.js  [UPDATED]
const express = require('express');
const { body, query, param } = require('express-validator');
const walletController = require('../controllers/wallet.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Paystack webhook (no auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/topup/verify
 * @desc    Paystack webhook — verifies payment and credits wallet automatically
 * @access  Public
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
 * @desc    Get paginated transaction history
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

/**
 * @route   GET /api/wallet/lookup-user
 * @desc    Look up a registered user by phone number (used in TransferScreen)
 * @access  Private
 */
router.get(
  '/lookup-user',
  [query('phone').notEmpty().withMessage('Phone number is required')],
  walletController.lookupUser
);

// ─────────────────────────────────────────────────────────────────────────────
// TOP-UP — Paystack
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/topup/initialize
 * @desc    Initialize Paystack top-up → returns authorizationUrl
 * @access  Private
 */
router.post(
  '/topup/initialize',
  [body('amount').isFloat({ min: 100, max: 1000000 }).withMessage('Amount must be between ₦100 and ₦1,000,000')],
  walletController.initializeTopUp
);

/**
 * @route   POST /api/wallet/topup/paystack
 * @desc    Legacy Paystack top-up initialize
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

router.post(
  '/topup/flutterwave',
  [body('amount').isFloat({ min: 100 })],
  walletController.flutterwaveTopup
);

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
 * @access  Private
 */
router.get(
  '/verify-account',
  [
    query('accountNumber').notEmpty().isLength({ min: 10, max: 10 }),
    query('bankCode').notEmpty(),
  ],
  walletController.verifyBankAccount
);

// ─────────────────────────────────────────────────────────────────────────────
// PEER TRANSFER (pending admin approval)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/transfer
 * @desc    Initiate a peer transfer — funds held PENDING until admin approves
 * @access  Private
 */
router.post(
  '/transfer',
  [
    body('recipientPhone').isMobilePhone().withMessage('Valid phone number required'),
    body('amount').isFloat({ min: 50 }).withMessage('Minimum transfer amount is ₦50'),
    body('note').optional().isString().isLength({ max: 200 }),
  ],
  walletController.transfer
);

// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAWAL (pending admin approval)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Request a bank withdrawal — creates a Payout record for admin to approve
 * @access  Private
 */
router.post(
  '/withdraw',
  [
    body('amount').isFloat({ min: 500 }).withMessage('Minimum withdrawal is ₦500'),
    body('accountNumber').notEmpty().isLength({ min: 10, max: 10 }),
    body('bankCode').notEmpty(),
    body('accountName').notEmpty(),
  ],
  walletController.withdraw
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Wallet stats dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/wallet/admin/stats
 * @desc    Aggregated wallet stats for admin dashboard
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.get(
  '/admin/stats',
  authorize('ADMIN', 'SUPER_ADMIN'),
  walletController.adminGetWalletStats
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Payout (withdrawal) management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/wallet/admin/payouts
 * @desc    List payout requests. ?status=PENDING|COMPLETED|FAILED|ALL
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.get(
  '/admin/payouts',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    query('status').optional().isIn(['PENDING', 'COMPLETED', 'FAILED', 'ALL']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  walletController.adminGetPayouts
);

/**
 * @route   PUT /api/wallet/admin/payouts/:id/approve
 * @desc    Approve a payout → initiates Paystack bank transfer
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.put(
  '/admin/payouts/:id/approve',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    param('id').isUUID(),
    body('note').optional().isString().isLength({ max: 500 }),
  ],
  walletController.adminApprovePayout
);

/**
 * @route   PUT /api/wallet/admin/payouts/:id/reject
 * @desc    Reject a payout → refunds wallet
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.put(
  '/admin/payouts/:id/reject',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    param('id').isUUID(),
    body('reason').optional().isString().isLength({ max: 500 }),
  ],
  walletController.adminRejectPayout
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Peer transfer management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/wallet/admin/transfers
 * @desc    List peer transfer requests. ?status=PENDING|COMPLETED|FAILED|ALL
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.get(
  '/admin/transfers',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    query('status').optional().isIn(['PENDING', 'COMPLETED', 'FAILED', 'ALL']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  walletController.adminGetTransfers
);

/**
 * @route   PUT /api/wallet/admin/transfers/:reference/approve
 * @desc    Approve a peer transfer → credits recipient
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.put(
  '/admin/transfers/:reference/approve',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [body('note').optional().isString().isLength({ max: 500 })],
  walletController.adminApproveTransfer
);

/**
 * @route   PUT /api/wallet/admin/transfers/:reference/reject
 * @desc    Reject a peer transfer → refunds sender
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
router.put(
  '/admin/transfers/:reference/reject',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [body('reason').optional().isString().isLength({ max: 500 })],
  walletController.adminRejectTransfer
);

module.exports = router;