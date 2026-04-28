// backend/src/routes/auth.routes.js
const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    // ✅ Accept Nigerian numbers: starts with 0, 7-10 digits, or international +234
    body('phone')
      .matches(/^(\+234|0)[7-9]\d{9}$/)
      .withMessage('Please enter a valid Nigerian phone number'),
    body('password').isLength({ min: 8 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn(['CUSTOMER', 'DRIVER', 'DELIVERY_PARTNER']),
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone(),
    body('password').notEmpty(),
  ],
  authController.login
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Complete a 2FA-gated login by submitting the OTP
 * @body    { code: string, tempToken: string }
 * @access  Public (tempToken scopes the request to a single user)
 */
router.post(
  '/verify-otp',
  [
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
    body('tempToken').notEmpty(),
  ],
  authController.verifyOtp
);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend an OTP code within an existing 2FA session
 * @body    { tempToken: string }
 * @access  Public
 */
router.post(
  '/resend-otp',
  [body('tempToken').notEmpty()],
  authController.resendOtp
);

router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  authController.forgotPassword
);

router.post(
  '/reset-password/:token',
  [body('password').isLength({ min: 8 })],
  authController.resetPassword
);

router.post('/verify-email/:token', authController.verifyEmail);

// ── Private ───────────────────────────────────────────────────────────────────

router.get('/me', authenticate, authController.getCurrentUser);

router.post('/refresh', authenticate, authController.refreshToken);

router.post('/logout', authenticate, authController.logout);

router.post('/resend-verification', authenticate, authController.resendVerification);

/**
 * @route   POST /api/auth/2fa/setup
 * @desc    Step 1 — send OTP to verify identity before enabling 2FA
 * @body    { method: 'SMS' | 'EMAIL' }
 * @access  Private
 */
router.post(
  '/2fa/setup',
  authenticate,
  [body('method').optional().isIn(['SMS', 'EMAIL'])],
  authController.setupTwoFactor
);

/**
 * @route   POST /api/auth/2fa/confirm
 * @desc    Step 2 — confirm OTP and activate 2FA
 * @body    { code: string, tempToken: string, method: 'SMS' | 'EMAIL' }
 * @access  Private
 */
router.post(
  '/2fa/confirm',
  authenticate,
  [
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
    body('tempToken').notEmpty(),
    body('method').optional().isIn(['SMS', 'EMAIL']),
  ],
  authController.confirmSetupTwoFactor
);

/**
 * @route   POST /api/auth/2fa/disable
 * @desc    Disable 2FA (requires current password)
 * @body    { password: string }
 * @access  Private
 */
router.post(
  '/2fa/disable',
  authenticate,
  [body('password').notEmpty()],
  authController.disableTwoFactor
);

module.exports = router;