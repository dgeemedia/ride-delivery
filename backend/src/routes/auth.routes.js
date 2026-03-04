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
 * @desc    Get current user
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

// FUTURE: Add password reset routes
// router.post('/forgot-password', authController.forgotPassword);
// router.post('/reset-password/:token', authController.resetPassword);

// FUTURE: Add email/phone verification
// router.post('/verify-email', authController.verifyEmail);
// router.post('/verify-phone', authController.verifyPhone);
// router.post('/resend-verification', authController.resendVerification);

module.exports = router;