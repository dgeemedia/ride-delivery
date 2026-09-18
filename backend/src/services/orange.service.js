// backend/src/services/orange.service.js
//
// Orange Money integration (Orange Developer platform).
//
// Covers the three things the app needs:
//   1. Web Payment      — hosted checkout used for wallet top-ups + ride/delivery payment
//   2. Transaction status — polling/verification after the customer returns
//   3. Cash-out (B2C)    — driver / partner payouts straight to an Orange Money wallet
//
// ── STATUS: BUILT, PENDING CREDENTIALS ───────────────────────────────────────
// Every Orange call is gated behind isOrangeConfigured(). Until the Orange
// merchant keys land in .env, any Orange route returns a clean 503 instead of
// throwing — nothing else in the app breaks, and Paystack/Flutterwave markets
// are completely unaffected.
//
// Required .env keys (add when Orange issues them):
//   ORANGE_CLIENT_ID=
//   ORANGE_CLIENT_SECRET=
//   ORANGE_MERCHANT_KEY=          # per-merchant key from the Orange Money portal
//   ORANGE_WEBPAY_COUNTRY=dev     # 'dev' for sandbox, else ci|sn|ml|cm|bf|gn|cd|mg
//   ORANGE_RETURN_URL=
//   ORANGE_CANCEL_URL=
//   ORANGE_NOTIF_URL=             # webhook -> POST /api/wallet/topup/orange/webhook
//   ORANGE_WEBHOOK_SECRET=        # shared secret we echo back on notif_token
//   ORANGE_B2C_ENABLED=false      # flip to true once the cash-out contract is live
//   ORANGE_B2C_PIN=               # merchant wallet PIN for cash-out authorisation
//
// Per-country overrides (merchant key / webpay country / currency) can also be
// stored on the Country row in `providerConfig.orange` and passed in as
// `config` — DB config always wins over the env default.

'use strict';

const axios = require('axios');
const crypto = require('crypto');
const { AppError } = require('../middleware/errorHandler');

const ORANGE_BASE = process.env.ORANGE_API_BASE || 'https://api.orange.com';

const CLIENT_ID     = process.env.ORANGE_CLIENT_ID;
const CLIENT_SECRET = process.env.ORANGE_CLIENT_SECRET;
const MERCHANT_KEY  = process.env.ORANGE_MERCHANT_KEY;

// Orange's Web Payment path segment per market. 'dev' is the sandbox.
const WEBPAY_COUNTRY_PATH = {
  CI: 'ci', // Côte d'Ivoire
  SN: 'sn', // Senegal
  ML: 'ml', // Mali
  CM: 'cm', // Cameroon
  BF: 'bf', // Burkina Faso
  GN: 'gn', // Guinea
  CD: 'cd', // DR Congo
  MG: 'mg', // Madagascar
  NE: 'ne', // Niger
  BW: 'bw', // Botswana
  JO: 'jo', // Jordan
  EG: 'eg', // Egypt
  MA: 'ma', // Morocco
  TN: 'tn', // Tunisia
  LR: 'lr', // Liberia
  SL: 'sl', // Sierra Leone
  CF: 'cf', // Central African Republic
  GW: 'gw', // Guinea-Bissau
};

// Markets where Orange Money is the primary rail. Used as the default when a
// Country row hasn't been configured yet in the admin dashboard.
const ORANGE_MARKETS = Object.keys(WEBPAY_COUNTRY_PATH);

/**
 * True when the Orange credentials are present. Callers should check this
 * BEFORE offering Orange as a payment option so we never show a customer a
 * method that will fail at checkout.
 */
const isOrangeConfigured = () => Boolean(CLIENT_ID && CLIENT_SECRET && MERCHANT_KEY);

const assertConfigured = () => {
  if (!isOrangeConfigured()) {
    throw new AppError(
      'Orange Money is not available yet — the merchant credentials have not been activated. Please use another payment method.',
      503
    );
  }
};

// ─────────────────────────────────────────────
// OAUTH2 TOKEN (client_credentials, cached)
// ─────────────────────────────────────────────

let _token = null;       // { accessToken, expiresAt }
const TOKEN_SKEW_MS = 60 * 1000; // renew a minute early

const getAccessToken = async () => {
  assertConfigured();

  if (_token && Date.now() < _token.expiresAt - TOKEN_SKEW_MS) {
    return _token.accessToken;
  }

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  try {
    const { data } = await axios.post(
      `${ORANGE_BASE}/oauth/v3/token`,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    );

    const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
    _token = { accessToken: data.access_token, expiresAt: Date.now() + expiresInMs };
    return _token.accessToken;
  } catch (error) {
    _token = null;
    const msg = error?.response?.data?.error_description
      || error?.response?.data?.message
      || error.message;
    throw new AppError('Orange authentication failed: ' + msg, 502);
  }
};

