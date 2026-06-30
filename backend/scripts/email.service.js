// backend/src/services/email.service.js
//
// FIX #3 — SMTP config is validated at startup so missing env vars produce a
//           clear error rather than "connect ECONNREFUSED ::1:587" at send time.
'use strict';
const nodemailer = require('nodemailer');

// ── Guard: warn loudly if SMTP is not configured ──────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  // Log once at boot — does not crash the server but every send() will throw
  // with a readable message instead of ECONNREFUSED.
  console.warn(
    '[email.service] WARNING: SMTP is not fully configured.\n' +
    `  SMTP_HOST = ${SMTP_HOST ?? '(missing)'}\n` +
    `  SMTP_USER = ${SMTP_USER ?? '(missing)'}\n` +
    `  SMTP_PASS = ${SMTP_PASS ? '(set)' : '(missing)'}\n` +
    '  Set these in your .env file to enable email delivery.'
  );
}

// ── Transporter — created once, reused for all sends ─────────────────────────
const transporter = nodemailer.createTransport({
  host:   SMTP_HOST ?? 'localhost',
  port:   SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth:   SMTP_USER && SMTP_PASS
    ? { user: SMTP_USER, pass: SMTP_PASS }
    : undefined,
  // Give a cleaner error if the server is unreachable instead of hanging
  connectionTimeout: 10_000,
  greetingTimeout:   10_000,
  socketTimeout:     15_000,
});

const FROM = process.env.SMTP_FROM ?? '"Diakite" <noreply@diakite.com>';

// ── Internal send helper ──────────────────────────────────────────────────────
const _send = async ({ to, subject, html, text }) => {
  // Provide a readable error when SMTP is not configured rather than
  // exposing "ECONNREFUSED ::1:587" to the client.
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'Email delivery is not configured on this server. ' +
      'Please contact support or try again later.'
    );
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      ...(text && { text }),
    });
  } catch (err) {
    // Rethrow with a friendlier message; preserve original for server logs.
    console.error('[email.service] sendMail failed:', err.message);

    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw new Error(
        `Could not connect to mail server (${SMTP_HOST}:${SMTP_PORT}). ` +
        'Check SMTP_HOST and SMTP_PORT in your environment configuration.'
      );
    }
    if (err.responseCode >= 500) {
      throw new Error(`Mail server error (${err.responseCode}): ${err.response}`);
    }
    throw new Error(err.message ?? 'Failed to send email.');
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/** Generic HTML email */
exports.sendEmail = async ({ to, subject, html, text }) => {
  await _send({ to, subject, html, text });
};

