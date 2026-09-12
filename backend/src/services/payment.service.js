// backend/src/services/payment.service.js

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

exports.paystackInitialize = async ({ email, amount, metadata = {}, callbackUrl, reference, currency = 'NGN' }) => {
  try {
    const { data } = await paystackAPI.post('/transaction/initialize', {
      email,
      amount: Math.round(amount * 100), // Paystack uses subunits (kobo for NGN, pesewas for GHS, etc — all 100 per unit)
      currency,
      callback_url: callbackUrl || process.env.PAYSTACK_CALLBACK_URL,
      metadata,
      ...(reference && { reference }),
    });

    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // { authorization_url, access_code, reference }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Paystack initialization failed: ' + error.message, 500);
  }
};

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
    // Surface Paystack's actual error message instead of Axios's generic one,
    // and treat API-level rejections (4xx from Paystack) as 400, not 500.
    const paystackMsg = error?.response?.data?.message || error.message;
    const status = error?.response?.status && error.response.status < 500 ? 400 : 502;
    throw new AppError('Paystack verification failed: ' + paystackMsg, status);
  }
};

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

// NOTE: kept for backward compatibility with any existing call sites, but
// prefer paystackCreateTransferRecipient below (it accepts `currency` and
// is the one initiatePayoutTransfer uses).
exports.paystackCreateRecipient = async ({ name, accountNumber, bankCode, currency = 'NGN' }) => {
  try {
    const { data } = await paystackAPI.post('/transferrecipient', {
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency
    });

    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // { recipient_code, ... }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create transfer recipient: ' + error.message, 500);
  }
};

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

// Paystack's ?country= param wants the full country name and is only valid
// for markets Paystack actually operates in (NG, GH, ZA, KE, RW, CI as of
// 2026). Defaults preserve the original NG-only behavior.
exports.paystackListBanks = async (currency = 'NGN', countryName = 'nigeria') => {
  try {
    const { data } = await paystackAPI.get(`/bank?currency=${currency}&country=${countryName}`);
    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // Array of { name, code, ... }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch banks: ' + error.message, 500);
  }
};

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

