// test-email.js — run with: node scripts/test-email.js
// Usage: node scripts/test-email.js [recipient@email.com]
//
// This script reads your ACTUAL .env config (not hardcoded values), so it
// tests exactly what your app will do in production. It verifies the SMTP
// connection first, then sends a real message, and explains failures.

require('dotenv').config();
const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

const recipient = process.argv[2] || 'doublegee4all@gmail.com';

function printConfig() {
  console.log('--- SMTP config loaded from .env ---');
  console.log('SMTP_HOST  :', SMTP_HOST);
  console.log('SMTP_PORT  :', SMTP_PORT);
  console.log('SMTP_SECURE:', SMTP_SECURE);
  console.log('SMTP_USER  :', SMTP_USER);
  console.log('SMTP_PASS  :', SMTP_PASS ? `${SMTP_PASS.slice(0, 6)}... (${SMTP_PASS.length} chars)` : '(missing!)');
  console.log('SMTP_FROM  :', SMTP_FROM);
  console.log('-------------------------------------\n');
}

function sanityCheckConfig() {
  const problems = [];

  if (!SMTP_HOST) problems.push('SMTP_HOST is not set.');
  if (!SMTP_USER) problems.push('SMTP_USER is not set.');
  if (!SMTP_PASS) problems.push('SMTP_PASS is not set.');
  if (!SMTP_FROM) problems.push('SMTP_FROM is not set.');

  const port = parseInt(SMTP_PORT, 10);
  const secure = SMTP_SECURE === 'true';

  if (port === 465 && !secure) {
    problems.push(
      'Mismatch: SMTP_PORT=465 requires SMTP_SECURE=true (implicit TLS). ' +
      'Your .env currently has SMTP_SECURE=false, which will cause Brevo to drop the connection ' +
      '("Unexpected socket close"). Fix: set SMTP_SECURE=true, OR switch to SMTP_PORT=587 with SMTP_SECURE=false.'
    );
  }
  if (port === 587 && secure) {
    problems.push(
      'Mismatch: SMTP_PORT=587 uses STARTTLS, so SMTP_SECURE should be false, not true. ' +
      'Fix: set SMTP_SECURE=false, OR switch to SMTP_PORT=465 with SMTP_SECURE=true.'
    );
  }

  if (problems.length) {
    console.log('⚠️  Config issues detected:\n');
    problems.forEach((p, i) => console.log(`${i + 1}. ${p}`));
    console.log('');
  }

  return { port, secure };
}

async function main() {
  printConfig();
  const { port, secure } = sanityCheckConfig();

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure, // derived from SMTP_SECURE env var, not hardcoded
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    logger: true,   // prints SMTP protocol exchange
    debug: true,    // verbose connection debug info
  });

  console.log('\nStep 1: Verifying connection to SMTP server...\n');
  try {
    await transporter.verify();
    console.log('\n✅ Connection verified — Brevo accepted the credentials and TLS handshake.\n');
  } catch (err) {
    console.error('\n❌ Connection verify failed.');
    explainError(err, port, secure);
    process.exit(1);
  }

  console.log(`Step 2: Sending test email to ${recipient}...\n`);
  try {
    const info = await transporter.sendMail({
      from: SMTF_FROM_FALLBACK(),
      to: recipient,
      subject: 'Brevo SMTP Test',
      text: 'If you see this, SMTP is working!',
    });
    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response  :', info.response);
  } catch (err) {
    console.error('❌ Send failed.');
    explainError(err, port, secure);
    process.exit(1);
  }
}

function SMTF_FROM_FALLBACK() {
  return SMTP_FROM;
}

function explainError(err, port, secure) {
  console.error('   Message:', err.message);
  if (err.code) console.error('   Code   :', err.code);
  if (err.command) console.error('   Command:', err.command);
  if (err.responseCode) console.error('   SMTP response code:', err.responseCode);

  console.error('\n--- Likely cause & fix ---');

  if (/unexpected socket close/i.test(err.message)) {
    console.error(
      port === 465 && !secure
        ? 'Port/TLS mismatch: 465 needs secure:true. Set SMTP_SECURE=true in .env.'
        : port === 587 && secure
        ? 'Port/TLS mismatch: 587 needs secure:false. Set SMTP_SECURE=false in .env.'
        : 'Connection was dropped mid-handshake. Check firewall/network egress on this machine ' +
          'allows outbound traffic on the SMTP port, and confirm host/port are correct for Brevo.'
    );
  } else if (err.responseCode === 535 || /invalid login|auth/i.test(err.message)) {
    console.error(
      'Authentication failed. Re-check SMTP_USER and SMTP_PASS — for Brevo these are the SMTP login ' +
      'and SMTP key shown in Brevo > SMTP & API > SMTP, NOT your Brevo account email/password.'
    );
  } else if (/ETIMEDOUT|ECONNREFUSED/i.test(err.code || '')) {
    console.error(
      'Could not reach the SMTP host at all. Check SMTP_HOST is spelled correctly, and that outbound ' +
      'traffic on this port is not blocked (some hosting platforms block 465/587 by default).'
    );
  } else {
    console.error('Unrecognized error — see message/code above for details.');
  }
  console.error('--------------------------\n');
}

main();