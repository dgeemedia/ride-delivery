// backend/src/services/email.service.js
//
// Email delivery via Brevo's HTTP API (https://api.brevo.com/v3/smtp/email)
// instead of SMTP. SMTP ports (25/465/587) are blocked on Render's free tier;
// the HTTP API runs over standard HTTPS (443), which is never blocked.
'use strict';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL  = 'https://api.brevo.com/v3/smtp/email';

// Parses "Name <email@domain.com>" or a bare email into Brevo's { email, name } shape
const parseSender = (raw) => {
  const fallback = { email: 'noreply@diakite.com', name: 'Diakite' };
  if (!raw) return fallback;
  const match = raw.match(/^"?([^"<]*)"?\s*<(.+)>$/);
  if (match) return { name: match[1].trim() || fallback.name, email: match[2].trim() };
  return { email: raw.trim(), name: fallback.name };
};

const FROM = parseSender(process.env.SMTP_FROM ?? process.env.EMAIL_FROM);

if (!BREVO_API_KEY) {
  console.warn(
    '[email.service] WARNING: BREVO_API_KEY is not set.\n' +
    '  Get an API key (starts with "xkeysib-") from Brevo → Settings → API Keys.\n' +
    '  This is DIFFERENT from your SMTP_PASS key — set BREVO_API_KEY in .env.'
  );
}

// ── Internal send helper ──────────────────────────────────────────────────────
const _send = async ({ to, subject, html, text }) => {
  if (!BREVO_API_KEY) {
    throw new Error(
      'Email delivery is not configured on this server. ' +
      'Please contact support or try again later.'
    );
  }

  let response;
  try {
    response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: FROM,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(text && { textContent: text }),
      }),
    });
  } catch (err) {
    // Network-level failure (DNS, connection refused, timeout, etc.)
    console.error('[email.service] Brevo API request failed:', err.message);
    throw new Error('Could not reach the email provider. Please try again later.');
  }

  if (!response.ok) {
    let body;
    try { body = await response.json(); } catch { body = null; }
    const reason = body?.message || `HTTP ${response.status}`;
    console.error('[email.service] Brevo API rejected the request:', reason, body);

    if (response.status === 401) {
      throw new Error('Email provider rejected the API key. Check BREVO_API_KEY in your environment configuration.');
    }
    if (response.status === 400) {
      throw new Error(`Email provider rejected the request: ${reason}`);
    }
    throw new Error(`Mail server error (${response.status}): ${reason}`);
  }
};

// ── Shared visual language ────────────────────────────────────────────────────
// Every template below reuses this shell so the brand feels consistent and
// premium — the same "black-label" polish used across OTP / verify / reset,
// tuned to read cleaner than the transactional emails Uber, Bolt and inDrive
// send for approvals and payouts.
const wrap = (bodyHtml) => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style="margin:0;padding:0;background:#f6f6f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.05);">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <h1 style="font-size:22px;font-weight:900;margin:0;color:#111;letter-spacing:-0.3px;">Diakite</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 40px 40px;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin-top:20px;">
            <tr>
              <td align="center" style="color:#bbb;font-size:11px;line-height:1.6;">
                © ${new Date().getFullYear()} Diakite. All rights reserved.<br/>
                You're receiving this because you have a Diakite driver/partner account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body></html>
`;

const pill = (text, bg, color) => `
  <span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:800;
    padding:6px 14px;border-radius:999px;letter-spacing:0.2px;margin-bottom:18px;">${text}</span>
