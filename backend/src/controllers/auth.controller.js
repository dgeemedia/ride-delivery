// backend/src/controllers/auth.controller.js
'use strict';
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { AppError }         = require('../middleware/errorHandler');
const notificationService  = require('../services/notification.service');
const otpService           = require('../services/otp.service');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Fields returned to the client after a successful auth event
const AUTH_USER_SELECT = {
  id: true, email: true, phone: true,
  firstName: true, lastName: true,
  role: true, profileImage: true,
  isVerified: true, createdAt: true,
  twoFactorEnabled: true, twoFactorMethod: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });
 
  const { email, phone, password, firstName, lastName, role } = req.body;
 
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existingUser) throw new AppError('User with this email or phone already exists', 400);
 
  const hashedPassword    = await bcrypt.hash(password, 10);
  const verifyToken       = crypto.randomBytes(32).toString('hex');
  const hashedVerifyToken = crypto.createHash('sha256').update(verifyToken).digest('hex');
 
  const user = await prisma.user.create({
    data: {
      email, phone, password: hashedPassword,
      firstName, lastName, role,
      emailVerifyToken:   hashedVerifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    select: AUTH_USER_SELECT,
  });
 
  await notificationService.notify({
    userId:  user.id,
    title:   'Welcome to Diakite! 🎉',
    message: `Hi ${firstName}, your account has been created successfully.`,
    type:    notificationService.TYPES.ACCOUNT_WELCOME,
    data:    { role },
  });
 
  await prisma.wallet.create({
    data: { userId: user.id, balance: 0, currency: 'NGN' },
  });
 
  // ── OTP registration gate (ENABLE_REGISTRATION_OTP=true) ──────────────────
  // When enabled: don't issue a JWT yet — send an OTP and require verification
  // before the account is usable. Flip to true in .env when ready.
  if (process.env.ENABLE_REGISTRATION_OTP === 'true' &&
      process.env.ENABLE_OTP_DELIVERY    === 'true') {
    const method = process.env.OTP_DEFAULT_METHOD || 'SMS';
    const { code, tempToken } = await otpService.createOtp(user.id, 'REGISTER');
    await otpService.sendOtp(user, code, method);
 
    const maskedContact = method === 'EMAIL'
      ? otpService.maskEmail(user.email)
      : otpService.maskPhone(user.phone);
 
    return res.status(201).json({
      success:     true,
      message:     'Registration successful. Please verify your account.',
      requiresOtp: true,
      data:        { tempToken, method, maskedContact },
    });
  }
 
  // ── Default: issue token immediately (OTP disabled) ───────────────────────
  const token = generateToken(user.id);
 
  res.status(201).json({
    success: true,
    message: 'Registration successful.',
    data:    { user, token },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Login  (2FA-aware)
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });
 
  const { email, phone, password } = req.body;
  if (!email && !phone) throw new AppError('Please provide email or phone number', 400);
 
  const user = await prisma.user.findFirst({
    where: email ? { email } : { phone },
  });
 
  if (!user) throw new AppError('Invalid credentials', 401);
 
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new AppError('Invalid credentials', 401);
 
  if (!user.isActive)   throw new AppError('Account is deactivated. Contact support.', 403);
  if (user.isSuspended) throw new AppError(`Account suspended: ${user.suspensionReason || 'Contact support'}`, 403);
 
  // ── 2FA gate (ENABLE_2FA=true AND user has it switched on) ─────────────────
  // Set ENABLE_2FA=true in .env when your SMS/Email provider is live.
  if (process.env.ENABLE_2FA === 'true' && user.twoFactorEnabled) {
    const method = user.twoFactorMethod || process.env.OTP_DEFAULT_METHOD || 'SMS';
    const { code, tempToken } = await otpService.createOtp(user.id, 'LOGIN');
    await otpService.sendOtp(user, code, method);
 
    const maskedContact = method === 'EMAIL'
      ? otpService.maskEmail(user.email)
      : otpService.maskPhone(user.phone);
 
    return res.status(200).json({
      success:    true,
      requiresOtp: true,
      data: { tempToken, method, maskedContact },
    });
  }
 
  // ── No 2FA gate — issue token immediately ───────────────────────────────────
  const token = generateToken(user.id);
  const { password: _, emailVerifyToken: __, passwordResetToken: ___, ...safeUser } = user;
 
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data:    { user: safeUser, token },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Verify OTP  (completes a 2FA-gated login)
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  const { code, tempToken } = req.body;

  if (!code || !tempToken)
    throw new AppError('Code and session token are required', 400);

  const result = await otpService.verifyOtp(tempToken, String(code));
  if (!result.valid) throw new AppError(result.reason, 400);

  const user = await prisma.user.findUnique({
    where:  { id: result.userId },
    select: AUTH_USER_SELECT,
  });

  if (!user)           throw new AppError('User not found', 404);
  if (!user.isActive)  throw new AppError('Account is deactivated.', 403);

  const token = generateToken(user.id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data:    { user, token },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Resend OTP  (within a 2FA-gated login session)
// ─────────────────────────────────────────────────────────────────────────────
exports.resendOtp = async (req, res) => {
  const { tempToken } = req.body;
  if (!tempToken) throw new AppError('Session token is required', 400);

  // Look up which user + purpose this token belongs to
  const record = await prisma.otpVerification.findUnique({ where: { tempToken } });
  if (!record) throw new AppError('Session expired. Please log in again.', 400);
  if (new Date() > record.expiresAt) throw new AppError('Session expired. Please log in again.', 400);

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new AppError('User not found', 404);

  const method = user.twoFactorMethod || 'SMS';
  const { code, tempToken: newTempToken } = await otpService.createOtp(user.id, record.purpose);
  await otpService.sendOtp(user, code, method);

  const maskedContact = method === 'EMAIL'
    ? otpService.maskEmail(user.email)
    : otpService.maskPhone(user.phone);

  res.status(200).json({
    success: true,
    message: 'A new code has been sent.',
    data:    { tempToken: newTempToken, method, maskedContact },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Setup 2FA  (step 1 — sends OTP to verify ownership before enabling)
// ─────────────────────────────────────────────────────────────────────────────
exports.setupTwoFactor = async (req, res) => {
  const { method = 'SMS' } = req.body;
  if (!['SMS', 'EMAIL'].includes(method))
    throw new AppError('Method must be SMS or EMAIL', 400);

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.twoFactorEnabled) throw new AppError('2FA is already enabled', 400);

  const { code, tempToken } = await otpService.createOtp(user.id, 'SETUP_2FA');
  await otpService.sendOtp(user, code, method);

  const maskedContact = method === 'EMAIL'
    ? otpService.maskEmail(user.email)
    : otpService.maskPhone(user.phone);

  res.status(200).json({
    success: true,
    message: `Verification code sent to ${maskedContact}.`,
    data:    { tempToken, method, maskedContact },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Confirm 2FA setup  (step 2 — verify OTP and enable 2FA)
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmSetupTwoFactor = async (req, res) => {
  const { code, tempToken, method = 'SMS' } = req.body;
  if (!code || !tempToken) throw new AppError('Code and session token are required', 400);

  const result = await otpService.verifyOtp(tempToken, String(code));
  if (!result.valid) throw new AppError(result.reason, 400);

  // Ensure the OTP was for this authenticated user
  if (result.userId !== req.user.id)
    throw new AppError('Session mismatch', 403);

  await prisma.user.update({
    where: { id: req.user.id },
    data:  { twoFactorEnabled: true, twoFactorMethod: method },
  });

  await notificationService.notify({
    userId:  req.user.id,
    title:   '🔐 Two-Factor Authentication enabled',
    message: `2FA is now active on your account via ${method}. You'll be asked for a code each time you sign in.`,
    type:    'SECURITY_CHANGE',
    data:    {},
  });

  res.status(200).json({ success: true, message: '2FA enabled successfully.' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Disable 2FA  (requires current password for safety)
// ─────────────────────────────────────────────────────────────────────────────
exports.disableTwoFactor = async (req, res) => {
  const { password } = req.body;
  if (!password) throw new AppError('Password is required to disable 2FA', 400);

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user.twoFactorEnabled) throw new AppError('2FA is not enabled', 400);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new AppError('Incorrect password', 401);

  await prisma.user.update({
    where: { id: req.user.id },
    data:  { twoFactorEnabled: false, twoFactorMethod: null },
  });

  await notificationService.notify({
    userId:  req.user.id,
    title:   '⚠️ Two-Factor Authentication disabled',
    message: 'If you did not do this, please contact support immediately.',
    type:    'SECURITY_CHANGE',
    data:    {},
  });

  res.status(200).json({ success: true, message: '2FA disabled successfully.' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Get current user
// ─────────────────────────────────────────────────────────────────────────────
exports.getCurrentUser = async (req, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: {
      ...AUTH_USER_SELECT,
      wallet: { select: { balance: true, currency: true } },
    },
  });
  res.status(200).json({ success: true, data: { user } });
};

// ─────────────────────────────────────────────────────────────────────────────
// Refresh token
// ─────────────────────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  const token = generateToken(req.user.id);
  res.status(200).json({ success: true, data: { token } });
};

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  // TODO: add token to Redis blacklist when available
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Forgot password
// ─────────────────────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError('Email is required', 400);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If that email exists, a reset link has been sent.',
    });
  }

  const resetToken  = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken:   hashedToken,
      passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await notificationService.notify({
    userId:  user.id,
    title:   'Password Reset Requested',
    message: "A password reset was requested for your account. If this wasn't you, please contact support immediately.",
    type:    notificationService.TYPES.PASSWORD_RESET,
    data:    { resetToken },
  });

  res.status(200).json({
    success: true,
    message: 'If that email exists, a reset link has been sent.',
    ...(process.env.NODE_ENV === 'development' && { resetToken }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset password
// ─────────────────────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const { token }    = req.params;
  const { password } = req.body;

  if (!password || password.length < 8)
    throw new AppError('Password must be at least 8 characters', 400);

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken:   hashedToken,
      passwordResetExpires: { gt: new Date() },
    },
  });
  if (!user) throw new AppError('Invalid or expired reset token', 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password:             await bcrypt.hash(password, 10),
      passwordResetToken:   null,
      passwordResetExpires: null,
    },
  });

  await notificationService.notify({
    userId:  user.id,
    title:   'Password Changed',
    message: 'Your password has been changed. If you did not do this, contact support immediately.',
    type:    notificationService.TYPES.PASSWORD_RESET,
    data:    {},
  });

  res.status(200).json({ success: true, message: 'Password reset successfully. Please login.' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Verify email
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken:   hashedToken,
      emailVerifyExpires: { gt: new Date() },
    },
  });
  if (!user) throw new AppError('Invalid or expired verification token', 400);

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
  });

  await notificationService.notify({
    userId:  user.id,
    title:   'Email Verified ✅',
    message: 'Your email address has been verified successfully.',
    type:    notificationService.TYPES.ACCOUNT_VERIFIED,
    data:    {},
  });

  res.status(200).json({ success: true, message: 'Email verified successfully.' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Resend email verification
// ─────────────────────────────────────────────────────────────────────────────
exports.resendVerification = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.isVerified) throw new AppError('Email is already verified', 400);

  const verifyToken       = crypto.randomBytes(32).toString('hex');
  const hashedVerifyToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyToken:   hashedVerifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  res.status(200).json({
    success: true,
    message: 'Verification email sent.',
    ...(process.env.NODE_ENV === 'development' && { verifyToken }),
  });
};

module.exports = exports;