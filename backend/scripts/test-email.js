// test-email.js — run with: node test-email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: 'doublegee4all@gmail.com',
  subject: 'Brevo SMTP Test',
  text: 'If you see this, SMTP is working!',
}).then(() => console.log('✅ Email sent successfully!'))
  .catch((err) => console.error('❌ Failed:', err.message));