`;

const ngn = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;

// Shared "here are your login details" box — used whenever an admin creates
// an account (and therefore knows the initial password) on someone's behalf.
const credentialsBlock = (email, password) => !password ? '' : `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border:1px solid #d6e0fb;border-radius:14px;margin:20px 0;">
    <tr><td style="padding:18px 20px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#1a3a8f;">🔑 Your login details</p>
      <p style="margin:0 0 4px;font-size:13px;color:#222;"><strong>Email:</strong> ${email}</p>
      <p style="margin:0;font-size:13px;color:#222;"><strong>Temporary password:</strong> <code style="background:#fff;padding:2px 8px;border-radius:6px;border:1px solid #d6e0fb;">${password}</code></p>
      <p style="margin:10px 0 0;font-size:12px;color:#3556b8;line-height:1.5;">
        For your security, please log in and change this password as soon as possible.
      </p>
    </td></tr>
  </table>`;

// ── Public API (signatures unchanged — no caller code needs to change) ───────

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
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const link   = `${appUrl}/api/auth/verify-email/${verifyToken}`;

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

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Driver / Partner document review outcome + bonus emails
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sent when a driver's document review is approved — OR when an admin
 * creates a driver account directly (source: 'admin_created'), in which
 * case there was no document review to reference and login credentials
 * may be included instead.
 *
 * @param {object} opts
 * @param {number} [opts.bonusAmount]
 * @param {string} [opts.note]
 * @param {'approval'|'admin_created'} [opts.source]
 * @param {string} [opts.password] - only relevant when source is 'admin_created'
 */
exports.sendDriverApprovedEmail = async (toEmail, firstName, { bonusAmount = 0, note = '', source = 'approval', password = null } = {}) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const isAdminCreated = source === 'admin_created';

  const bonusBlock = bonusAmount > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8ec;border:1px solid #f5e1b8;border-radius:14px;margin:20px 0;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#92400e;">🎁 Onboarding bonus credited</p>
        <p style="margin:0;font-size:22px;font-weight:900;color:#111;">${ngn(bonusAmount)}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#92400e;line-height:1.5;">
          This bonus is <strong>non-withdrawable</strong> — it's already in your wallet and ready to use toward accepting your first rides.
        </p>
      </td></tr>
    </table>` : '';
  const noteBlock = note ? `<p style="color:#666;font-size:13px;line-height:1.6;margin:16px 0 0;"><strong>Note from our team:</strong> ${note}</p>` : '';
  const credsBlock = isAdminCreated ? credentialsBlock(toEmail, password) : '';

  const intro = isAdminCreated
    ? `Our team has set up your Diakite driver account and it's <strong>ready to go</strong> — you can log in and start receiving ride requests right away.`
    : `Great news — our team has reviewed your documents and your Diakite driver account is now
       <strong>fully active</strong>. You can go online right now and start receiving ride requests.`;

  const body = `
    ${pill(isAdminCreated ? 'ACCOUNT CREATED' : 'DOCUMENT REVIEW COMPLETE', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      ${isAdminCreated ? `Welcome to Diakite, ${firstName} 🎉` : `You're approved, ${firstName} 🎉`}
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 8px;">${intro}</p>
    ${credsBlock}
    ${bonusBlock}
    ${noteBlock}
    <a href="${appUrl}/go-online" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;margin-top:22px;">
      Go online now
    </a>
    <p style="color:#aaa;font-size:12px;margin-top:26px;line-height:1.6;">
      Tip: keep your documents up to date in the app to avoid any interruption to your account.
    </p>
  `;

  await _send({
    to: toEmail,
    subject: isAdminCreated
      ? 'Welcome to Diakite — your driver account is ready 🎉'
      : 'Your Diakite documents are approved — you can start driving 🎉',
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      isAdminCreated
        ? `Your Diakite driver account has been created and is now active. You can log in and go online to start receiving ride requests.`
        : `Your Diakite document review is complete and your driver account is now active. You can go online and start receiving ride requests right away.`,
      isAdminCreated && password ? `\nLogin email: ${toEmail}\nTemporary password: ${password}\nPlease change this password after your first login.` : '',
      bonusAmount > 0 ? `\nAn onboarding bonus of ${ngn(bonusAmount)} (non-withdrawable) has been credited to your wallet.` : '',
      note ? `\nNote from our team: ${note}` : '',
    ].filter(Boolean).join('\n'),
  });
};

/** Sent when an admin rejects a driver's document review. */
exports.sendDriverRejectedEmail = async (toEmail, firstName, reason) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const body = `
    ${pill('DOCUMENT REVIEW COMPLETE', '#fdecec', '#b3261e')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      We couldn't approve your application, ${firstName}
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Our team has finished reviewing your documents, and unfortunately your driver
      application was not approved at this time.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">REASON</p>
        <p style="margin:0;font-size:14px;color:#222;line-height:1.6;">${reason}</p>
      </td></tr>
    </table>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 22px;">
      You're welcome to correct the issue above and resubmit your documents, or reach out
      to our support team if you have any questions.
    </p>
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      Update my documents
    </a>
  `;

  await _send({
    to: toEmail,
    subject: 'Update on your Diakite driver application',
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Our team has finished reviewing your documents. Unfortunately your driver application`,
      `was not approved at this time.`,
      '',
      `Reason: ${reason}`,
      '',
      `You can correct the issue and resubmit your documents, or contact support with questions.`,
    ].join('\n'),
  });
};

/**
 * Sent when a delivery partner's document review is approved — OR when an
 * admin creates a partner account directly (source: 'admin_created').
 * Same shape as sendDriverApprovedEmail, with courier-facing copy.
 */
