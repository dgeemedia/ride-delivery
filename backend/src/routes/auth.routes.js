const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('phone').isMobilePhone(),
    body('password').isLength({ min: 8 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn(['CUSTOMER', 'DRIVER', 'DELIVERY_PARTNER'])
  ],
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone(),
    body('password').notEmpty()
  ],
  authController.login
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user (with wallet balance)
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Private
 */
router.post('/refresh', authenticate, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset link to email
 * @access  Public
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password using token
 * @access  Public
 */
router.post(
  '/reset-password/:token',
  [body('password').isLength({ min: 8 })],
  authController.resetPassword
);

/**
 * @route   POST /api/auth/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email/:token', authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post('/resend-verification', authenticate, authController.resendVerification);

module.exports = router;