// backend/src/routes/wallet.routes.js  [UPDATED]
const express = require('express');
const { isPhoneAcceptable } = require('../utils/phone');
const { body, query, param } = require('express-validator');
const walletController = require('../controllers/wallet.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// (A public /debug-env route used to live here and returned the first 15 characters
// of PAYSTACK_SECRET_KEY to anyone. It was removed — never expose key material.)

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — Payment provider webhooks (no auth — verified via signature instead)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/topup/verify', walletController.verifyTopUp);
router.post('/topup/flutterwave/webhook', walletController.verifyFlutterwaveWebhook);

// Orange posts its payment notification here. Public by design — the request
// is authenticated by the notif_token HMAC, not by a bearer token, since
// Orange's servers have no session with us.
router.post('/topup/orange/webhook', walletController.orangeWebhook);

// ─────────────────────────────────────────────────────────────────────────────
// All routes below require authentication
// ─────────────────────────────────────────────────────────────────────────────
router.use(authenticate);

// Deposit limits are per-country, per-role (the handler reads req.user), so this
// MUST sit behind authenticate. It used to be declared above it as "public", which
// made every call fail with a 500 (req.user undefined) and left the top-up screen
// showing its built-in fallback limits instead of the country's real ones.
router.get('/deposit-limits', walletController.getDepositLimits);

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
// TOP-UP — Orange Money
// ─────────────────────────────────────────────────────────────────────────────
// No max here: the real ceiling is the admin-configured `wallet_topup_max`
// setting, which the controller enforces in the country's own currency.
// Hardcoding a naira-shaped bound would be wrong for XOF/GNF.

router.post(
  '/topup/orange',
  [body('amount').isFloat({ min: 1 }).withMessage('Amount is required')],
  walletController.orangeTopup
);

router.post(
  '/topup/orange/verify',
  [body('orderId').optional().notEmpty(), body('reference').optional().notEmpty()],
  walletController.verifyOrangeTopup
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
    body('recipientPhone').custom(isPhoneAcceptable).withMessage('Valid phone number required'),
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
    body('amount').isFloat({ min: 1 }).withMessage('Amount is required'),
    // Destination fields are validated per-rail in the controller, which
    // knows the requester's country: bank markets need a 10-digit NUBAN,
    // Orange markets need an Orange Money MSISDN. Enforcing "10 digits"
    // here would reject every Orange payout before it reached that logic.
    body('accountNumber').optional().isString(),
    body('bankCode').optional().isString(),
    body('mobileNumber').optional().isString(),
    body('bankName').optional().isString().isLength({ max: 80 }),   // free-text, manual-settlement countries
    // Orange gives us no subscriber name, so the controller falls back to
    // the requester's own name rather than requiring one here.
    body('accountName').optional().isString(),
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
    query('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ALL']),
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

// Finish a payout an admin settled by hand (manual countries, or an automatic
// transfer that failed and was paid another way). Without this a PROCESSING
// payout could never be completed.
router.put(
  '/admin/payouts/:id/complete',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    param('id').isUUID(),
    body('reference').optional().isString().isLength({ max: 120 }),
    body('note').optional().isString().isLength({ max: 500 }),
  ],
  walletController.adminCompletePayout
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Wallet top-up visibility & reconciliation
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/admin/topups',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    query('status').optional().isIn(['PENDING', 'COMPLETED', 'FAILED', 'ALL']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  walletController.adminGetTopUps
);

router.put(
  '/admin/topups/:id/reconcile',
  authorize('ADMIN', 'SUPER_ADMIN'),
  [param('id').isUUID()],
  walletController.adminReconcileTopUp
);

module.exports = router;