exports.sendPartnerApprovedEmail = async (toEmail, firstName, { bonusAmount = 0, note = '', source = 'approval', password = null } = {}) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const isAdminCreated = source === 'admin_created';

  const bonusBlock = bonusAmount > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8ec;border:1px solid #f5e1b8;border-radius:14px;margin:20px 0;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#92400e;">🎁 Onboarding bonus credited</p>
        <p style="margin:0;font-size:22px;font-weight:900;color:#111;">${ngn(bonusAmount)}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#92400e;line-height:1.5;">
          This bonus is <strong>non-withdrawable</strong> — it's already in your wallet and ready to use toward accepting your first deliveries.
        </p>
      </td></tr>
    </table>` : '';
  const noteBlock = note ? `<p style="color:#666;font-size:13px;line-height:1.6;margin:16px 0 0;"><strong>Note from our team:</strong> ${note}</p>` : '';
  const credsBlock = isAdminCreated ? credentialsBlock(toEmail, password) : '';

  const intro = isAdminCreated
    ? `Our team has set up your Diakite courier account and it's <strong>ready to go</strong> — you can log in and start receiving delivery requests right away.`
    : `Great news — our team has reviewed your documents and your Diakite courier account is now
       <strong>fully active</strong>. You can go online right now and start receiving delivery requests.`;

  const body = `
    ${pill(isAdminCreated ? 'ACCOUNT CREATED' : 'DOCUMENT REVIEW COMPLETE', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      ${isAdminCreated ? `Welcome to Diakite, ${firstName} 🎉` : `You're approved, ${firstName} 🎉`}
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 8px;">${intro}</p>
    ${credsBlock}
    ${bonusBlock}
    ${noteBlock}
    <a href="${appUrl}/go-online" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;margin-top:22px;">
      Go online now
    </a>
    <p style="color:#aaa;font-size:12px;margin-top:26px;line-height:1.6;">
      Tip: keep your documents up to date in the app to avoid any interruption to your account.
    </p>
  `;

  await _send({
    to: toEmail,
    subject: isAdminCreated
      ? 'Welcome to Diakite — your courier account is ready 🎉'
      : 'Your Diakite documents are approved — you can start delivering 🎉',
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      isAdminCreated
        ? `Your Diakite courier account has been created and is now active. You can log in and go online to start receiving delivery requests.`
        : `Your Diakite document review is complete and your courier account is now active. You can go online and start receiving delivery requests right away.`,
      isAdminCreated && password ? `\nLogin email: ${toEmail}\nTemporary password: ${password}\nPlease change this password after your first login.` : '',
      bonusAmount > 0 ? `\nAn onboarding bonus of ${ngn(bonusAmount)} (non-withdrawable) has been credited to your wallet.` : '',
      note ? `\nNote from our team: ${note}` : '',
    ].filter(Boolean).join('\n'),
  });
};

/** Sent when an admin rejects a delivery partner's document review. */
exports.sendPartnerRejectedEmail = async (toEmail, firstName, reason) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const body = `
    ${pill('DOCUMENT REVIEW COMPLETE', '#fdecec', '#b3261e')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      We couldn't approve your application, ${firstName}
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Our team has finished reviewing your documents, and unfortunately your courier
      application was not approved at this time.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">REASON</p>
        <p style="margin:0;font-size:14px;color:#222;line-height:1.6;">${reason}</p>
      </td></tr>
    </table>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 22px;">
      You're welcome to correct the issue above and resubmit your documents, or reach out
      to our support team if you have any questions.
    </p>
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      Update my documents
    </a>
  `;

  await _send({
    to: toEmail,
    subject: 'Update on your Diakite courier application',
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Our team has finished reviewing your documents. Unfortunately your courier application`,
      `was not approved at this time.`,
      '',
      `Reason: ${reason}`,
      '',
      `You can correct the issue and resubmit your documents, or contact support with questions.`,
    ].join('\n'),
  });
};

/**
 * Generic bonus / wallet-credit notification email — use this for any
 * standalone bonus disbursement (mass onboarding bonus runs, custom bonus
 * grants, promo credits, etc.) separate from the approval flow above.
 *
 * @param {string} toEmail
 * @param {string} firstName
 * @param {object} opts
 * @param {number} opts.amount           - amount credited, in NGN
 * @param {boolean} opts.withdrawable    - true if the funds can be withdrawn to bank
 * @param {string}  [opts.description]   - optional human-readable reason
 */
exports.sendBonusEmail = async (toEmail, firstName, { amount, withdrawable = false, description = '' } = {}) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const badge  = withdrawable
    ? pill('WITHDRAWABLE BONUS', '#e8f0fe', '#1a56db')
    : pill('NON-WITHDRAWABLE BONUS', '#fff4e5', '#92400e');

  const usageNote = withdrawable
    ? 'This bonus is withdrawable — you can transfer it to your bank account at any time from your wallet.'
    : 'This bonus is non-withdrawable — it stays in your wallet and can only be used to accept rides or deliveries.';

  const body = `
    ${badge}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      ${ngn(amount)} added to your wallet
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, a bonus has just been credited to your Diakite wallet.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:14px;margin-bottom:18px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">AMOUNT CREDITED</p>
        <p style="margin:0 0 10px;font-size:28px;font-weight:900;color:#111;">${ngn(amount)}</p>
        ${description ? `<p style="margin:0;font-size:13px;color:#555;line-height:1.6;">${description}</p>` : ''}
      </td></tr>
    </table>
    <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 22px;">${usageNote}</p>
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      View my wallet
    </a>
  `;

  await _send({
    to: toEmail,
    subject: `${ngn(amount)} bonus added to your Diakite wallet`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `A bonus of ${ngn(amount)} has been credited to your Diakite wallet.`,
      withdrawable
        ? 'This bonus is withdrawable to your bank account.'
        : 'This bonus is non-withdrawable and can only be used to accept rides or deliveries.',
      description ? `\n${description}` : '',
    ].filter(Boolean).join('\n'),
  });
};

/**
 * Sent when an admin creates ANY non-earner account directly (CUSTOMER,
 * SUPPORT, MODERATOR, ADMIN, SUPER_ADMIN). Driver/DeliveryPartner accounts
 * use sendDriverApprovedEmail / sendPartnerApprovedEmail instead, since they
 * carry ride/delivery-specific copy (going online, onboarding bonus, etc).
 *
 * @param {object} opts
 * @param {string} opts.role       - e.g. 'ADMIN', 'SUPPORT', 'MODERATOR', 'SUPER_ADMIN', 'CUSTOMER'
 * @param {string} [opts.password] - initial password, if the admin set one
 */
