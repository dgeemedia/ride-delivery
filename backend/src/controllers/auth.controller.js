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
const emailService         = require('../services/email.service');

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

  // ── Email verification gate (ENABLE_EMAIL_VERIFICATION=true) ──────────────
  // When true: send a verification link and — if REQUIRE_EMAIL_VERIFICATION is
  // also true — do not issue a JWT until the link is clicked.
  // Set both to true in .env once your SMTP provider is configured.
  if (process.env.ENABLE_EMAIL_VERIFICATION === 'true') {
    try {
      await emailService.sendVerificationEmail(user.email, firstName, verifyToken);
    } catch (mailErr) {
      console.error('[auth] Verification email failed to send:', mailErr.message);
      // Non-fatal — account is created; user can request a resend.
    }

    return res.status(201).json({
      success:              true,
      message:              'Registration successful. Please check your email to verify your account before logging in.',
      requiresVerification: true,
      data:                 { email: user.email },
    });
  }

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

// ── Default: issue token immediately (all gates disabled) ─────────────────
  await prisma.wallet.create({
    data: { userId: user.id, balance: 0, currency: 'NGN' },
  });

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

  // ── Email verification gate ────────────────────────────────────────────────
  // Block login only when BOTH flags are true so you can enable email sending
  // first (ENABLE_EMAIL_VERIFICATION=true) and test delivery before flipping
  // REQUIRE_EMAIL_VERIFICATION=true to actually enforce it.
  if (process.env.ENABLE_EMAIL_VERIFICATION  === 'true' &&
      process.env.REQUIRE_EMAIL_VERIFICATION === 'true' &&
      !user.isVerified) {
    throw new AppError(
      'Please verify your email before logging in. Check your inbox or request a new verification link.',
      403
    );
  }

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
      success:     true,
      requiresOtp: true,
      data:        { tempToken, method, maskedContact },
    });
  }

  // ── No gates — issue token immediately ────────────────────────────────────
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
 
  // Always respond with the same message to prevent email enumeration.
  const SAFE_RESPONSE = {
    success: true,
    message: 'If that email exists, a reset link has been sent.',
  };
 
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(200).json(SAFE_RESPONSE);
 
  const resetToken  = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
 
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken:   hashedToken,
      passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });
 
  // ── Send reset email ───────────────────────────────────────────────────────
  try {
    await emailService.sendPasswordResetEmail(user.email, user.firstName, resetToken);
  } catch (mailErr) {
    console.error('[auth] Password reset email failed:', mailErr.message);
    // Roll back the token so the user can retry cleanly
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: null, passwordResetExpires: null },
    }).catch(() => {});
    throw new AppError(
      'Could not send the reset email. Please try again later or contact support.',
      500
    );
  }
 
  // ── In-app notification (belt-and-suspenders) ──────────────────────────────
  await notificationService.notify({
    userId:  user.id,
    title:   'Password Reset Requested',
    message: "A password reset link has been sent to your email. If this wasn't you, contact support immediately.",
    type:    notificationService.TYPES.PASSWORD_RESET,
    data:    {},
  }).catch(() => {}); // non-fatal
 
  res.status(200).json({
    ...SAFE_RESPONSE,
    ...(process.env.NODE_ENV === 'development' && { resetToken }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset password — GET: HTML form  |  POST: process new password
// Add GET /auth/reset-password/:token to your auth.routes.js pointing here.
// ─────────────────────────────────────────────────────────────────────────────
exports.getResetPasswordForm = async (req, res) => {
  const { token } = req.params;
  const safeToken = token.replace(/[^a-f0-9]/gi, '');
  const hashedToken = crypto.createHash('sha256').update(safeToken).digest('hex'); 
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken:   hashedToken,
      passwordResetExpires: { gt: new Date() },
    },
  });
 
  if (!user) {
    return res.status(400).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Link Expired — Diakite</title>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      </head>
      <body style="font-family:Arial,sans-serif;display:flex;align-items:center;
                   justify-content:center;min-height:100vh;margin:0;background:#f9f9f9">
        <div style="text-align:center;max-width:400px;padding:40px">
          <div style="font-size:56px;margin-bottom:16px">⏱️</div>
          <h1 style="font-weight:900;font-size:24px;margin-bottom:8px">Link expired</h1>
          <p style="color:#666;line-height:1.7">
            This password reset link is invalid or has expired (links are valid for 10 minutes).<br/><br/>
            Open the Diakite app and request a new reset link.
          </p>
        </div>
      </body></html>
    `);
  }
 
  // Valid token — render the password reset form
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Reset Password — Diakite</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; margin: 0; background: #f9f9f9;
          padding: 20px;
        }
        .card {
          background: #fff; border-radius: 18px; padding: 40px 32px;
          max-width: 420px; width: 100%;
          box-shadow: 0 4px 32px rgba(0,0,0,0.08);
        }
        h1 { font-size: 26px; font-weight: 900; margin: 0 0 6px; }
        p  { color: #666; line-height: 1.7; margin: 0 0 28px; font-size: 14px; }
        label { display: block; font-size: 12px; font-weight: 700; color: #444; margin-bottom: 6px; }
        input[type=password] {
          width: 100%; padding: 14px 16px; border: 1.5px solid #e5e5e5;
          border-radius: 11px; font-size: 15px; outline: none;
          transition: border-color 0.2s;
          margin-bottom: 14px;
        }
        input[type=password]:focus { border-color: #111; }
        button {
          width: 100%; background: #111; color: #fff; border: none;
          padding: 15px; border-radius: 11px; font-size: 15px;
          font-weight: 800; cursor: pointer; letter-spacing: 0.3px;
          transition: opacity 0.15s;
        }
        button:hover { opacity: 0.85; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .error { color: #ef4444; font-size: 13px; margin-bottom: 12px; font-weight: 500; }
        .success {
          text-align: center; padding: 20px 0;
        }
        .success .icon { font-size: 52px; margin-bottom: 12px; }
        .strength { height: 4px; border-radius: 2px; margin: -8px 0 14px; transition: all 0.3s; }
        .hint { font-size: 11px; color: #999; margin: -10px 0 14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>New password</h1>
        <p>Choose a strong password for your Diakite account. Minimum 8 characters.</p>
 
        <div id="formWrap">
          <div id="errorMsg" class="error" style="display:none"></div>
          <label for="pw">New password</label>
          <input type="password" id="pw"  placeholder="Enter new password"  oninput="checkStrength()" />
          <div id="strengthBar" class="strength" style="background:#e5e5e5"></div>
          <p class="hint" id="strengthHint"></p>
          <label for="pw2">Confirm password</label>
          <input type="password" id="pw2" placeholder="Confirm new password" />
          <button id="submitBtn" onclick="submitReset()">Reset Password</button>
        </div>
 
        <div id="successWrap" class="success" style="display:none">
          <div class="icon">✅</div>
          <h1 style="font-size:22px">Password updated!</h1>
          <p>Your Diakite password has been changed.<br/>Open the app and sign in with your new password.</p>
        </div>
      </div>
 
      <script>
        const TOKEN = '${safeToken}';
 
        function checkStrength() {
          const pw  = document.getElementById('pw').value;
          const bar = document.getElementById('strengthBar');
          const hint = document.getElementById('strengthHint');
          let score = 0;
          if (pw.length >= 8)          score++;
          if (pw.length >= 12)         score++;
          if (/[A-Z]/.test(pw))        score++;
          if (/[0-9]/.test(pw))        score++;
          if (/[^A-Za-z0-9]/.test(pw)) score++;
          const map = [
            { color: '#e5e5e5', label: '' },
            { color: '#ef4444', label: 'Weak'   },
            { color: '#f97316', label: 'Fair'   },
            { color: '#eab308', label: 'Good'   },
            { color: '#22c55e', label: 'Strong' },
            { color: '#16a34a', label: 'Very strong' },
          ];
          bar.style.background = map[score].color;
          bar.style.width = (score / 5 * 100) + '%';
          hint.textContent = map[score].label;
          hint.style.color  = map[score].color;
        }
 
        async function submitReset() {
          const pw   = document.getElementById('pw').value;
          const pw2  = document.getElementById('pw2').value;
          const btn  = document.getElementById('submitBtn');
          const err  = document.getElementById('errorMsg');
 
          err.style.display = 'none';
 
          if (pw.length < 8) {
            err.textContent = 'Password must be at least 8 characters.';
            err.style.display = 'block';
            return;
          }
          if (pw !== pw2) {
            err.textContent = 'Passwords do not match.';
            err.style.display = 'block';
            return;
          }
 
          btn.disabled    = true;
          btn.textContent = 'Saving…';
 
          try {
            const res = await fetch('/api/auth/reset-password/' + TOKEN, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ password: pw }),
            });
            const data = await res.json();
 
            if (!res.ok || !data.success) {
              err.textContent = data.message || 'Something went wrong. Please try again.';
              err.style.display = 'block';
              btn.disabled    = false;
              btn.textContent = 'Reset Password';
              return;
            }
 
            document.getElementById('formWrap').style.display    = 'none';
            document.getElementById('successWrap').style.display = 'block';
          } catch {
            err.textContent = 'Network error. Please check your connection and try again.';
            err.style.display = 'block';
            btn.disabled    = false;
            btn.textContent = 'Reset Password';
          }
        }
      </script>
    </body>
    </html>
  `);
};
// ─────────────────────────────────────────────────────────────────────────────
// Reset password  (POST — processes the form or an API call)
// Unchanged from original — keeping here for reference.
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
      passwordChangedAt:    new Date(),
    },
  });
 
  await notificationService.notify({
    userId:  user.id,
    title:   'Password Changed 🔑',
    message: 'Your password has been changed successfully. If you did not do this, contact support immediately.',
    type:    notificationService.TYPES.PASSWORD_RESET,
    data:    {},
  }).catch(() => {});
 
  res.status(200).json({ success: true, message: 'Password reset successfully. Please login.' });
};
 
