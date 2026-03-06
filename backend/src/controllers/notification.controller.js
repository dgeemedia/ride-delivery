// backend/src/controllers/notification.controller.js
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

/**
 * @desc    Get all notifications for current user
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    userId: req.user.id,
    ...(unreadOnly === 'true' && { isRead: false })
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
  ]);

  res.status(200).json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    }
  });
};

/**
 * @desc    Mark a single notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res) => {
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new AppError('Notification not found', 404);
  if (notification.userId !== req.user.id) throw new AppError('Unauthorized', 403);

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true }
  });

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: { notification: updated }
  });
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true }
  });

  res.status(200).json({
    success: true,
    message: `${count} notification(s) marked as read`
  });
};

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
exports.deleteNotification = async (req, res) => {
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new AppError('Notification not found', 404);
  if (notification.userId !== req.user.id) throw new AppError('Unauthorized', 403);

  await prisma.notification.delete({ where: { id } });

  res.status(200).json({ success: true, message: 'Notification deleted' });
};

/**
 * @desc    Delete all notifications for current user
 * @route   DELETE /api/notifications
 * @access  Private
 */
exports.clearAll = async (req, res) => {
  const { count } = await prisma.notification.deleteMany({
    where: { userId: req.user.id }
  });

  res.status(200).json({ success: true, message: `${count} notification(s) cleared` });
};

/**
 * @desc    Get unread notification count (for badge)
 * @route   GET /api/notifications/count
 * @access  Private
 */
exports.getUnreadCount = async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false }
  });

  res.status(200).json({ success: true, data: { count } });
};

module.exports = exports;