const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  SUPPORT:     'Support',
  MODERATOR:   'Moderator',
  CUSTOMER:    'Customer',
};

exports.sendAdminCreatedAccountEmail = async (toEmail, firstName, { role, password = null } = {}) => {
  const appUrl    = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const roleLabel = ROLE_LABELS[role] ?? role ?? 'Diakite';
  const isStaff   = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'MODERATOR'].includes(role);

  const body = `
    ${pill('ACCOUNT CREATED', '#e8f0fe', '#1a56db')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">Welcome to Diakite, ${firstName} 👋</h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 8px;">
      ${isStaff
        ? `An account has been created for you on the Diakite ${roleLabel} team. You now have ${roleLabel.toLowerCase()} access to the admin dashboard.`
        : `Your Diakite account has been created by our team and is ready to use.`}
    </p>
    ${credentialsBlock(toEmail, password)}
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;margin-top:14px;">
      ${isStaff ? 'Go to dashboard' : 'Open Diakite'}
    </a>
    <p style="color:#aaa;font-size:12px;margin-top:26px;line-height:1.6;">
      If you weren't expecting this account, please contact support immediately.
    </p>
  `;

  await _send({
    to: toEmail,
    subject: isStaff ? `Your Diakite ${roleLabel} account is ready` : 'Welcome to Diakite — your account is ready',
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      isStaff
        ? `An account has been created for you on the Diakite ${roleLabel} team.`
        : `Your Diakite account has been created by our team and is ready to use.`,
      password ? `\nLogin email: ${toEmail}\nTemporary password: ${password}\nPlease change this password after your first login.` : '',
      `\nIf you weren't expecting this account, please contact support immediately.`,
    ].filter(Boolean).join('\n'),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Account status, support ticket, withdrawal, and wallet-adjustment
// notifications. Same visual language as everything above, so the whole
// notification surface feels like one coherent, premium product.
// ─────────────────────────────────────────────────────────────────────────────

const mask = (str, keep = 4) => {
  const s = String(str || '');
  return s.length <= keep ? s : `${'*'.repeat(Math.max(s.length - keep, 0))}${s.slice(-keep)}`;
};

/** Sent when an admin suspends a user's account. */
exports.sendAccountSuspendedEmail = async (toEmail, firstName, reason) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const body = `
    ${pill('ACCOUNT SUSPENDED', '#fdecec', '#b3261e')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">Your account has been suspended</h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your Diakite account has been temporarily suspended and you won't be able to
      log in or use the app until this is resolved.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">REASON</p>
        <p style="margin:0;font-size:14px;color:#222;line-height:1.6;">${reason || 'Policy violation'}</p>
      </td></tr>
    </table>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 22px;">
      If you believe this was a mistake, or you'd like to appeal, please contact our support team —
      we're happy to review your case.
    </p>
    <a href="${appUrl}/support" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      Contact support
    </a>
  `;

  await _send({
    to: toEmail,
    subject: 'Your Diakite account has been suspended',
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your Diakite account has been temporarily suspended.`,
      `Reason: ${reason || 'Policy violation'}`,
      '',
      `If you believe this is a mistake or wish to appeal, please contact support.`,
    ].join('\n'),
  });
};

/** Sent when an admin reactivates a previously suspended user's account. */
exports.sendAccountReactivatedEmail = async (toEmail, firstName) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const body = `
    ${pill('ACCOUNT REACTIVATED', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">Welcome back, ${firstName} 👋</h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 22px;">
      Good news — your Diakite account has been reactivated and you can log in right away.
      Everything is back to normal.
    </p>
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      Log in to Diakite
    </a>
  `;

  await _send({
    to: toEmail,
    subject: 'Your Diakite account is active again ✅',
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your Diakite account has been reactivated. You can log in right away.`,
    ].join('\n'),
  });
};

/**
 * Sent when an admin deletes a user's account. Call this with the user's
 * ORIGINAL email/firstName — capture them before anonymising the record,
 * since by the time the DB write completes those fields no longer exist.
 */
exports.sendAccountDeletedEmail = async (toEmail, firstName) => {
  const body = `
    ${pill('ACCOUNT DELETED', '#f2f2f2', '#444')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">Your Diakite account has been deleted</h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, this confirms that your Diakite account has been deleted by our team and is no
      longer active. Your personal data has been anonymised in line with our data retention policy.
    </p>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 22px;">
      If you didn't expect this, or believe it happened in error, please contact support as soon as
      possible so we can look into it.
    </p>
  `;

  await _send({
    to: toEmail,
    subject: 'Confirmation: your Diakite account has been deleted',
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `This confirms your Diakite account has been deleted by our team and your personal data has`,
      `been anonymised. If you didn't expect this, please contact support immediately.`,
    ].join('\n'),
  });
};

