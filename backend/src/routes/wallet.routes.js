// backend/src/routes/wallet.routes.js  [UPDATED]
const express = require('express');
const { body, query, param } = require('express-validator');
const walletController = require('../controllers/wallet.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/debug-env', (req, res) => {
  res.json({
    hasKey: !!process.env.PAYSTACK_SECRET_KEY,
    keyPreview: process.env.PAYSTACK_SECRET_KEY?.slice(0, 15) + '...',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Paystack webhook (no auth)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/topup/verify', walletController.verifyTopUp);

// ── PUBLIC — deposit limits (no auth required, used by mobile top-up screen) ──
router.get('/deposit-limits', walletController.getDepositLimits);

// ─────────────────────────────────────────────────────────────────────────────
// All routes below require authentication
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// WALLET INFO
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', walletController.getWallet);

router.get(
  '/transactions',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['CREDIT', 'DEBIT', 'WITHDRAWAL', 'REFUND']),
  ],
  walletController.getTransactions
);

router.post(
  '/transactions/email',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('from').optional().isISO8601().withMessage('Invalid from date'),
    body('to').optional().isISO8601().withMessage('Invalid to date'),
    body('type').optional().isIn(['ALL', 'CREDIT', 'DEBIT', 'WITHDRAWAL', 'REFUND']),
  ],
  walletController.emailTransactionHistory
);

router.get(
  '/lookup-user',
  [query('phone').notEmpty().withMessage('Phone number is required')],
  walletController.lookupUser
);

// ─────────────────────────────────────────────────────────────────────────────
// TOP-UP — Paystack
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/topup/initialize',
  [body('amount').isFloat({ min: 100, max: 1000000 }).withMessage('Amount must be between ₦100 and ₦1,000,000')],
  walletController.initializeTopUp
);

router.post(
  '/topup/paystack',
  [body('amount').isFloat({ min: 100 })],
  walletController.paystackTopup
);

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

router.get(
  '/admin/stats',
  authorize('ADMIN', 'SUPER_ADMIN'),
  walletController.adminGetWalletStats
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Payout (withdrawal) management
// ─────────────────────────────────────────────────────────────────────────────

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

router.put(
  '/admin/payouts/:id/approve',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    param('id').isUUID(),
    body('note').optional().isString().isLength({ max: 500 }),
  ],
  walletController.adminApprovePayout
);

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

router.put(
  '/admin/transfers/:reference/approve',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [body('note').optional().isString().isLength({ max: 500 })],
  walletController.adminApproveTransfer
);

router.put(
  '/admin/transfers/:reference/reject',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [body('reason').optional().isString().isLength({ max: 500 })],
  walletController.adminRejectTransfer
);

module.exports = router;