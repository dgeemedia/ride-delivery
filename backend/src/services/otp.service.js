// backend/src/services/otp.service.js
// ── OTP generation, storage, verification, and delivery ──────────────────────
'use strict';
const crypto = require('crypto');
const prisma  = require('../lib/prisma');
const notificationService = require('./notification.service');

const OTP_LENGTH       = 6;
const OTP_EXPIRY_MIN   = 10;
const MAX_ATTEMPTS     = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

const generateCode = () =>
  Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join('');

const hashCode = (code) =>
  crypto.createHash('sha256').update(code).digest('hex');

const maskPhone = (phone) =>
  phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);

const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  return local[0] + '***@' + domain;
};

// ── createOtp ─────────────────────────────────────────────────────────────────
// Invalidates any prior OTP for the same user + purpose, then creates a fresh one.
// Returns the plaintext code (for delivery) and a tempToken (for client correlation).
const createOtp = async (userId, purpose) => {
  // Wipe stale records first to prevent accumulation
  await prisma.otpVerification.deleteMany({ where: { userId, purpose } });

  const code      = generateCode();
  const tempToken = crypto.randomBytes(32).toString('hex');

  await prisma.otpVerification.create({
    data: {
      userId,
      code:      hashCode(code),
      purpose,
      tempToken,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000),
    },
  });

  return { code, tempToken };
};

// ── verifyOtp ─────────────────────────────────────────────────────────────────
// Returns { valid: true, userId } on success, or { valid: false, reason } on failure.
const verifyOtp = async (tempToken, code) => {
  const record = await prisma.otpVerification.findUnique({ where: { tempToken } });

  if (!record) return { valid: false, reason: 'Invalid or expired code.' };

  if (new Date() > record.expiresAt) {
    await prisma.otpVerification.delete({ where: { id: record.id } });
    return { valid: false, reason: 'Code has expired. Please request a new one.' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.otpVerification.delete({ where: { id: record.id } });
    return { valid: false, reason: 'Too many attempts. Please request a new code.' };
  }

  if (record.code !== hashCode(code)) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data:  { attempts: { increment: 1 } },
    });
    const remaining = MAX_ATTEMPTS - (record.attempts + 1);
    return {
      valid:  false,
      reason: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
    };
  }

  // Success — delete the record so it can't be reused
  await prisma.otpVerification.delete({ where: { id: record.id } });
  return { valid: true, userId: record.userId };
};

// ── sendOtp ───────────────────────────────────────────────────────────────────
// Delivers the OTP to the user.
// TODO: integrate Termii / Twilio for production SMS, and an email provider.
// For now, we fall back to in-app notification (visible in dev/staging).
const sendOtp = async (user, code, method = 'SMS') => {
  const maskedContact = method === 'EMAIL'
    ? maskEmail(user.email)
    : maskPhone(user.phone);

  // ── SMS (Termii / Twilio / etc.) ───────────────────────────────────────────
  // TODO: uncomment and configure when your SMS provider is ready:
  //
  // if (method === 'SMS') {
  //   await termiiService.send(user.phone,
  //     `Your DuoRide code: ${code}. Valid for ${OTP_EXPIRY_MIN} mins. Don't share this.`
  //   );
  //   return;
  // }

  // ── EMAIL ─────────────────────────────────────────────────────────────────
  // TODO: uncomment when email service is ready:
  //
  // if (method === 'EMAIL') {
  //   await emailService.sendOtp(user.email, code, OTP_EXPIRY_MIN);
  //   return;
  // }

  // ── Fallback: in-app notification (dev / staging only) ────────────────────
  await notificationService.notify({
    userId:  user.id,
    title:   '🔐 Your verification code',
    message: `Your login code is: ${code}. It expires in ${OTP_EXPIRY_MIN} minutes. Do not share this code.`,
    type:    'OTP_CODE',
    data: {
      // Only expose the raw code in non-production environments (for testing)
      ...(process.env.NODE_ENV !== 'production' && { code }),
    },
  });
};

module.exports = { createOtp, verifyOtp, sendOtp, maskPhone, maskEmail };