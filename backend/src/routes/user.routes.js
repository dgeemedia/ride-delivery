// backend/src/routes/user.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

// ─── PROFILE ─────────────────────────────────────────────────────────────────
router.get('/profile', userController.getProfile);

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

// ─── SUPPORT TICKETS ─────────────────────────────────────────────────────────

// Submit new ticket
router.post('/support-ticket', [
  body('subject').notEmpty().isLength({ max: 200 }),
  body('description').notEmpty(),
  body('category').isIn(['account', 'payment', 'ride', 'delivery', 'technical', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
], userController.submitSupportTicket);

// List own tickets
router.get('/support-tickets', userController.getSupportTickets);

// Get single ticket with reply thread (owner only)
router.get(
  '/support-tickets/:id',
  param('id').isUUID(),
  userController.getSupportTicketById
);

// Customer adds a follow-up reply to their own open ticket
router.post(
  '/support-tickets/:id/reply',
  param('id').isUUID(),
  [body('message').trim().notEmpty().isLength({ max: 1000 }).withMessage('Message is required (max 1000 chars)')],
  userController.addTicketReply
);

// ─── FEEDBACK ────────────────────────────────────────────────────────────────
router.post('/feedback', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional({ nullable: true }).isString(),
  body('category').isIn(['general', 'ui_ux', 'performance', 'feature', 'bug', 'pricing']),
  body('platform').isIn(['ios', 'android', 'web']),
  body('appVersion').optional().isString(),
], userController.submitFeedback);

// ─── PROMO ────────────────────────────────────────────────────────────────────
router.post('/apply-promo', [
  body('code').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('serviceType').isIn(['rides', 'deliveries']),
], userController.applyPromoCode);

// ─── ACCOUNT ─────────────────────────────────────────────────────────────────
router.delete('/account', [
  body('password').notEmpty(),
], userController.deleteAccount);

module.exports = router;