exports.flutterwaveVerifyAccount = async (accountNumber, bankCode) => {
  try {
    const { data } = await flutterwaveAPI.post('/accounts/resolve', {
      account_number: accountNumber,
      account_bank:   bankCode,
    });
    if (data.status !== 'success') throw new AppError(data.message, 400);
    return {
      account_name:   data.data.account_name,
      account_number: data.data.account_number,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Account verification failed (Flutterwave): ' + error.message, 500);
  }
};

exports.flutterwaveVerifyByReference = async (txRef) => {
  try {
    const { data } = await flutterwaveAPI.get('/transactions/verify_by_reference', {
      params: { tx_ref: txRef },
    });
    if (data.status !== 'success') throw new AppError(data.message, 400);
    if (data.data.status !== 'successful') {
      throw new AppError(`Payment not successful. Status: ${data.data.status}`, 400);
    }
    return data.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const flwMsg = error?.response?.data?.message || error.message;
    const status = error?.response?.status && error.response.status < 500 ? 400 : 502;
    throw new AppError('Flutterwave verification failed: ' + flwMsg, status);
  }
};

exports.paystackCreateTransferRecipient = async ({ name, accountNumber, bankCode, currency = 'NGN' }) => {
  try {
    const { data } = await paystackAPI.post('/transferrecipient', {
      type:           'nuban',
      name,
      account_number: accountNumber,
      bank_code:      bankCode,
      currency,
    });
    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // { recipient_code, ... }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create transfer recipient: ' + error.message, 500);
  }
};

exports.paystackInitiateTransfer = async ({ amount, recipient, reason, reference }) => {
  try {
    const { data } = await paystackAPI.post('/transfer', {
      source:    'balance',
      amount,               // kobo (or subunit for the recipient's currency)
      recipient,            // recipient_code from paystackCreateTransferRecipient
      reason:    reason ?? 'Wallet withdrawal',
      reference: reference ?? `WD-${Date.now()}`,
    });
    if (!data.status) throw new AppError(data.message, 400);
    return data.data; // { transfer_code, status, ... }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Paystack transfer initiation failed: ' + error.message, 500);
  }
};

exports.paystackVerifyTransaction = async (reference) => {
  return exports.paystackVerify(reference);
};

// ─────────────────────────────────────────────
// FLUTTERWAVE (fallback / alternative)
// ─────────────────────────────────────────────

exports.flutterwaveInitialize = async ({
  email, phone, name, amount, txRef, metadata = {}, redirectUrl, currency = 'NGN'
}) => {
  try {
    const redirect = redirectUrl
      || process.env.FLUTTERWAVE_REDIRECT_URL
      || 'https://webhook.site/your-test-uuid';   // ← dev fallback

    const { data } = await flutterwaveAPI.post('/payments', {
      tx_ref:       txRef || `FLW-${Date.now()}`,
      amount,
      currency,
      redirect_url: redirect,
      customer: {
        email,
        phonenumber: phone || '',   // ← FLW field is 'phonenumber' not 'phone_number'
        name,
      },
      customizations: {
        title: 'Ride & Delivery Payment',
        logo:  process.env.APP_LOGO_URL || '',
      },
      meta: metadata,
    });

    if (data.status !== 'success') throw new AppError(data.message, 400);
    return data.data;
  } catch (error) {
    // Surface the actual FLW error message instead of swallowing it
    const flwMsg = error?.response?.data?.message || error.message;
    console.error('[FLW] flutterwaveInitialize error:', flwMsg, error?.response?.data);
    if (error instanceof AppError) throw error;
    throw new AppError('Flutterwave initialization failed: ' + flwMsg, 500);
  }
};

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
    const flwMsg = error?.response?.data?.message || error.message;
    const status = error?.response?.status && error.response.status < 500 ? 400 : 502;
    throw new AppError('Flutterwave verification failed: ' + flwMsg, status);
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
  currency = 'NGN',
  metadata = {}
}) => {
  try {
    const { data } = await flutterwaveAPI.post('/transfers', {
      account_bank: bankCode,
      account_number: accountNumber,
      amount,
      narration,
      currency,
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

// countryCode is an ISO alpha-2 (e.g. 'NG', 'GH', 'CI'), matching Country.code.
exports.flutterwaveListBanks = async (countryCode = 'NG') => {
  try {
    const { data } = await flutterwaveAPI.get(`/banks/${countryCode}`);
    if (data.status !== 'success') throw new AppError(data.message, 400);
    return data.data; // Array of { id, code, name }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch banks (Flutterwave): ' + error.message, 500);
  }
};

// ─────────────────────────────────────────────
// PROVIDER SELECTION + UNIFIED HELPERS
// ─────────────────────────────────────────────

const getActivePayoutProvider = () => {
  const explicit = (process.env.PAYOUT_PROVIDER || '').toLowerCase();
  if (explicit === 'paystack' || explicit === 'flutterwave') return explicit;
  if (PAYSTACK_SECRET)    return 'paystack';
  if (FLUTTERWAVE_SECRET) return 'flutterwave';
  return 'paystack';
};
exports.getActivePayoutProvider = getActivePayoutProvider;

// Paystack only operates in a handful of markets and expects the full
// country name (not ISO code) plus its own currency code on /bank.
const PAYSTACK_COUNTRY_NAME = { NG: 'nigeria', GH: 'ghana', CI: "cote d'ivoire" };
const PAYSTACK_CURRENCY     = { NG: 'NGN', GH: 'GHS', CI: 'XOF' };

const _bankListCache = {};
const BANK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Cache key now includes country — otherwise Ghana and Nigeria bank lists
// would overwrite each other under a single `provider`-only key.
const _getCachedBankList = async (provider, countryCode = 'NG') => {
  const cacheKey = `${provider}:${countryCode}`;
  const now = Date.now();
  const cached = _bankListCache[cacheKey];
  if (cached && (now - cached.cachedAt) < BANK_CACHE_TTL_MS) return cached.list;

  const list = provider === 'flutterwave'
    ? await exports.flutterwaveListBanks(countryCode)
    : await exports.paystackListBanks(
        PAYSTACK_CURRENCY[countryCode] ?? 'NGN',
        PAYSTACK_COUNTRY_NAME[countryCode] ?? 'nigeria'
      );

  _bankListCache[cacheKey] = { list, cachedAt: now };
  return list;
};

exports.resolveBankName = async (bankCode, countryCode = 'NG', provider = getActivePayoutProvider()) => {
  if (!bankCode) return null;
  try {
    const banks = await _getCachedBankList(provider, countryCode);
    const match = banks.find(b => String(b.code) === String(bankCode));
    return match?.name ?? null;
  } catch (err) {
    console.error(`[payment.service] resolveBankName (${provider}, ${countryCode}) failed:`, err.message);
    return null;
  }
};

// NOTE: Paystack's /bank/resolve only genuinely validates Nigerian NUBAN
// accounts today. Calling this for a non-NG account number will not give a
// meaningful result until a mobile-money verification path is added —
// tracked separately from this currency/country plumbing.
exports.verifyBankAccountUnified = async (accountNumber, bankCode, countryCode = 'NG') => {
  const provider = getActivePayoutProvider();
  return provider === 'flutterwave'
    ? exports.flutterwaveVerifyAccount(accountNumber, bankCode)
    : exports.paystackVerifyAccount(accountNumber, bankCode);
};

exports.listBanksUnified = async (countryCode = 'NG') => {
  const provider = getActivePayoutProvider();
  return _getCachedBankList(provider, countryCode);
};

exports.initiatePayoutTransfer = async ({ amount, accountNumber, bankCode, accountName, reason, reference, currency = 'NGN' }) => {
  const provider = getActivePayoutProvider();

  if (provider === 'flutterwave') {
    const result = await exports.flutterwaveTransfer({
      amount,
      accountNumber,
      bankCode,
      accountName,
      narration: reason,
      reference,
      currency,
    });
    return {
      provider,
      transferCode: result?.id ? String(result.id) : (result?.reference ?? null),
      raw: result,
    };
  }

  const recipient = await exports.paystackCreateTransferRecipient({
    name: accountName,
    accountNumber,
    bankCode,
    currency,
  });
  const transfer = await exports.paystackInitiateTransfer({
    amount: Math.round(amount * 100),
    recipient: recipient.recipient_code,
    reason,
    reference,
  });
  return {
    provider,
    transferCode: transfer?.transfer_code ?? null,
    raw: transfer,
  };
};

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

exports.flutterwaveRefund = async (transactionId, amount) => {
  try {
    const body = {};
    if (amount) body.amount = amount;
    const { data } = await flutterwaveAPI.post(`/transactions/${transactionId}/refund`, body);
    if (data.status !== 'success') throw new AppError(data.message, 400);
    return data.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Flutterwave refund failed: ' + error.message, 500);
  }
};

exports.refundUnified = async (provider, transactionId, amount) => {
  return provider === 'flutterwave'
    ? exports.flutterwaveRefund(transactionId, amount)
    : exports.paystackRefund(transactionId, amount);
};

module.exports = exports;