// Force a token refresh — used when Orange replies 401 on an otherwise valid call.
const invalidateOrangeToken = () => { _token = null; };

const orangeRequest = async (method, path, body, { retryOn401 = true } = {}) => {
  const token = await getAccessToken();
  try {
    const { data } = await axios({
      method,
      url: `${ORANGE_BASE}${path}`,
      data: body,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });
    return data;
  } catch (error) {
    if (error?.response?.status === 401 && retryOn401) {
      invalidateOrangeToken();
      return orangeRequest(method, path, body, { retryOn401: false });
    }
    const msg = error?.response?.data?.message
      || error?.response?.data?.description
      || error?.response?.data?.error_description
      || error.message;
    const status = error?.response?.status && error.response.status < 500 ? 400 : 502;
    throw new AppError('Orange API error: ' + msg, status);
  }
};

// ─────────────────────────────────────────────
// CONFIG RESOLUTION (DB overrides env)
// ─────────────────────────────────────────────

/**
 * Merge the env defaults with any per-country `providerConfig.orange` block
 * saved from the admin dashboard, so a single deployment can serve several
 * Orange markets with different merchant keys.
 */
const resolveOrangeConfig = (countryCode = 'CI', config = {}) => {
  const cc = String(countryCode).toUpperCase();
  return {
    merchantKey:   config.merchantKey   || MERCHANT_KEY,
    webpayCountry: config.webpayCountry || process.env.ORANGE_WEBPAY_COUNTRY || WEBPAY_COUNTRY_PATH[cc] || 'dev',
    returnUrl:     config.returnUrl     || process.env.ORANGE_RETURN_URL,
    cancelUrl:     config.cancelUrl     || process.env.ORANGE_CANCEL_URL,
    notifUrl:      config.notifUrl      || process.env.ORANGE_NOTIF_URL,
    lang:          config.lang          || 'fr',
  };
};

// ─────────────────────────────────────────────
// WEB PAYMENT — hosted checkout
// ─────────────────────────────────────────────

/**
 * Create an Orange Money Web Payment session.
 *
 * Orange amounts are whole units of the local currency (XOF/XAF have no
 * minor unit at all), so we round rather than multiply by 100 the way
 * Paystack does.
 *
 * @returns {{ paymentUrl, payToken, notifToken, orderId }}
 */
const initializeWebPayment = async ({
  amount,
  orderId,
  currency = 'XOF',
  countryCode = 'CI',
  config = {},
  returnUrl,
  cancelUrl,
  notifUrl,
  lang,
  reference,
}) => {
  assertConfigured();

  const cfg = resolveOrangeConfig(countryCode, config);
  const notifToken = crypto
    .createHmac('sha256', process.env.ORANGE_WEBHOOK_SECRET || CLIENT_SECRET)
    .update(String(orderId))
    .digest('hex');

  const payload = {
    merchant_key: cfg.merchantKey,
    currency:     currency === 'XOF' || currency === 'XAF' ? currency : currency,
    order_id:     orderId,
    amount:       Math.round(Number(amount)),
    return_url:   returnUrl || cfg.returnUrl,
    cancel_url:   cancelUrl || cfg.cancelUrl,
    notif_url:    notifUrl  || cfg.notifUrl,
    lang:         lang      || cfg.lang,
    reference:    reference || 'Ride & Delivery',
  };

  const data = await orangeRequest(
    'post',
    `/orange-money-webpay/${cfg.webpayCountry}/v1/webpayment`,
    payload
  );

  if (!data?.payment_url) {
    throw new AppError('Orange did not return a payment URL', 502);
  }

  return {
    paymentUrl: data.payment_url,
    payToken:   data.pay_token,
    notifToken: data.notif_token || notifToken,
    orderId:    data.order_id || orderId,
    raw:        data,
  };
};

/**
 * Check the status of a Web Payment. Orange needs all three of order_id,
 * amount and pay_token — we persist pay_token on the WalletTransaction /
 * Payment row at initialize time so verification can find it later.
 *
 * Orange statuses: INITIATED | PENDING | SUCCESS | FAILED | EXPIRED
 */
