const express = require('express');
const { body } = require('express-validator');
const walletController = require('../controllers/wallet.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/wallet
 * @desc    Get wallet balance
 * @access  Private
 */
router.get('/', walletController.getWallet);

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get transaction history
 * @access  Private
 */
router.get('/transactions', walletController.getTransactions);

/**
 * @route   POST /api/wallet/topup/paystack
 * @desc    Initialize Paystack top-up
 * @access  Private
 */
router.post(
  '/topup/paystack',
  [body('amount').isFloat({ min: 100 })],
  walletController.paystackTopup
);

/**
 * @route   POST /api/wallet/topup/paystack/verify
 * @desc    Verify Paystack top-up
 * @access  Private
 */
router.post(
  '/topup/paystack/verify',
  [body('reference').notEmpty()],
  walletController.verifyPaystackTopup
);

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
 * @desc    Verify Flutterwave top-up
 * @access  Private
 */
router.post(
  '/topup/flutterwave/verify',
  [body('transactionId').notEmpty()],
  walletController.verifyFlutterwaveTopup
);

/**
 * @route   POST /api/wallet/transfer
 * @desc    Transfer to another user
 * @access  Private
 */
router.post(
  '/transfer',
  [
    body('recipientPhone').isMobilePhone(),
    body('amount').isFloat({ min: 1 }),
    body('note').optional().isString().isLength({ max: 200 })
  ],
  walletController.transfer
);

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Withdraw to bank account
 * @access  Private
 */
router.post(
  '/withdraw',
  [
    body('amount').isFloat({ min: 500 }),
    body('accountNumber').notEmpty().isLength({ min: 10, max: 10 }),
    body('bankCode').notEmpty(),
    body('accountName').notEmpty()
  ],
  walletController.withdraw
);

module.exports = router;