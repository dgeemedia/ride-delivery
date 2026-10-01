// backend/src/services/payment.service.js

const axios = require('axios');
const { AppError } = require('../middleware/errorHandler');
const orangeService = require('./orange.service');

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
  metadata = {},
  branchCode = null,
}) => {
  try {
    const { data } = await flutterwaveAPI.post('/transfers', {
      ...(branchCode && { destination_branch_code: branchCode }),
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

// Which rail settles a payout, decided per-country rather than globally.
// A Country row whose payoutMethods include ORANGE_MONEY pays out through
// Orange; everything else keeps the existing env-selected card provider.
// `country` is a normalized row from country.service.
// Rails a provider can actually settle by itself. A country whose only method is
// MANUAL (Ghana, Gambia, Cape Verde, Togo, Benin today) has none — an admin pays
// the destination out-of-band and marks the payout as paid.
const AUTOMATED_PAYOUT_METHODS = ['NG_BANK_TRANSFER', 'BANK_TRANSFER', 'ORANGE_MONEY', 'MOBILE_MONEY'];
exports.AUTOMATED_PAYOUT_METHODS = AUTOMATED_PAYOUT_METHODS;

// ── Mobile-money networks paid through Flutterwave (non-Orange) ────────────────
// `key` is what the app sends as bankCode and what we store on the payout.
// `match` finds the operator in Flutterwave's own bank list for the country, so
// the real `account_bank` code comes from Flutterwave rather than from a guess
// here; `fallback` (the names used in Flutterwave's docs) is used only if the
// list is unreachable or the operator isn't in it.
const MOMO_NETWORKS = {
  GH: [
    { key: 'MTN',        name: 'MTN Mobile Money',          match: /mtn/i,                      fallback: 'MTN' },
    { key: 'VODAFONE',   name: 'Telecel Cash (Vodafone)',   match: /vodafone|telecel|vdf/i,     fallback: 'VODAFONE' },
    { key: 'AIRTELTIGO', name: 'AirtelTigo Money',          match: /airtel|tigo|atl/i,          fallback: 'AIRTELTIGO' },
  ],
};
exports.MOMO_NETWORKS = MOMO_NETWORKS;
const momoNetworksFor = (countryCode) => MOMO_NETWORKS[String(countryCode || '').toUpperCase()] || [];
exports.momoNetworksFor = momoNetworksFor;

const countryUsesMomo = (country) =>
  (Array.isArray(country?.payoutMethods) ? country.payoutMethods : []).includes('MOBILE_MONEY');

/**
 * Which provider settles a payout, decided by the METHOD THE USER CHOSE (stored on
 * the payout), not by the country alone. A country can now offer several options
 * (Orange Money OR a bank account), so "this country has Orange" no longer means
 * "send everything through Orange".
 */
const providerForMethod = (method, country = null) => {
  switch (method) {
    case 'ORANGE_MONEY':     return 'orange';
    case 'MOBILE_MONEY':     return 'flutterwave';
    case 'MANUAL':           return 'manual';
    case 'NG_BANK_TRANSFER': return getActivePayoutProvider();
    // Nigeria keeps its configured bank provider; every other country's bank
    // payouts go through Flutterwave (the only provider wired for them).
    case 'BANK_TRANSFER':    return country?.code === 'NG' ? getActivePayoutProvider() : 'flutterwave';
    default:                 return null;
  }
};
exports.providerForMethod = providerForMethod;

const resolvePayoutProviderForCountry = (country, method = null) => {
  const byMethod = method ? providerForMethod(method, country) : null;
  if (byMethod) return byMethod;
  const methods = Array.isArray(country?.payoutMethods) ? country.payoutMethods : [];
  const legacy  = country?.payoutMethod;
  if (methods.includes('ORANGE_MONEY') || legacy === 'ORANGE_MONEY') return 'orange';
  // Mobile money is always sent through Flutterwave, whatever PAYOUT_PROVIDER says
  // for bank transfers — Paystack's transfer API isn't used for it here.
  if (countryUsesMomo(country)) return 'flutterwave';
  const automated = methods.some(m => AUTOMATED_PAYOUT_METHODS.includes(m)) || AUTOMATED_PAYOUT_METHODS.includes(legacy);
  // Before this, a MANUAL-only country fell through to Paystack, which would
  // try to send a Ghanaian/Togolese account through a Nigerian-shaped transfer.
  return automated ? getActivePayoutProvider() : 'manual';
};
exports.resolvePayoutProviderForCountry = resolvePayoutProviderForCountry;

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
exports.verifyBankAccountUnified = async (accountNumber, bankCode, countryCode = 'NG', country = null, rail = null) => {
  const provider = country ? resolvePayoutProviderForCountry(country) : getActivePayoutProvider();

  // Bank accounts outside Nigeria: Flutterwave's name lookup only exists for
  // Ghana. Everywhere else there is nothing to check against, so the person's
  // typed name is used and the admin sees it flagged as unverified.
  if (rail === 'BANK' && country && country.code !== 'NG') {
    if (country.code === 'GH') {
      try { return await exports.flutterwaveVerifyAccount(accountNumber, bankCode); } catch { /* fall through */ }
    }
    return { account_name: null, account_number: String(accountNumber), unverifiedName: true };
  }

  if (!rail && country && countryUsesMomo(country) && provider === 'flutterwave') {
    // (legacy callers without a rail: a MoMo-only country)
    // Flutterwave has no name lookup for a mobile-money wallet; validate the
    // number's shape so a typo is caught now, not hours later at payout time.
    const { isValidMsisdn, normalizeMsisdn } = require('../utils/msisdn');
    if (!isValidMsisdn(accountNumber, countryCode)) {
      throw new AppError('That does not look like a valid mobile-money number for your country.', 400);
    }
    return { account_name: null, account_number: normalizeMsisdn(accountNumber, countryCode), unverifiedName: true };
  }

  if (provider === 'manual') {
    // Nothing can verify this account automatically; the person types the holder
    // name and the admin checks it by eye before paying.
    return { account_name: null, account_number: String(accountNumber), unverifiedName: true };
  }

  if (provider === 'orange') {
    // There is no name-lookup endpoint for an Orange Money wallet. We can
    // still validate the MSISDN shape so the user gets immediate feedback
    // instead of a failure hours later at payout time.
    if (!orangeService.isValidMsisdn(accountNumber, countryCode)) {
      throw new AppError('That does not look like a valid Orange Money number for your country.', 400);
    }
    return {
      account_name:   null, // Orange does not expose the subscriber name
      account_number: orangeService.normalizeMsisdn(accountNumber, countryCode),
      unverifiedName: true,
    };
  }

  return provider === 'flutterwave'
    ? exports.flutterwaveVerifyAccount(accountNumber, bankCode)
    : exports.paystackVerifyAccount(accountNumber, bankCode);
};

// ── Branch codes (Flutterwave bank transfers) ────────────────────────────────
// Flutterwave requires `destination_branch_code` for bank transfers to these
// countries. The person only picks a bank, so we look the branch up from
// Flutterwave's own list: a bank's single branch, else its head office, else the
// first one. If nothing can be determined we STOP — the payout stays PROCESSING
// and an admin settles it by hand — rather than sending a transfer that is
// likely to bounce.
const FLW_BRANCH_REQUIRED = ['BJ', 'CM', 'CI', 'CD', 'GH', 'SN', 'SL'];
const _branchCache = {};
const resolveFlutterwaveBranchCode = async (countryCode, bankCode) => {
  const cc = String(countryCode).toUpperCase();
  if (!FLW_BRANCH_REQUIRED.includes(cc)) return null;

  const banks = await _getCachedBankList('flutterwave', cc);
  const bank  = banks.find(b => String(b.code) === String(bankCode));
  if (!bank?.id) throw new AppError(`Could not find that bank in Flutterwave's ${cc} list — settle this payout manually.`, 400);

  const hit = _branchCache[bank.id];
  let branches;
  if (hit && Date.now() - hit.at < BANK_CACHE_TTL_MS) branches = hit.list;
  else {
    try {
      const { data } = await flutterwaveAPI.get(`/banks/${bank.id}/branches`);
      branches = Array.isArray(data?.data) ? data.data : [];
    } catch (err) {
      throw new AppError(`Could not fetch branches for ${bank.name} (${err.message}) — settle this payout manually.`, 502);
    }
    _branchCache[bank.id] = { list: branches, at: Date.now() };
  }

  if (!branches.length) {
    throw new AppError(`Flutterwave lists no branch for ${bank.name} — settle this payout manually.`, 400);
  }
  const head = branches.find(b => /head|main|siege|siège|principal|central|hq/i.test(String(b.branch_name || '')));
  const pick = branches.length === 1 ? branches[0] : (head ?? branches[0]);
  return String(pick.branch_code ?? pick.code ?? '') || null;
};
exports.resolveFlutterwaveBranchCode = resolveFlutterwaveBranchCode;

// rail: 'ORANGE' | 'MOMO' | 'BANK' | 'MANUAL' — which option the user is looking at.
const RAIL_METHOD = { ORANGE: 'ORANGE_MONEY', MOMO: 'MOBILE_MONEY', MANUAL: 'MANUAL' };
const railToMethod = (rail, country) =>
  rail === 'BANK' ? (country?.code === 'NG' ? 'NG_BANK_TRANSFER' : 'BANK_TRANSFER') : (RAIL_METHOD[rail] ?? null);

exports.listBanksUnified = async (countryCode = 'NG', country = null, rail = null) => {
  const provider = country ? resolvePayoutProviderForCountry(country, railToMethod(rail, country)) : getActivePayoutProvider();
  if (rail === 'MOMO') return momoNetworksFor(countryCode).map(n => ({ code: n.key, name: n.name, type: 'MOBILE_MONEY' }));

  // Orange markets pay out to a wallet number, not a bank — return the single
  // synthetic entry so the client's existing picker still renders rather than
  // showing an empty list.
  if (provider === 'orange') {
    return [{ code: 'ORANGE_MONEY', name: 'Orange Money', type: 'MOBILE_MONEY' }];
  }
  if (provider === 'manual') return [];
  // Mobile-money countries: a fixed list of networks, not bank accounts.
  if (!rail && countryUsesMomo(country)) {
    return momoNetworksFor(countryCode).map(n => ({ code: n.key, name: n.name, type: 'MOBILE_MONEY' }));
  }

  return _getCachedBankList(provider, countryCode);
};

exports.initiatePayoutTransfer = async ({
  amount, accountNumber, bankCode, accountName, reason, reference,
  currency = 'NGN',
  // Both optional, so every existing call site keeps working unchanged:
  country = null,   // normalized Country row
  msisdn = null,    // wallet number for mobile-money payouts
  method = null,    // the payout's own method (ORANGE_MONEY / MOBILE_MONEY / BANK_TRANSFER …) — decides the rail
}) => {
  const provider = country ? resolvePayoutProviderForCountry(country, method) : getActivePayoutProvider();

  if (provider === 'manual') {
    throw new AppError('This country is settled manually — pay the destination, then mark the payout as paid.', 409);
  }

  if (provider === 'orange') {
    // For an Orange payout the "account number" IS the subscriber's MSISDN.
    return orangeService.cashOut({
      amount,
      msisdn:      msisdn || accountNumber,
      reference,
      currency,
      countryCode: country?.code ?? 'CI',
      narration:   reason,
    });
  }

  if (provider === 'flutterwave' && (method === 'MOBILE_MONEY' || (!method && countryUsesMomo(country)))) {
    const { normalizeMsisdn, isValidMsisdn } = require('../utils/msisdn');
    const cc = country.code;
    if (!isValidMsisdn(msisdn || accountNumber, cc)) {
      throw new AppError('The mobile-money number on this payout is not valid — reject it so the user is refunded.', 400);
    }
    const network = momoNetworksFor(cc).find(n => n.key === bankCode);
    if (!network) throw new AppError(`Unknown mobile-money network "${bankCode}" for ${country.name}`, 400);

    // Ask Flutterwave which code it uses for this operator; fall back to the
    // documented name if the list can't be fetched or doesn't contain it.
    let accountBank = network.fallback;
    try {
      const list  = await _getCachedBankList('flutterwave', cc);
      const found = list.find(b => network.match.test(String(b.name)) || network.match.test(String(b.code)));
      if (found?.code) accountBank = String(found.code);
    } catch (err) {
      console.error(`[payment.service] Flutterwave bank list (${cc}) unavailable, using "${accountBank}":`, err.message);
    }

    const result = await exports.flutterwaveTransfer({
      amount,
      accountNumber: normalizeMsisdn(msisdn || accountNumber, cc),   // with country code, e.g. 233241234567
      bankCode:      accountBank,
      accountName,
      narration:     reason,
      reference,
      currency,
    });
    return { provider: 'flutterwave', transferCode: result?.id ? String(result.id) : (result?.reference ?? null), raw: result };
  }

  if (provider === 'flutterwave') {
    // Bank transfers in these countries need a branch code (Flutterwave's
    // create-transfer reference). Nigeria does not.
    const branchCode = country ? await resolveFlutterwaveBranchCode(country.code, bankCode) : null;
    const result = await exports.flutterwaveTransfer({
      amount,
      accountNumber,
      bankCode,
      accountName,
      narration: reason,
      reference,
      currency,
      ...(branchCode && { branchCode }),
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
  if (provider === 'orange') {
    // Orange Money has no automated merchant-initiated refund on the Web
    // Payment product. Surface that clearly so the admin dashboard routes the
    // refund to a manual Orange Money transfer, rather than failing silently
    // or — worse — marking a refund COMPLETED that never happened.
    throw new AppError(
      'Orange Money refunds must be settled manually — leave this refund pending and send an Orange Money transfer to the customer.',
      501
    );
  }
  return provider === 'flutterwave'
    ? exports.flutterwaveRefund(transactionId, amount)
    : exports.paystackRefund(transactionId, amount);
};

// ─────────────────────────────────────────────
// ORANGE MONEY — thin re-exports
// ─────────────────────────────────────────────
// Controllers already treat payment.service as their single payment entry
// point, so Orange is surfaced here too rather than making every controller
// import a second service.
exports.orange                = orangeService;
exports.isOrangeConfigured    = orangeService.isOrangeConfigured;
exports.orangeInitialize      = orangeService.initializeWebPayment;
exports.orangeStatus          = orangeService.getTransactionStatus;
exports.orangeCashOut         = orangeService.cashOut;
exports.validateOrangeWebhook = orangeService.validateWebhook;
exports.normalizeMsisdn       = orangeService.normalizeMsisdn;

module.exports = exports;