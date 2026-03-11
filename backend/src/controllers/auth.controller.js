// backend/src/controllers/auth.controller.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notification.service');

const prisma = new PrismaClient();

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, phone, password, firstName, lastName, role } = req.body;

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] }
  });

  if (existingUser) {
    throw new AppError('User with this email or phone already exists', 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Generate email verification token
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const hashedVerifyToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

  const user = await prisma.user.create({
    data: {
      email,
      phone,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      emailVerifyToken: hashedVerifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true
    }
  });

  const token = generateToken(user.id);

  // Send welcome notification
  await notificationService.notify({
    userId: user.id,
    title: 'Welcome to DuoRide! 🎉',
    message: `Hi ${firstName}, your account has been created successfully. Start exploring rides and deliveries!`,
    type: notificationService.TYPES.ACCOUNT_WELCOME,
    data: { role }
  });

  // Create wallet for new user
  await prisma.wallet.create({
    data: {
      userId: user.id,
      balance: 0,
      currency: 'NGN'
    }
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    data: { user, token }
  });
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, phone, password } = req.body;

  if (!email && !phone) {
    throw new AppError('Please provide email or phone number', 400);
  }

  const user = await prisma.user.findFirst({
    where: email ? { email } : { phone }
  });

  if (!user) throw new AppError('Invalid credentials', 401);

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new AppError('Invalid credentials', 401);

  if (!user.isActive) throw new AppError('Account is deactivated. Contact support.', 403);
  if (user.isSuspended) throw new AppError(`Account suspended: ${user.suspensionReason || 'Contact support'}`, 403);

  const token = generateToken(user.id);
  const { password: _, emailVerifyToken: __, passwordResetToken: ___, ...userWithoutSensitive } = user;

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user: userWithoutSensitive, token }
  });
};

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getCurrentUser = async (req, res) => {
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
      createdAt: true,
      wallet: {
        select: { balance: true, currency: true }
      }
    }
  });

  res.status(200).json({ success: true, data: { user } });
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Private
 */
exports.refreshToken = async (req, res) => {
  const token = generateToken(req.user.id);
  res.status(200).json({ success: true, data: { token } });
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
  // Token blacklist can be added via Redis when available
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * @desc    Forgot password — sends reset link to email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) throw new AppError('Email is required', 400);

  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond 200 to prevent email enumeration
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If that email exists, a reset link has been sent.'
    });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    }
  });

  // Send in-app notification
  await notificationService.notify({
    userId: user.id,
    title: 'Password Reset Requested',
    message: 'A password reset was requested for your account. If this wasn\'t you, please contact support immediately.',
    type: notificationService.TYPES.PASSWORD_RESET,
    data: { resetToken } // In production: send via email, not in notification data
  });

  // TODO: Send email with reset link
  // await emailService.sendPasswordResetEmail(user.email, resetToken);

  res.status(200).json({
    success: true,
    message: 'If that email exists, a reset link has been sent.',
    // Only expose token in dev mode for testing
    ...(process.env.NODE_ENV === 'development' && { resetToken })
  });
};

/**
 * @desc    Reset password using token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { gt: new Date() }
    }
  });

  if (!user) throw new AppError('Invalid or expired reset token', 400);

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null
    }
  });

  await notificationService.notify({
    userId: user.id,
    title: 'Password Changed',
    message: 'Your password has been changed successfully. If you did not do this, contact support immediately.',
    type: notificationService.TYPES.PASSWORD_RESET,
    data: {}
  });

  res.status(200).json({ success: true, message: 'Password reset successfully. Please login.' });
};

/**
 * @desc    Verify email with token
 * @route   POST /api/auth/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: hashedToken,
      emailVerifyExpires: { gt: new Date() }
    }
  });

  if (!user) throw new AppError('Invalid or expired verification token', 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null
    }
  });

  await notificationService.notify({
    userId: user.id,
    title: 'Email Verified ✅',
    message: 'Your email address has been verified successfully.',
    type: notificationService.TYPES.ACCOUNT_VERIFIED,
    data: {}
  });

  res.status(200).json({ success: true, message: 'Email verified successfully.' });
};

/**
 * @desc    Resend email verification
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
exports.resendVerification = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (user.isVerified) throw new AppError('Email is already verified', 400);

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const hashedVerifyToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyToken: hashedVerifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  // TODO: await emailService.sendVerificationEmail(user.email, verifyToken);

  res.status(200).json({
    success: true,
    message: 'Verification email sent.',
    ...(process.env.NODE_ENV === 'development' && { verifyToken })
  });
};

module.exports = exports;