/** Sent when a support agent replies to a user's ticket. */
exports.sendTicketReplyEmail = async (toEmail, firstName, { ticketNumber, message }) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const preview = String(message || '').slice(0, 240);
  const body = `
    ${pill('SUPPORT REPLY', '#e8f0fe', '#1a56db')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      We've replied to ticket #${ticketNumber}
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, one of our support agents just responded to your ticket.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">SUPPORT SAYS</p>
        <p style="margin:0;font-size:14px;color:#222;line-height:1.6;">${preview}${message && message.length > 240 ? '…' : ''}</p>
      </td></tr>
    </table>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 22px;">
      Log in to view the full conversation and reply if you need to provide more information.
    </p>
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      View ticket #${ticketNumber}
    </a>
  `;

  await _send({
    to: toEmail,
    subject: `Support replied to your ticket #${ticketNumber}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Support replied to your ticket #${ticketNumber}:`,
      '',
      preview,
      '',
      `Log in to Diakite to view the full conversation and respond if needed.`,
    ].join('\n'),
  });
};

/** Sent when a support ticket is marked resolved. */
exports.sendTicketResolvedEmail = async (toEmail, firstName, { ticketNumber, resolution = '' }) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const body = `
    ${pill('TICKET RESOLVED', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      Ticket #${ticketNumber} has been resolved ✅
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your support ticket has been marked as resolved.
    </p>
    ${resolution ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">RESOLUTION</p>
        <p style="margin:0;font-size:14px;color:#222;line-height:1.6;">${resolution}</p>
      </td></tr>
    </table>` : ''}
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 22px;">
      If this didn't fully solve your issue, just reopen the ticket or contact us again — we're happy to help further.
    </p>
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      View ticket #${ticketNumber}
    </a>
  `;

  await _send({
    to: toEmail,
    subject: `Your ticket #${ticketNumber} has been resolved`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your support ticket #${ticketNumber} has been marked as resolved.`,
      resolution ? `\nResolution: ${resolution}` : '',
      '',
      `If this didn't fully solve your issue, reopen the ticket or contact us again.`,
    ].filter(Boolean).join('\n'),
  });
};

/** Sent the moment a driver/partner submits a withdrawal request. */
exports.sendWithdrawalUnderReviewEmail = async (toEmail, firstName, { amount, reference, accountName, accountNumber }) => {
  const body = `
    ${pill('WITHDRAWAL UNDER REVIEW', '#fff4e5', '#92400e')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      We've received your withdrawal request
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your request to withdraw funds is now with our team for review.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:14px;margin-bottom:18px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">AMOUNT REQUESTED</p>
        <p style="margin:0 0 12px;font-size:28px;font-weight:900;color:#111;">${ngn(amount)}</p>
        ${accountName ? `<p style="margin:0 0 2px;font-size:13px;color:#555;"><strong>To:</strong> ${accountName}${accountNumber ? ` — ${mask(accountNumber, 4)}` : ''}</p>` : ''}
        ${reference ? `<p style="margin:0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
      </td></tr>
    </table>
    <p style="color:#555;font-size:13px;line-height:1.7;margin:0;">
      We typically process withdrawals within <strong>1–2 business days</strong>. You'll get another
      email as soon as it's approved and on its way to your bank.
    </p>
  `;

  await _send({
    to: toEmail,
    subject: `Withdrawal request received — ${ngn(amount)}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `We've received your withdrawal request of ${ngn(amount)}.`,
      accountName ? `Destination: ${accountName}` : '',
      reference ? `Reference: ${reference}` : '',
      '',
      `This is typically processed within 1-2 business days. We'll email you once it's approved.`,
    ].filter(Boolean).join('\n'),
  });
};

/** Sent when an admin approves a withdrawal and payment is being sent to the bank. */
exports.sendWithdrawalApprovedEmail = async (toEmail, firstName, { amount, reference, accountName, accountNumber, bankName }) => {
  const body = `
    ${pill('WITHDRAWAL APPROVED', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      Your withdrawal is on its way 💸
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your withdrawal has been approved and payment is now being processed to your bank account.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:14px;margin-bottom:18px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">AMOUNT</p>
        <p style="margin:0 0 12px;font-size:28px;font-weight:900;color:#111;">${ngn(amount)}</p>
        <p style="margin:0 0 2px;font-size:13px;color:#555;"><strong>To:</strong> ${accountName || 'your bank account'}${bankName ? ` (${bankName})` : ''}</p>
        ${accountNumber ? `<p style="margin:0 0 2px;font-size:13px;color:#555;"><strong>Account:</strong> ${mask(accountNumber, 4)}</p>` : ''}
        ${reference ? `<p style="margin:8px 0 0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
      </td></tr>
    </table>
    <p style="color:#555;font-size:13px;line-height:1.7;margin:0;">
      Funds usually reflect in your account within a few hours, depending on your bank. Reach out to
      support if it hasn't arrived after 24 hours.
    </p>
  `;

  await _send({
    to: toEmail,
    subject: `Withdrawal approved — ${ngn(amount)} is on its way`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your withdrawal of ${ngn(amount)} has been approved and is being processed to your bank account.`,
      accountName ? `To: ${accountName}${bankName ? ` (${bankName})` : ''}` : '',
      accountNumber ? `Account: ${mask(accountNumber, 4)}` : '',
      reference ? `Reference: ${reference}` : '',
      '',
      `Funds usually arrive within a few hours. Contact support if it hasn't landed after 24 hours.`,
    ].filter(Boolean).join('\n'),
  });
};

