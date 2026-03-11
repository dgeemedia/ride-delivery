// backend/src/routes/user.routes.js
const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().isMobilePhone(),
  body('profileImage').optional().isURL()
], userController.updateProfile);

/**
 * @route   PUT /api/users/password
 * @desc    Update password
 * @access  Private
 */
router.put('/password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], userController.updatePassword);

/**
 * @route   POST /api/users/profile-image
 * @desc    Upload profile image URL
 * @access  Private
 */
router.post('/profile-image', [
  body('imageUrl').isURL()
], userController.uploadProfileImage);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', userController.getUserStats);

/**
 * @route   POST /api/users/support-ticket
 * @desc    Submit a support ticket
 * @access  Private
 */
router.post('/support-ticket', [
  body('subject').notEmpty().isLength({ max: 200 }),
  body('description').notEmpty(),
  body('category').isIn(['account', 'payment', 'ride', 'delivery', 'technical', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], userController.submitSupportTicket);

/**
 * @route   GET /api/users/support-tickets
 * @desc    Get user's support tickets
 * @access  Private
 */
router.get('/support-tickets', userController.getSupportTickets);

/**
 * @route   POST /api/users/feedback
 * @desc    Submit app feedback
 * @access  Private
 */
router.post('/feedback', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString(),
  body('category').isIn(['app_experience', 'driver_quality', 'pricing', 'delivery_quality', 'other']),
  body('platform').isIn(['ios', 'android', 'web']),
  body('appVersion').optional().isString()
], userController.submitFeedback);

/**
 * @route   POST /api/users/apply-promo
 * @desc    Validate and preview a promo code
 * @access  Private
 */
router.post('/apply-promo', [
  body('code').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('serviceType').isIn(['rides', 'deliveries'])
], userController.applyPromoCode);

/**
 * @route   DELETE /api/users/account
 * @desc    Delete / deactivate account
 * @access  Private
 */
router.delete('/account', [
  body('password').notEmpty()
], userController.deleteAccount);

module.exports = router;