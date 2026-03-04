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
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      profileImage: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { user }
  });
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { firstName, lastName, phone, profileImage } = req.body;

  // Check if phone is being changed and if it's already taken
  if (phone && phone !== req.user.phone) {
    const existingUser = await prisma.user.findUnique({
      where: { phone }
    });

    if (existingUser) {
      throw new AppError('Phone number already in use', 400);
    }
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
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      profileImage: true,
      isVerified: true,
      createdAt: true
    }
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
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

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashedPassword }
  });

  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
};

/**
 * @desc    Upload profile image
 * @route   POST /api/users/profile-image
 * @access  Private
 */
exports.uploadProfileImage = async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    throw new AppError('Image URL is required', 400);
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { profileImage: imageUrl },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImage: true
    }
  });

  res.status(200).json({
    success: true,
    message: 'Profile image updated successfully',
    data: { user: updatedUser }
  });
};

/**
 * @desc    Delete account
 * @route   DELETE /api/users/account
 * @access  Private
 */
exports.deleteAccount = async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw new AppError('Password is required to delete account', 400);
  }

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }
  });

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Incorrect password', 400);
  }

  // Soft delete - deactivate account
  await prisma.user.update({
    where: { id: req.user.id },
    data: { isActive: false }
  });

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully'
  });
};

/**
 * @desc    Get user statistics
 * @route   GET /api/users/stats
 * @access  Private
 */
exports.getUserStats = async (req, res) => {
  const userId = req.user.id;

  if (req.user.role === 'CUSTOMER') {
    const [totalRides, totalDeliveries, totalSpent] = await Promise.all([
      prisma.ride.count({
        where: { customerId: userId, status: 'COMPLETED' }
      }),
      prisma.delivery.count({
        where: { customerId: userId, status: 'DELIVERED' }
      }),
      prisma.payment.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalRides,
        totalDeliveries,
        totalSpent: totalSpent._sum.amount || 0
      }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      message: 'Stats available for customers only'
    }
  });
};

module.exports = exports;