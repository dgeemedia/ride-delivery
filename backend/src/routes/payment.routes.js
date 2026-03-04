const express = require('express');
const { body, param } = require('express-validator');
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create payment intent (Stripe)
 * @access  Private
 */
router.post(
  '/create-intent',
  [
    body('amount').isFloat({ min: 0 }),
    body('rideId').optional().isUUID(),
    body('deliveryId').optional().isUUID()
  ],
  paymentController.createPaymentIntent
);

/**
 * @route   POST /api/payments/process
 * @desc    Process payment
 * @access  Private
 */
router.post(
  '/process',
  [
    body('rideId').optional().isUUID(),
    body('deliveryId').optional().isUUID(),
    body('amount').isFloat({ min: 0 }),
    body('method').isIn(['CASH', 'CARD', 'WALLET']),
    body('paymentIntentId').optional().isString()
  ],
  paymentController.processPayment
);

/**
 * @route   GET /api/payments/history
 * @desc    Get payment history
 * @access  Private
 */
router.get('/history', paymentController.getHistory);

/**
 * @route   GET /api/payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
router.get('/stats', paymentController.getStats);

/**
 * @route   GET /api/payments/:id
 * @desc    Get payment details
 * @access  Private
 */
router.get('/:id', param('id').isUUID(), paymentController.getPaymentById);

/**
 * @route   POST /api/payments/setup-intent
 * @desc    Create setup intent for saving card
 * @access  Private
 */
router.post('/setup-intent', paymentController.createSetupIntent);

/**
 * @route   POST /api/payments/card/add
 * @desc    Add payment card
 * @access  Private
 */
router.post(
  '/card/add',
  [
    body('paymentMethodId').notEmpty(),
    body('customerId').notEmpty()
  ],
  paymentController.addCard
);

/**
 * @route   GET /api/payments/cards
 * @desc    Get saved payment cards
 * @access  Private
 */
router.get('/cards', paymentController.getCards);

/**
 * @route   DELETE /api/payments/card/:id
 * @desc    Remove payment card
 * @access  Private
 */
router.delete('/card/:id', paymentController.removeCard);

/**
 * @route   POST /api/payments/:id/refund
 * @desc    Request refund
 * @access  Private
 */
router.post(
  '/:id/refund',
  param('id').isUUID(),
  [
    body('reason').optional().isString(),
    body('amount').optional().isFloat({ min: 0 })
  ],
  paymentController.requestRefund
);

module.exports = router;