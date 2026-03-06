// backend/src/services/payment.service.js
// Supports Paystack (primary) and Flutterwave (fallback)
// Install: npm install axios

const axios = require('axios');
const { AppError } = require('../middleware/errorHandler');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;

const paystackAPI = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET}`,
    'Content-Type': 'application/json'
  }
});

const flutterwaveAPI = axios.create({
  baseURL: 'https://api.flutterwave.com/v3',
  headers: {
    Authorization: `Bearer ${FLUTTERWAVE_SECRET}`,
    'Content-Type': 'application/json'
  }
});

// ─────────────────────────────────────────────
// PAYSTACK
// ─────────────────────────────────────────────

/**
 * Initialize a Paystack transaction
 * Returns { authorization_url, access_code, reference }
 */
exports.paystackInitialize = async ({ email, amount, metadata = {}, callbackUrl }) => {
  try {
    const { data } = await paystackAPI.post('/transaction/initialize', {
      email,
      amount: Math.round(amount * 100), // Paystack uses kobo (1 NGN = 100 kobo)
      currency: 'NGN',
      callback_url: callbackUrl || process.env.PAYSTACK_CALLBACK_URL,
      metadata
    });

    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // { authorization_url, access_code, reference }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Paystack initialization failed: ' + error.message, 500);
  }
};

/**
 * Verify a Paystack transaction by reference
 * Returns full transaction object
 */
exports.paystackVerify = async (reference) => {
  try {
    const { data } = await paystackAPI.get(`/transaction/verify/${reference}`);

    if (!data.status) throw new AppError(data.message, 400);
    if (data.data.status !== 'success') {
      throw new AppError(`Payment not successful. Status: ${data.data.status}`, 400);
    }

    return data.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Paystack verification failed: ' + error.message, 500);
  }
};

/**
 * Create a Paystack refund
 */
exports.paystackRefund = async (transactionReference, amount) => {
  try {
    const body = { transaction: transactionReference };
    if (amount) body.amount = Math.round(amount * 100);

    const { data } = await paystackAPI.post('/refund', body);

    if (!data.status) throw new AppError(data.message, 400);
    return data.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Paystack refund failed: ' + error.message, 500);
  }
};

/**
 * Create a Paystack transfer recipient (for driver payouts)
 */
exports.paystackCreateRecipient = async ({ name, accountNumber, bankCode }) => {
  try {
    const { data } = await paystackAPI.post('/transferrecipient', {
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN'
    });

    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // { recipient_code, ... }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create transfer recipient: ' + error.message, 500);
  }
};

/**
 * Send a Paystack transfer (driver payout)
 */
exports.paystackTransfer = async ({ amount, recipientCode, reason, metadata = {} }) => {
  try {
    const { data } = await paystackAPI.post('/transfer', {
      source: 'balance',
      amount: Math.round(amount * 100),
      recipient: recipientCode,
      reason,
      metadata
    });

    if (!data.status) throw new AppError(data.message, 400);
    return data.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Paystack transfer failed: ' + error.message, 500);
  }
};

/**
 * List Nigerian banks (for payout setup)
 */
exports.paystackListBanks = async () => {
  try {
    const { data } = await paystackAPI.get('/bank?currency=NGN&country=nigeria');
    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // Array of { name, code, ... }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch banks: ' + error.message, 500);
  }
};

/**
 * Verify a Nigerian bank account number
 */
exports.paystackVerifyAccount = async (accountNumber, bankCode) => {
  try {
    const { data } = await paystackAPI.get(
      `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
    );
    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // { account_name, account_number }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Account verification failed: ' + error.message, 500);
  }
};

// ─────────────────────────────────────────────
// FLUTTERWAVE (fallback / alternative)
// ─────────────────────────────────────────────

/**
 * Initialize a Flutterwave payment
 * Returns { payment_link } — redirect user to this URL
 */
exports.flutterwaveInitialize = async ({
  email,
  phone,
  name,
  amount,
  txRef,
  metadata = {},
  redirectUrl
}) => {
  try {
    const { data } = await flutterwaveAPI.post('/payments', {
      tx_ref: txRef || `FLW-${Date.now()}`,
      amount,
      currency: 'NGN',
      redirect_url: redirectUrl || process.env.FLUTTERWAVE_REDIRECT_URL,
      customer: { email, phone_number: phone, name },
      customizations: {
        title: 'Ride & Delivery Payment',
        logo: process.env.APP_LOGO_URL
      },
      meta: metadata
    });

    if (data.status !== 'success') throw new AppError(data.message, 400);
    return data.data; // { link }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Flutterwave initialization failed: ' + error.message, 500);
  }
};

/**
 * Verify a Flutterwave transaction by ID
 */
exports.flutterwaveVerify = async (transactionId) => {
  try {
    const { data } = await flutterwaveAPI.get(`/transactions/${transactionId}/verify`);

    if (data.status !== 'success') throw new AppError(data.message, 400);
    if (data.data.status !== 'successful') {
      throw new AppError(`Payment not successful. Status: ${data.data.status}`, 400);
    }

    return data.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Flutterwave verification failed: ' + error.message, 500);
  }
};

/**
 * Flutterwave transfer (driver payout)
 */
exports.flutterwaveTransfer = async ({
  amount,
  accountNumber,
  bankCode,
  accountName,
  narration,
  reference,
  metadata = {}
}) => {
  try {
    const { data } = await flutterwaveAPI.post('/transfers', {
      account_bank: bankCode,
      account_number: accountNumber,
      amount,
      narration,
      currency: 'NGN',
      reference: reference || `PAYOUT-${Date.now()}`,
      beneficiary_name: accountName,
      meta: [metadata]
    });

    if (data.status !== 'success') throw new AppError(data.message, 400);
    return data.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Flutterwave transfer failed: ' + error.message, 500);
  }
};

/**
 * Validate Flutterwave webhook signature
 */
exports.validateFlutterwaveWebhook = (signature) => {
  return signature === process.env.FLUTTERWAVE_WEBHOOK_HASH;
};

/**
 * Validate Paystack webhook signature
 */
exports.validatePaystackWebhook = (signature, rawBody) => {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
};

module.exports = exports;