// backend/src/routes/user.routes.js
const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/profile', userController.getProfile);

// ── FIX: .optional({ checkFalsy: true }) treats "" the same as undefined ────
// Without it, sending phone: "" or profileImage: "" still runs the validator
// and returns 400. checkFalsy:true skips validation on any falsy value.
router.put('/profile', [
  body('firstName')
    .optional({ checkFalsy: true }).trim()
    .notEmpty().withMessage('First name cannot be blank'),
  body('lastName')
    .optional({ checkFalsy: true }).trim()
    .notEmpty().withMessage('Last name cannot be blank'),
  body('phone')
    .optional({ checkFalsy: true })
    .isMobilePhone().withMessage('Invalid phone number'),
  body('profileImage')
    .optional({ checkFalsy: true })
    .isURL().withMessage('Profile image must be a valid URL'),
], userController.updateProfile);

router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Minimum 8 characters'),
], userController.updatePassword);

router.post('/profile-image', [
  body('imageUrl').isURL(),
], userController.uploadProfileImage);

router.get('/stats', userController.getUserStats);

router.post('/support-ticket', [
  body('subject').notEmpty().isLength({ max: 200 }),
  body('description').notEmpty(),
  body('category').isIn(['account', 'payment', 'ride', 'delivery', 'technical', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
], userController.submitSupportTicket);

router.get('/support-tickets', userController.getSupportTickets);

router.post('/feedback', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString(),
  body('category').isIn(['app_experience', 'driver_quality', 'pricing', 'delivery_quality', 'other']),
  body('platform').isIn(['ios', 'android', 'web']),
  body('appVersion').optional().isString(),
], userController.submitFeedback);

router.post('/apply-promo', [
  body('code').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('serviceType').isIn(['rides', 'deliveries']),
], userController.applyPromoCode);

router.delete('/account', [
  body('password').notEmpty(),
], userController.deleteAccount);

module.exports = router;