/** OTP delivery */
exports.sendOtp = async (toEmail, code, expiryMinutes = 10) => {
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"/></head>
    <body style="font-family:Arial,sans-serif;padding:32px;color:#111;max-width:480px;margin:0 auto">
      <div style="margin-bottom:24px">
        <h1 style="font-size:24px;font-weight:900;margin:0">Diakite</h1>
      </div>
      <h2 style="font-size:18px;font-weight:700;margin-bottom:8px">Your verification code</h2>
      <p style="color:#666;margin-bottom:24px;font-size:14px;line-height:1.6">
        Use the code below to verify your identity.
        It expires in <strong>${expiryMinutes} minutes</strong>.
      </p>
      <div style="
        display:inline-block;background:#f5f5f5;border-radius:12px;
        padding:20px 36px;font-size:40px;font-weight:900;letter-spacing:10px;
        color:#111;margin-bottom:24px;border:1px solid #e0e0e0
      ">${code}</div>
      <p style="color:#999;font-size:12px;line-height:1.6;margin-top:24px">
        If you didn't request this code, you can safely ignore this email.<br/>
        <strong>Never share this code with anyone — including Diakite support.</strong>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#bbb;font-size:11px">
        © ${new Date().getFullYear()} Diakite. All rights reserved.
      </p>
    </body></html>
  `;
  await _send({
    to:      toEmail,
    subject: `${code} is your Diakite verification code`,
    html,
    text:    `Your Diakite verification code is: ${code}. Valid for ${expiryMinutes} minutes. Do not share this with anyone.`,
  });
};

/** Transaction history statement */
exports.sendTransactionHistory = async ({ to, subject, html }) => {
  await _send({ to, subject, html });
};

/** Email-address verification link */
exports.sendVerificationEmail = async (toEmail, firstName, verifyToken) => {
  const appUrl  = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const link    = `${appUrl}/api/auth/verify-email/${verifyToken}`;

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"/></head>
    <body style="font-family:Arial,sans-serif;padding:40px;color:#111;max-width:520px;margin:0 auto">
      <h1 style="font-size:24px;font-weight:900;margin:0 0 24px">Diakite</h1>
      <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Verify your email</h2>
      <p style="color:#555;line-height:1.7;margin-bottom:28px">
        Hi <strong>${firstName}</strong>, welcome aboard! Click the button below to
        activate your account. The link expires in <strong>24 hours</strong>.
      </p>
      <a href="${link}"
         style="display:inline-block;background:#111;color:#fff;text-decoration:none;
                padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;
                letter-spacing:0.3px;margin-bottom:28px">
        Verify my email
      </a>
      <p style="color:#999;font-size:13px;line-height:1.6">
        Or copy this link into your browser:<br/>
        <a href="${link}" style="color:#555;word-break:break-all">${link}</a>
      </p>
      <p style="color:#aaa;font-size:12px;margin-top:28px">
        If you didn't create an account you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#ccc;font-size:11px">
        © ${new Date().getFullYear()} Diakite. All rights reserved.
      </p>
    </body></html>
  `;

  await _send({
    to:      toEmail,
    subject: 'Verify your Diakite account',
    html,
    text: `Hi ${firstName}, verify your Diakite account here: ${link}\n\nThis link expires in 24 hours.`,
  });
};

/** Password reset link email */
exports.sendPasswordResetEmail = async (toEmail, firstName, resetToken) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  // Points to the GET handler that serves the HTML reset form (see auth.controller.js)
  const link   = `${appUrl}/api/auth/reset-password/${resetToken}`;
 
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"/></head>
    <body style="font-family:Arial,sans-serif;padding:40px;color:#111;max-width:520px;margin:0 auto">
      <h1 style="font-size:24px;font-weight:900;margin:0 0 24px">Diakite</h1>
      <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Reset your password</h2>
      <p style="color:#555;line-height:1.7;margin-bottom:8px">
        Hi <strong>${firstName}</strong>, we received a request to reset the password on your account.
      </p>
      <p style="color:#555;line-height:1.7;margin-bottom:28px">
        Click the button below to choose a new one.
        This link expires in <strong>10 minutes</strong>.
      </p>
      <a href="${link}"
         style="display:inline-block;background:#111;color:#fff;text-decoration:none;
                padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;
                letter-spacing:0.3px;margin-bottom:28px">
        Reset my password
      </a>
      <p style="color:#999;font-size:13px;line-height:1.6">
        Or copy this link into your browser:<br/>
        <a href="${link}" style="color:#555;word-break:break-all">${link}</a>
      </p>
      <p style="color:#aaa;font-size:13px;margin-top:20px">
        If you didn't request a password reset you can safely ignore this email —
        your password will not change.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>
      <p style="color:#ccc;font-size:11px">
        © ${new Date().getFullYear()} Diakite. All rights reserved.
      </p>
    </body></html>
  `;
 
  await _send({
    to:      toEmail,
    subject: 'Reset your Diakite password',
    html,
    text: [
      `Hi ${firstName},`,
      '',
      `We received a request to reset your Diakite password.`,
      `Click or copy the link below to choose a new one (expires in 10 minutes):`,
      '',
      link,
      '',
      `If you didn't request this, you can safely ignore this email.`,
    ].join('\n'),
  });
};
 