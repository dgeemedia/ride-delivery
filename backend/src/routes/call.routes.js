// backend/src/routes/call.routes.js
const express = require('express');
const { body, query } = require('express-validator');
const callController = require('../controllers/call.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

/**
 * @route   POST /api/calls/token
 * @desc    Get Agora RTC token for a call channel
 * @access  Private
 */
router.post(
  '/token',
  [body('channelName').notEmpty(), body('uid').optional().isInt()],
  callController.getCallToken
);

/**
 * @route   POST /api/calls/initiate
 * @desc    Signal a call to another user
 * @access  Private
 */
router.post(
  '/initiate',
  [
    body('targetUserId').notEmpty(),
    body('channelName').notEmpty(),
    body('callType').optional().isIn(['voice', 'video']),
  ],
  callController.initiateCall
);

/**
 * @route   GET /api/calls/nearest
 * @desc    Get nearest online drivers or delivery partners
 * @access  Private (CUSTOMER)
 */
router.get(
  '/nearest',
  authorize('CUSTOMER'),
  [
    query('lat').isFloat({ min: -90, max: 90 }),
    query('lng').isFloat({ min: -180, max: 180 }),
    query('type').optional().isIn(['driver', 'partner']),
    query('limit').optional().isInt({ min: 1, max: 20 }),
  ],
  callController.getNearestProviders
);

module.exports = router;