/** Sent when an admin declines a withdrawal request. */
exports.sendWithdrawalRejectedEmail = async (toEmail, firstName, { amount, reference, reason }) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const body = `
    ${pill('WITHDRAWAL DECLINED', '#fdecec', '#b3261e')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      We couldn't process your withdrawal
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your withdrawal request of <strong>${ngn(amount)}</strong> was not approved.
      The funds remain safely in your wallet.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">REASON</p>
        <p style="margin:0;font-size:14px;color:#222;line-height:1.6;">${reason || 'Unable to verify bank details'}</p>
        ${reference ? `<p style="margin:8px 0 0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
      </td></tr>
    </table>
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      Try again
    </a>
  `;

  await _send({
    to: toEmail,
    subject: `Withdrawal request declined — ${ngn(amount)}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your withdrawal request of ${ngn(amount)} was not approved. The funds remain in your wallet.`,
      `Reason: ${reason || 'Unable to verify bank details'}`,
      reference ? `Reference: ${reference}` : '',
      '',
      `You're welcome to correct the issue and submit a new withdrawal request.`,
    ].filter(Boolean).join('\n'),
  });
};

/** Sent when an admin manually credits or debits a user's wallet. */
exports.sendWalletAdjustmentEmail = async (toEmail, firstName, { amount, type, reason = '' }) => {
  const isCredit = type === 'credit';
  const body = `
    ${isCredit ? pill('WALLET CREDITED', '#e8f8ee', '#0f7a3d') : pill('WALLET DEBITED', '#fdecec', '#b3261e')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      ${isCredit ? 'Your wallet has been credited' : 'Your wallet has been debited'}
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, our team has ${isCredit ? 'added funds to' : 'deducted funds from'} your Diakite wallet.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:14px;margin-bottom:18px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">${isCredit ? 'AMOUNT CREDITED' : 'AMOUNT DEBITED'}</p>
        <p style="margin:0 0 10px;font-size:28px;font-weight:900;color:#111;">${ngn(amount)}</p>
        ${reason ? `<p style="margin:0;font-size:13px;color:#555;line-height:1.6;">${reason}</p>` : ''}
      </td></tr>
    </table>
    <p style="color:#555;font-size:13px;line-height:1.7;margin:0;">
      You can review your full transaction history any time in the app.
    </p>
  `;

  await _send({
    to: toEmail,
    subject: `${isCredit ? 'Credit' : 'Debit'} of ${ngn(amount)} on your Diakite wallet`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your Diakite wallet has been ${isCredit ? 'credited' : 'debited'} ${ngn(amount)}.`,
      reason ? `Reason: ${reason}` : '',
    ].filter(Boolean).join('\n'),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Transaction history statement (moved out of wallet.controller.js so
// all HTML/email templates live in one place)
// ─────────────────────────────────────────────────────────────────────────────

exports.sendTransactionHistoryStatement = async (toEmail, { transactions = [], fromDate, toDate, type = 'ALL' } = {}) => {
  const fmt     = (n) => Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  const totalIn  = transactions.filter(t => t.type === 'CREDIT' || t.type === 'REFUND').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter(t => t.type !== 'CREDIT' && t.type !== 'REFUND').reduce((s, t) => s + Number(t.amount), 0);

  const TX_COLORS = { CREDIT: '#5DAA72', DEBIT: '#E05555', WITHDRAWAL: '#FFB800', REFUND: '#A78BFA' };
  const TX_SIGN   = { CREDIT: '+', DEBIT: '-', WITHDRAWAL: '-', REFUND: '+' };

  const rows = transactions.map(t => `
    <tr>
      <td>${fmtDate(t.createdAt)}</td>
      <td>${t.description || t.type}</td>
      <td style="color:${TX_COLORS[t.type] ?? '#333'};font-weight:700">
        ${TX_SIGN[t.type] ?? ''}₦${fmt(t.amount)}
      </td>
      <td>${t.type}</td>
      <td style="color:${t.status === 'COMPLETED' ? '#5DAA72' : '#FFB800'}">${t.status}</td>
      <td style="font-size:10px;color:#888">${t.reference ?? '—'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body  { font-family: Arial, sans-serif; color: #111; padding: 32px; }
  h1    { font-size: 22px; margin-bottom: 4px; }
  .sub  { color: #666; font-size: 12px; margin-bottom: 24px; }
  .summary { display: flex; gap: 24px; margin-bottom: 24px; }
  .sum-box { background: #f5f5f5; border-radius: 10px; padding: 14px 20px; min-width: 130px; }
  .sum-lbl { font-size: 10px; color: #888; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 4px; }
  .sum-val { font-size: 18px; font-weight: 900; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th    { background: #111; color: #fff; padding: 10px 8px; text-align: left; font-size: 10px; letter-spacing: 1px; }
  td    { padding: 10px 8px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #fafafa; }
  .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; }
</style></head>
<body>
<h1>Transaction History</h1>
<div class="sub">
  ${fmtDate(fromDate)} – ${fmtDate(toDate)}
  ${type && type !== 'ALL' ? ` &nbsp;•&nbsp; Type: ${type}` : ''}
  &nbsp;•&nbsp; ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}
  &nbsp;•&nbsp; ${toEmail}
</div>
<div class="summary">
  <div class="sum-box">
    <div class="sum-lbl">TOTAL IN</div>
    <div class="sum-val" style="color:#5DAA72">+₦${fmt(totalIn)}</div>
  </div>
  <div class="sum-box">
    <div class="sum-lbl">TOTAL OUT</div>
    <div class="sum-val" style="color:#E05555">-₦${fmt(totalOut)}</div>
  </div>
  <div class="sum-box">
    <div class="sum-lbl">NET</div>
    <div class="sum-val">₦${fmt(totalIn - totalOut)}</div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>DATE</th><th>DESCRIPTION</th><th>AMOUNT</th>
      <th>TYPE</th><th>STATUS</th><th>REFERENCE</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:32px">No transactions found</td></tr>'}
  </tbody>
</table>
<div class="footer">
  Generated ${new Date().toLocaleString('en-NG')} &nbsp;•&nbsp; Confidential — Do not distribute
</div>
</body></html>`;

  await _send({
    to: toEmail,
    subject: `Your Transaction History — ${fmtDate(fromDate)} to ${fmtDate(toDate)}`,
    html,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Peer-to-peer transfer notifications (pending / approved / received / rejected)
// ─────────────────────────────────────────────────────────────────────────────

/** Sent to the SENDER the moment they submit a transfer, before admin review. */
exports.sendTransferPendingEmail = async (toEmail, firstName, { amount, recipientName, reference, note = '' }) => {
  const body = `
    ${pill('TRANSFER PENDING', '#fff4e5', '#92400e')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      Your transfer is awaiting approval
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your transfer to <strong>${recipientName}</strong> has been submitted and is now
      pending admin review. The funds have already been held from your wallet balance.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:14px;margin-bottom:18px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">AMOUNT</p>
        <p style="margin:0 0 12px;font-size:28px;font-weight:900;color:#111;">${ngn(amount)}</p>
        <p style="margin:0 0 2px;font-size:13px;color:#555;"><strong>To:</strong> ${recipientName}</p>
        ${note ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">Note: ${note}</p>` : ''}
        ${reference ? `<p style="margin:8px 0 0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
      </td></tr>
    </table>
    <p style="color:#555;font-size:13px;line-height:1.7;margin:0;">
      You'll get another email as soon as this is approved and credited to the recipient.
    </p>
  `;

  await _send({
    to: toEmail,
    subject: `Transfer pending — ${ngn(amount)} to ${recipientName}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your transfer of ${ngn(amount)} to ${recipientName} is pending admin approval.`,
      `The funds have been held from your wallet balance.`,
      reference ? `Reference: ${reference}` : '',
    ].filter(Boolean).join('\n'),
  });
};

/** Sent to the SENDER once admin approves the transfer. */
exports.sendTransferApprovedEmail = async (toEmail, firstName, { amount, recipientName, reference, note = '' }) => {
  const body = `
    ${pill('TRANSFER APPROVED', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      Your transfer has been approved ✅
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your transfer of <strong>${ngn(amount)}</strong> to <strong>${recipientName}</strong>
      has been approved and the recipient has been credited.
    </p>
    ${note ? `<p style="color:#666;font-size:13px;line-height:1.6;margin:0 0 16px;"><strong>Note from our team:</strong> ${note}</p>` : ''}
    ${reference ? `<p style="margin:0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
  `;

  await _send({
    to: toEmail,
    subject: `Transfer approved — ${ngn(amount)} sent to ${recipientName}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your transfer of ${ngn(amount)} to ${recipientName} has been approved and the recipient has been credited.`,
      note ? `\nNote from our team: ${note}` : '',
      reference ? `Reference: ${reference}` : '',
    ].filter(Boolean).join('\n'),
  });
};

/** Sent to the RECIPIENT once a transfer is approved and their wallet is credited. */
exports.sendMoneyReceivedEmail = async (toEmail, firstName, { amount, senderName, reference, note = '' }) => {
  const appUrl = process.env.APP_URL ?? 'https://diakite.onrender.com';
  const body = `
    ${pill('MONEY RECEIVED', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      ${ngn(amount)} added to your wallet 💰
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, <strong>${senderName}</strong> just sent you money on Diakite.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:14px;margin-bottom:18px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">AMOUNT RECEIVED</p>
        <p style="margin:0 0 10px;font-size:28px;font-weight:900;color:#111;">${ngn(amount)}</p>
        <p style="margin:0;font-size:13px;color:#555;"><strong>From:</strong> ${senderName}</p>
        ${note ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">Note: ${note}</p>` : ''}
        ${reference ? `<p style="margin:8px 0 0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
      </td></tr>
    </table>
    <a href="${appUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
       padding:14px 30px;border-radius:11px;font-weight:800;font-size:14px;">
      View my wallet
    </a>
  `;

  await _send({
    to: toEmail,
    subject: `${ngn(amount)} received from ${senderName}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `${senderName} sent you ${ngn(amount)} on Diakite. It's already in your wallet.`,
      note ? `Note: ${note}` : '',
      reference ? `Reference: ${reference}` : '',
    ].filter(Boolean).join('\n'),
  });
};

/** Sent to the SENDER when admin rejects the transfer and refunds their wallet. */
exports.sendTransferRejectedEmail = async (toEmail, firstName, { amount, recipientName, reference, reason }) => {
  const body = `
    ${pill('TRANSFER DECLINED', '#fdecec', '#b3261e')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      We couldn't process your transfer
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your transfer of <strong>${ngn(amount)}</strong> to <strong>${recipientName}</strong>
      was not approved. The funds have been returned to your wallet.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:12px;margin-bottom:20px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">REASON</p>
        <p style="margin:0;font-size:14px;color:#222;line-height:1.6;">${reason || 'Unable to verify transfer details'}</p>
        ${reference ? `<p style="margin:8px 0 0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
      </td></tr>
    </table>
  `;

  await _send({
    to: toEmail,
    subject: `Transfer declined — ${ngn(amount)}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your transfer of ${ngn(amount)} to ${recipientName} was not approved. Funds have been returned to your wallet.`,
      `Reason: ${reason || 'Unable to verify transfer details'}`,
      reference ? `Reference: ${reference}` : '',
    ].filter(Boolean).join('\n'),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW — Payment / earnings / refund notifications (for payment.controller.js)
// ─────────────────────────────────────────────────────────────────────────────

const METHOD_LABELS = { CARD: 'card', WALLET: 'wallet balance', CASH: 'cash' };

/** Sent to the PAYER when a ride/delivery payment completes successfully. */
exports.sendPaymentReceiptEmail = async (toEmail, firstName, { amount, method, reference, service }) => {
  const methodLabel = METHOD_LABELS[method] ?? method;
  const serviceLabel = service === 'ride' ? 'ride' : service === 'delivery' ? 'delivery' : 'trip';
  const body = `
    ${pill('PAYMENT SUCCESSFUL', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      Payment successful ✅
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your payment for your ${serviceLabel} was successful.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:14px;margin-bottom:18px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">AMOUNT PAID</p>
        <p style="margin:0 0 10px;font-size:28px;font-weight:900;color:#111;">${ngn(amount)}</p>
        <p style="margin:0;font-size:13px;color:#555;">Paid via ${methodLabel}</p>
        ${reference ? `<p style="margin:8px 0 0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
      </td></tr>
    </table>
  `;

  await _send({
    to: toEmail,
    subject: `Payment receipt — ${ngn(amount)}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your payment of ${ngn(amount)} for your ${serviceLabel} (via ${methodLabel}) was successful.`,
      reference ? `Reference: ${reference}` : '',
    ].filter(Boolean).join('\n'),
  });
};

/** Sent to the DRIVER/PARTNER when they're credited earnings from a completed ride/delivery. */
exports.sendEarningsCreditedEmail = async (toEmail, firstName, { amount, platformFee, reference, service }) => {
  const serviceLabel = service === 'ride' ? 'ride' : service === 'delivery' ? 'delivery' : 'trip';
  const body = `
    ${pill('EARNINGS CREDITED', '#e8f8ee', '#0f7a3d')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      ${ngn(amount)} added to your wallet 💰
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, you've been credited your earnings from a completed ${serviceLabel}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:14px;margin-bottom:18px;">
      <tr><td style="padding:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#888;letter-spacing:0.3px;">EARNINGS CREDITED</p>
        <p style="margin:0 0 10px;font-size:28px;font-weight:900;color:#111;">${ngn(amount)}</p>
        ${platformFee ? `<p style="margin:0;font-size:12px;color:#999;">After ${ngn(platformFee)} platform fee</p>` : ''}
        ${reference ? `<p style="margin:8px 0 0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
      </td></tr>
    </table>
  `;

  await _send({
    to: toEmail,
    subject: `${ngn(amount)} earnings credited to your Diakite wallet`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `You've been credited ${ngn(amount)} in earnings from a completed ${serviceLabel}.`,
      platformFee ? `(After ${ngn(platformFee)} platform fee.)` : '',
      reference ? `Reference: ${reference}` : '',
    ].filter(Boolean).join('\n'),
  });
};

/** Sent when a payment refund is processed (wallet credit or card refund). */
exports.sendRefundProcessedEmail = async (toEmail, firstName, { amount, method, reference }) => {
  const destination = method === 'WALLET' ? 'your Diakite wallet' : 'your original payment method';
  const body = `
    ${pill('REFUND PROCESSED', '#e8f0fe', '#1a56db')}
    <h2 style="font-size:22px;font-weight:900;margin:0 0 10px;color:#111;">
      Your refund has been processed ✅
    </h2>
    <p style="color:#555;line-height:1.7;font-size:14px;margin:0 0 16px;">
      Hi ${firstName}, your refund of <strong>${ngn(amount)}</strong> has been sent to ${destination}.
      ${method !== 'WALLET' ? 'Card refunds can take 3–5 business days to reflect.' : ''}
    </p>
    ${reference ? `<p style="margin:0;font-size:12px;color:#999;">Reference: ${reference}</p>` : ''}
  `;

  await _send({
    to: toEmail,
    subject: `Refund processed — ${ngn(amount)}`,
    html: wrap(body),
    text: [
      `Hi ${firstName},`,
      '',
      `Your refund of ${ngn(amount)} has been sent to ${destination}.`,
      method !== 'WALLET' ? 'Card refunds can take 3-5 business days to reflect.' : '',
      reference ? `Reference: ${reference}` : '',
    ].filter(Boolean).join('\n'),
  });
};

module.exports = exports;