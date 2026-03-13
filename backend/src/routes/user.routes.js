// backend/src/routes/user.routes.js
const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/users/profile
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/users/profile
 *
 * FIX: Use .optional({ checkFalsy: true }) so that empty strings ""
 * are treated as absent (not validated), preventing 400 errors when
 * phone is cleared or profileImage is omitted.
 *
 * Without checkFalsy:true, optional() only skips `undefined`.
 * An empty string "" still gets passed to .isMobilePhone() and fails.
 */
router.put('/profile', [
  body('firstName')
    .optional({ checkFalsy: true })
    .trim()
    .notEmpty().withMessage('First name cannot be blank'),

  body('lastName')
    .optional({ checkFalsy: true })
    .trim()
    .notEmpty().withMessage('Last name cannot be blank'),

  body('phone')
    .optional({ checkFalsy: true })   // ← skips validation when phone is "" or undefined
    .isMobilePhone().withMessage('Invalid phone number'),

  body('profileImage')
    .optional({ checkFalsy: true })   // ← skips validation when profileImage is "" or undefined
    .isURL().withMessage('Profile image must be a valid URL'),
], userController.updateProfile);

/**
 * @route   PUT /api/users/password
 */
router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], userController.updatePassword);

/**
 * @route   POST /api/users/profile-image
 */
router.post('/profile-image', [
  body('imageUrl').isURL().withMessage('A valid image URL is required'),
], userController.uploadProfileImage);

/**
 * @route   GET /api/users/stats
 */
router.get('/stats', userController.getUserStats);

/**
 * @route   POST /api/users/support-ticket
 */
router.post('/support-ticket', [
  body('subject').notEmpty().isLength({ max: 200 }),
  body('description').notEmpty(),
  body('category').isIn(['account', 'payment', 'ride', 'delivery', 'technical', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
], userController.submitSupportTicket);

/**
 * @route   GET /api/users/support-tickets
 */
router.get('/support-tickets', userController.getSupportTickets);

/**
 * @route   POST /api/users/feedback
 */
router.post('/feedback', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString(),
  body('category').isIn(['app_experience', 'driver_quality', 'pricing', 'delivery_quality', 'other']),
  body('platform').isIn(['ios', 'android', 'web']),
  body('appVersion').optional().isString(),
], userController.submitFeedback);

/**
 * @route   POST /api/users/apply-promo
 */
router.post('/apply-promo', [
  body('code').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('serviceType').isIn(['rides', 'deliveries']),
], userController.applyPromoCode);

/**
 * @route   DELETE /api/users/account
 */
router.delete('/account', [
  body('password').notEmpty(),
], userController.deleteAccount);

module.exports = router;