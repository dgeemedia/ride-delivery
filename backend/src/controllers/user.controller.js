// backend/src/controllers/user.controller.js
const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
exports.getProfile = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, email: true, phone: true, firstName: true, lastName: true,
      role: true, profileImage: true, isVerified: true, isActive: true,
      createdAt: true, updatedAt: true,
      wallet: { select: { balance: true, currency: true } }
    }
  });

  if (!user) throw new AppError('User not found', 404);

  res.status(200).json({ success: true, data: { user } });
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { firstName, lastName, phone, profileImage } = req.body;

  if (phone && phone !== req.user.phone) {
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) throw new AppError('Phone number already in use', 400);
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(phone && { phone }),
      ...(profileImage && { profileImage })
    },
    select: {
      id: true, email: true, phone: true, firstName: true, lastName: true,
      role: true, profileImage: true, isVerified: true, createdAt: true
    }
  });

  res.status(200).json({ success: true, message: 'Profile updated successfully', data: { user: updatedUser } });
};

/**
 * @desc    Update password
 * @route   PUT /api/users/password
 * @access  Private
 */
exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current and new password', 400);
  }

  if (newPassword.length < 8) throw new AppError('New password must be at least 8 characters', 400);

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) throw new AppError('Current password is incorrect', 400);

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });

  res.status(200).json({ success: true, message: 'Password updated successfully' });
};

/**
 * @desc    Upload profile image URL
 * @route   POST /api/users/profile-image
 * @access  Private
 */
exports.uploadProfileImage = async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) throw new AppError('Image URL is required', 400);

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { profileImage: imageUrl },
    select: { id: true, firstName: true, lastName: true, profileImage: true }
  });

  res.status(200).json({ success: true, message: 'Profile image updated', data: { user: updatedUser } });
};

/**
 * @desc    Delete account (soft delete)
 * @route   DELETE /api/users/account
 * @access  Private
 */
exports.deleteAccount = async (req, res) => {
  const { password } = req.body;

  if (!password) throw new AppError('Password is required to delete account', 400);

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new AppError('Incorrect password', 400);

  await prisma.user.update({ where: { id: req.user.id }, data: { isActive: false } });

  res.status(200).json({ success: true, message: 'Account deactivated successfully' });
};

/**
 * @desc    Get user statistics
 * @route   GET /api/users/stats
 * @access  Private
 */
exports.getUserStats = async (req, res) => {
  const userId = req.user.id;

  if (req.user.role === 'CUSTOMER') {
    const [totalRides, totalDeliveries, totalSpent, wallet] = await Promise.all([
      prisma.ride.count({ where: { customerId: userId, status: 'COMPLETED' } }),
      prisma.delivery.count({ where: { customerId: userId, status: 'DELIVERED' } }),
      prisma.payment.aggregate({ where: { userId, status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.wallet.findUnique({ where: { userId }, select: { balance: true } })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalRides,
        totalDeliveries,
        totalSpent: totalSpent._sum.amount || 0,
        walletBalance: wallet?.balance || 0
      }
    });
  }

  if (req.user.role === 'DRIVER') {
    const [completedRides, totalEarnings, rating] = await Promise.all([
      prisma.ride.count({ where: { driverId: userId, status: 'COMPLETED' } }),
      prisma.ride.aggregate({ where: { driverId: userId, status: 'COMPLETED' }, _sum: { actualFare: true } }),
      prisma.driverProfile.findUnique({ where: { userId }, select: { rating: true, totalRides: true } })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        completedRides,
        totalEarnings: totalEarnings._sum.actualFare || 0,
        rating: rating?.rating || 0,
        totalRides: rating?.totalRides || 0
      }
    });
  }

  if (req.user.role === 'DELIVERY_PARTNER') {
    const [completedDeliveries, totalEarnings, profile] = await Promise.all([
      prisma.delivery.count({ where: { partnerId: userId, status: 'DELIVERED' } }),
      prisma.delivery.aggregate({ where: { partnerId: userId, status: 'DELIVERED' }, _sum: { actualFee: true } }),
      prisma.deliveryPartnerProfile.findUnique({ where: { userId }, select: { rating: true, totalDeliveries: true } })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        completedDeliveries,
        totalEarnings: totalEarnings._sum.actualFee || 0,
        rating: profile?.rating || 0,
        totalDeliveries: profile?.totalDeliveries || 0
      }
    });
  }

  res.status(200).json({ success: true, data: {} });
};

/**
 * @desc    Submit a support ticket
 * @route   POST /api/users/support-ticket
 * @access  Private
 */
exports.submitSupportTicket = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { subject, description, category, priority = 'medium' } = req.body;

  // Generate unique ticket number
  const ticketCount = await prisma.supportTicket.count();
  const ticketNumber = `TKT-${String(ticketCount + 1).padStart(6, '0')}`;

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user.id,
      ticketNumber,
      subject,
      description,
      category,
      priority
    }
  });

  res.status(201).json({
    success: true,
    message: 'Support ticket submitted. Our team will get back to you shortly.',
    data: { ticket }
  });
};

/**
 * @desc    Get user's support tickets
 * @route   GET /api/users/support-tickets
 * @access  Private
 */
exports.getSupportTickets = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const where = { userId: req.user.id };
  if (status) where.status = status;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    }),
    prisma.supportTicket.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { tickets, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

/**
 * @desc    Submit app feedback
 * @route   POST /api/users/feedback
 * @access  Private
 */
exports.submitFeedback = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { rating, comment, category, platform, appVersion } = req.body;

  const feedback = await prisma.appFeedback.create({
    data: {
      userId: req.user.id,
      rating,
      comment,
      category,
      platform,
      appVersion
    }
  });

  res.status(201).json({ success: true, message: 'Feedback submitted. Thank you!', data: { feedback } });
};

/**
 * @desc    Validate and preview a promo code
 * @route   POST /api/users/apply-promo
 * @access  Private
 */
exports.applyPromoCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { code, amount, serviceType } = req.body;

  const promo = await prisma.promoCode.findFirst({
    where: {
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
      applicableFor: { in: [serviceType, 'both'] }
    }
  });

  if (!promo) throw new AppError('Invalid, expired, or inapplicable promo code', 400);

  if (promo.maxUses && promo.currentUses >= promo.maxUses) {
    throw new AppError('Promo code usage limit reached', 400);
  }

  if (promo.minPurchaseAmount && amount < promo.minPurchaseAmount) {
    throw new AppError(`Minimum order amount of ₦${promo.minPurchaseAmount} required for this promo`, 400);
  }

  let discountAmount = 0;
  if (promo.discountType === 'percentage') {
    discountAmount = amount * (promo.discountValue / 100);
  } else {
    discountAmount = Math.min(promo.discountValue, amount);
  }

  const finalAmount = amount - discountAmount;

  res.status(200).json({
    success: true,
    message: 'Promo code applied!',
    data: {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount: discountAmount.toFixed(2),
      originalAmount: amount.toFixed(2),
      finalAmount: finalAmount.toFixed(2),
      description: promo.description
    }
  });
};

module.exports = exports;