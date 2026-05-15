// backend/src/services/email.service.js
'use strict';
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT ?? '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? `"Diakite" <noreply@diakite.com>`;

// ── Generic HTML email ────────────────────────────────────────────────────────
exports.sendEmail = async ({ to, subject, html, text }) => {
  await transporter.sendMail({
    from: FROM,
    to,
    subject,
    html,
    ...(text && { text }),
  });
};

// ── OTP delivery ──────────────────────────────────────────────────────────────
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
        display:inline-block;
        background:#f5f5f5;
        border-radius:12px;
        padding:20px 36px;
        font-size:40px;
        font-weight:900;
        letter-spacing:10px;
        color:#111;
        margin-bottom:24px;
        border:1px solid #e0e0e0
      ">${code}</div>
      <p style="color:#999;font-size:12px;line-height:1.6;margin-top:24px">
        If you didn't request this code, you can safely ignore this email.<br/>
        <strong>Never share this code with anyone — including DuoRide support.</strong>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#bbb;font-size:11px">
        © ${new Date().getFullYear()} DuoRide. All rights reserved.
      </p>
    </body></html>
  `;

  await exports.sendEmail({
    to:      toEmail,
    subject: `${code} is your DuoRide verification code`,
    html,
    text:    `Your DuoRide verification code is: ${code}. Valid for ${expiryMinutes} minutes. Do not share this with anyone.`,
  });
};

// ── Transaction history statement ─────────────────────────────────────────────
exports.sendTransactionHistory = async ({ to, subject, html }) => {
  await exports.sendEmail({ to, subject, html });
};