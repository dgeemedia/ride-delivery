// backend/src/routes/notification.routes.js
const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', notificationController.getNotifications);

router.get('/count', notificationController.getUnreadCount);

router.put('/read-all', notificationController.markAllAsRead);

router.delete('/', notificationController.clearAll);

router.put('/:id/read', notificationController.markAsRead);

router.delete('/:id', notificationController.deleteNotification);

module.exports = router;