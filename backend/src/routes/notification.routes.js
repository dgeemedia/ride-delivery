// backend/src/routes/notification.routes.js
const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications (paginated, optional ?unreadOnly=true)
 * @access  Private
 */
router.get('/', notificationController.getNotifications);

/**
 * @route   GET /api/notifications/count
 * @desc    Get unread count (for notification badge)
 * @access  Private
 */
router.get('/count', notificationController.getUnreadCount);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all as read
 * @access  Private
 */
router.put('/read-all', notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications
 * @desc    Clear all notifications
 * @access  Private
 */
router.delete('/', notificationController.clearAll);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark one as read
 * @access  Private
 */
router.put('/:id/read', notificationController.markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete one notification
 * @access  Private
 */
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;