const getTransactionStatus = async ({ orderId, amount, payToken, countryCode = 'CI', config = {} }) => {
  assertConfigured();
  const cfg = resolveOrangeConfig(countryCode, config);

  const data = await orangeRequest(
    'post',
    `/orange-money-webpay/${cfg.webpayCountry}/v1/transactionstatus`,
    {
      order_id:  orderId,
      amount:    Math.round(Number(amount)),
      pay_token: payToken,
    }
  );

  const status = String(data?.status || '').toUpperCase();
  return {
    status,
    isSuccess: status === 'SUCCESS',
    isPending: status === 'PENDING' || status === 'INITIATED',
    isFailed:  status === 'FAILED' || status === 'EXPIRED',
    txnId:     data?.txnid || data?.txn_id || null,
    raw:       data,
  };
};

// ─────────────────────────────────────────────
// CASH-OUT (B2C) — driver / partner payouts
// ─────────────────────────────────────────────

const isB2CEnabled = () =>
  isOrangeConfigured() && String(process.env.ORANGE_B2C_ENABLED).toLowerCase() === 'true';

/**
 * Push money from the merchant wallet to a subscriber's Orange Money wallet.
 *
 * Until the B2C contract is signed, this throws a clear 503 and the payout
 * stays PENDING for an admin to settle manually from the dashboard — exactly
 * the behaviour the existing NG payout flow already falls back to.
 */
const cashOut = async ({ amount, msisdn, reference, currency = 'XOF', countryCode = 'CI', narration }) => {
  assertConfigured();

  if (!isB2CEnabled()) {
    throw new AppError(
      'Orange Money automatic payouts are not enabled yet. This payout has been queued for manual settlement.',
      503
    );
  }

  const data = await orangeRequest('post', '/orange-money-b2c/v1/cashout', {
    partner:  { idType: 'MSISDN', id: process.env.ORANGE_MERCHANT_MSISDN, encryptedPinCode: process.env.ORANGE_B2C_PIN },
    customer: { idType: 'MSISDN', id: normalizeMsisdn(msisdn, countryCode) },
    amount:   { value: Math.round(Number(amount)), unit: currency },
    reference,
    receiveNotification: true,
    description: narration || 'Ride & Delivery payout',
  });

  return {
    provider:     'orange',
    transferCode: data?.transactionId || data?.payToken || reference,
    status:       String(data?.status || 'PENDING').toUpperCase(),
    raw:          data,
  };
};

// ─────────────────────────────────────────────
// MSISDN HELPERS
// ─────────────────────────────────────────────

const DIAL_CODES = {
  CI: '225', SN: '221', ML: '223', CM: '237', BF: '226', GN: '224',
  CD: '243', MG: '261', NE: '227', BW: '267', JO: '962', EG: '20',
  MA: '212', TN: '216', LR: '231', SL: '232', CF: '236', GW: '245',
};

/**
 * Orange expects a bare international MSISDN with no '+' and no leading zero.
 * Accepts anything the mobile app might send ('+225 07 12 …', '0712…', '2250712…').
 */
const normalizeMsisdn = (raw, countryCode = 'CI') => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const dial = DIAL_CODES[String(countryCode).toUpperCase()] || '225';
  if (digits.startsWith(dial)) return digits;
  return `${dial}${digits.replace(/^0+/, '')}`;
};

/**
 * Light-touch validation so we reject an obviously bad number before burning
 * an API call. Orange MSISDNs across these markets are 8–12 national digits.
 */
const isValidMsisdn = (raw, countryCode = 'CI') => {
  const msisdn = normalizeMsisdn(raw, countryCode);
  return /^\d{10,15}$/.test(msisdn);
};

// ─────────────────────────────────────────────
// WEBHOOK VALIDATION
// ─────────────────────────────────────────────

/**
 * Orange posts back to notif_url with the notif_token it handed us at
 * initialize time. We re-derive it from the order_id and compare in constant
 * time, so a forged callback can't credit a wallet.
 */
const validateWebhook = (orderId, notifToken) => {
  if (!orderId || !notifToken) return false;
  const expected = crypto
    .createHmac('sha256', process.env.ORANGE_WEBHOOK_SECRET || CLIENT_SECRET || '')
    .update(String(orderId))
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(notifToken)));
  } catch {
    return false;
  }
};

module.exports = {
  ORANGE_MARKETS,
  WEBPAY_COUNTRY_PATH,
  isOrangeConfigured,
  isB2CEnabled,
  getAccessToken,
  invalidateOrangeToken,
  resolveOrangeConfig,
  initializeWebPayment,
  getTransactionStatus,
  cashOut,
  normalizeMsisdn,
  isValidMsisdn,
  validateWebhook,
};
