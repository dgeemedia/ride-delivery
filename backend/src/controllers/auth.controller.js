const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');

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
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { email, phone, password, firstName, lastName, role } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { phone }
      ]
    }
  });

  if (existingUser) {
    throw new AppError('User with this email or phone already exists', 400);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      phone,
      password: hashedPassword,
      firstName,
      lastName,
      role
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

  // Generate token
  const token = generateToken(user.id);

  // FUTURE: Send welcome email
  // await sendWelcomeEmail(user.email, user.firstName);

  // FUTURE: Send SMS verification code
  // await sendSMSVerification(user.phone);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user,
      token
    }
  });
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { email, phone, password } = req.body;

  if (!email && !phone) {
    throw new AppError('Please provide email or phone number', 400);
  }

  // Find user
  const user = await prisma.user.findFirst({
    where: email ? { email } : { phone }
  });

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 403);
  }

  // Generate token
  const token = generateToken(user.id);

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: userWithoutPassword,
      token
    }
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
      createdAt: true
    }
  });

  res.status(200).json({
    success: true,
    data: { user }
  });
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Private
 */
exports.refreshToken = async (req, res) => {
  const token = generateToken(req.user.id);

  res.status(200).json({
    success: true,
    data: { token }
  });
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
  // FUTURE: Implement token blacklist in Redis
  // await redisClient.set(`blacklist_${token}`, 'true', 'EX', tokenExpiry);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

// FUTURE: Password reset functionality
// exports.forgotPassword = async (req, res) => {
//   const { email } = req.body;
//   const user = await prisma.user.findUnique({ where: { email } });
//   
//   if (!user) {
//     throw new AppError('No user found with this email', 404);
//   }
//   
//   const resetToken = crypto.randomBytes(32).toString('hex');
//   const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
//   
//   await prisma.user.update({
//     where: { id: user.id },
//     data: {
//       passwordResetToken: hashedToken,
//       passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
//     }
//   });
//   
//   await sendPasswordResetEmail(user.email, resetToken);
//   
//   res.status(200).json({
//     success: true,
//     message: 'Password reset link sent to email'
//   });
// };

module.exports = exports;