// ─────────────────────────────────────────────────────────────────────────────
// Verify email  (GET /auth/verify-email/:token)
// Called when the user clicks the link in their inbox.
// Returns a user-friendly HTML page when accessed from a browser,
// or JSON when called from an API client.
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

  if (!user) {
    // Return a readable HTML error when opened in a browser
    if (req.headers.accept?.includes('text/html')) {
      return res.status(400).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Link Expired — Diakite</title></head>
        <body style="font-family:Arial,sans-serif;display:flex;align-items:center;
                     justify-content:center;min-height:100vh;margin:0;background:#f9f9f9">
          <div style="text-align:center;max-width:400px;padding:40px">
            <div style="font-size:56px;margin-bottom:16px">⚠️</div>
            <h1 style="font-weight:900;font-size:24px;margin-bottom:8px">Link expired</h1>
            <p style="color:#666;line-height:1.7">
              This verification link is invalid or has expired.<br/>
              Open the app and request a new verification email.
            </p>
          </div>
        </body></html>
      `);
    }
    throw new AppError('Invalid or expired verification token', 400);
  }

 await prisma.user.update({
    where: { id: user.id },
    data:  { isVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
  });

  await prisma.wallet.upsert({
    where:  { userId: user.id },
    update: {},
    create: { userId: user.id, balance: 0, currency: 'NGN' },
  });

  await notificationService.notify({
    userId:  user.id,
    title:   'Email Verified ✅',
    message: 'Your email address has been verified successfully.',
    type:    notificationService.TYPES.ACCOUNT_VERIFIED,
    data:    {},
  });

  // HTML response for browser clicks
  if (req.headers.accept?.includes('text/html')) {
    return res.status(200).send(`
      <!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Email Verified — Diakite</title></head>
      <body style="font-family:Arial,sans-serif;display:flex;align-items:center;
                   justify-content:center;min-height:100vh;margin:0;background:#f9f9f9">
        <div style="text-align:center;max-width:400px;padding:40px">
          <div style="font-size:56px;margin-bottom:16px">✅</div>
          <h1 style="font-weight:900;font-size:26px;margin-bottom:8px">You're verified!</h1>
          <p style="color:#666;line-height:1.7">
            Your Diakite account is now active.<br/>
            Open the app and sign in to get started.
          </p>
        </div>
      </body></html>
    `);
  }

  res.status(200).json({ success: true, message: 'Email verified successfully.' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Resend email verification
// Requires the user to be authenticated (they logged in despite unverified,
// e.g. when REQUIRE_EMAIL_VERIFICATION=false, or are on the pending screen).
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

  try {
    await emailService.sendVerificationEmail(user.email, user.firstName, verifyToken);
  } catch (mailErr) {
    console.error('[auth] Resend verification email failed:', mailErr.message);
    throw new AppError('Could not send verification email. Please try again later.', 500);
  }

  res.status(200).json({
    success: true,
    message: 'Verification email sent. Please check your inbox.',
    ...(process.env.NODE_ENV === 'development' && { verifyToken }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Resend verification by email (unauthenticated — for blocked users)
// ─────────────────────────────────────────────────────────────────────────────
exports.resendVerificationByEmail = async (req, res) => {
  const { email } = req.body;

  const SAFE_RESPONSE = {
    success: true,
    message: 'If that email exists and is unverified, a new link has been sent.',
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isVerified) return res.status(200).json(SAFE_RESPONSE);

  const verifyToken       = crypto.randomBytes(32).toString('hex');
  const hashedVerifyToken = crypto.createHash('sha256').update(verifyToken).digest('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyToken:   hashedVerifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  try {
    await emailService.sendVerificationEmail(user.email, user.firstName, verifyToken);
  } catch (mailErr) {
    console.error('[auth] Resend verification email failed:', mailErr.message);
    throw new AppError('Could not send verification email. Please try again later.', 500);
  }

  res.status(200).json({
    ...SAFE_RESPONSE,
    ...(process.env.NODE_ENV === 'development' && { verifyToken }),
  });
};

module.exports = exports;