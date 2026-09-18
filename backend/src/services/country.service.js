// backend/src/services/country.service.js
//
// Single source of truth for "what country/currency is this user in".
// Mirrors the caching pattern used in utils/fareEngine.js so we don't
// hit the DB on every request.
//
// Every existing user has countryCode = 'NG' (set by the Stage 1 migration
// default), so until you add more Country rows, every lookup here resolves
// to Nigeria/NGN exactly like the old hardcoded behavior — nothing changes
// for current users until you actually onboard a second country.

'use strict';

const prisma = require('../lib/prisma');

const FALLBACK_COUNTRY = {
  code: 'NG',
  name: 'Nigeria',
  currencyCode: 'NGN',
  currencySymbol: '₦',
  defaultLocale: 'en-NG',
  phoneDialCode: '+234',
  isActive: true,
  paymentProviders: ['paystack', 'flutterwave'],
  payoutMethod: 'NG_BANK_TRANSFER',
  creditMethods: ['CASH', 'WALLET', 'PAYSTACK', 'FLUTTERWAVE'],
  payoutMethods: ['NG_BANK_TRANSFER'],
  providerConfig: {},
  languageCode: 'en',
};

// Everything the app knows how to charge/credit with. A Country row may
// enable any subset — that subset is exactly what the mobile PaymentSelector
// and WalletTopUpScreen render, so a market never sees a method its provider
// can't actually settle.
const ALL_CREDIT_METHODS = ['CASH', 'WALLET', 'PAYSTACK', 'FLUTTERWAVE', 'ORANGE_MONEY'];

const ALL_PAYOUT_METHODS = [
  'NG_BANK_TRANSFER',   // Paystack/Flutterwave NUBAN transfer
  'BANK_TRANSFER',      // generic Flutterwave bank transfer
  'ORANGE_MONEY',       // Orange Money cash-out to an MSISDN
  'MANUAL',             // admin settles out-of-band; the Payout row stays auditable
  'UNSUPPORTED',
];

// Which provider each credit method belongs to. Keeps `paymentProviders` and
// `creditMethods` from drifting apart — see validateCountryPayload in
// adminCountry.controller.js, which enforces the same rule on write.
const METHOD_PROVIDER = {
  PAYSTACK:     'paystack',
  FLUTTERWAVE:  'flutterwave',
  ORANGE_MONEY: 'orange',
  CASH:         null,   // no external provider needed
  WALLET:       null,
};

const CACHE_TTL_MS = 60 * 1000;
let _cache = null;      // Map<code, countryRow>
let _loadedAt = 0;

const _loadAll = async () => {
  const rows = await prisma.country.findMany();
  const map = new Map();
  rows.forEach(r => map.set(r.code, r));
  if (!map.has('NG')) map.set('NG', FALLBACK_COUNTRY); // safety net
  _cache = map;
  _loadedAt = Date.now();
  return map;
};

const invalidateCountryCache = () => {
  _cache = null;
};

/**
 * Get a country config row by ISO code. Falls back to Nigeria if the code
 * isn't found or the DB is unreachable, so a bad/missing countryCode never
 * breaks wallet creation or fare estimation.
 */
const getCountryByCode = async (code = 'NG') => {
  try {
    if (!_cache || Date.now() - _loadedAt >= CACHE_TTL_MS) {
      await _loadAll();
    }
    return normalizeCountry(_cache.get(code) ?? _cache.get('NG') ?? FALLBACK_COUNTRY);
  } catch (err) {
    console.error('[country.service] DB lookup failed, using NG fallback:', err.message);
    return normalizeCountry(FALLBACK_COUNTRY);
  }
};

/**
 * Convenience wrapper — pass a user row (or anything with .countryCode).
 */
const getCountryForUser = async (user) => {
  return getCountryByCode(user?.countryCode ?? 'NG');
};

/**
 * Convenience for controllers: given a userId, resolve the currency code
 * they should be charged/paid in. Looks up the user's countryCode, then the
 * matching Country row. Falls back to NGN on any failure so a lookup
 * problem never blocks a ride/delivery request.
 */
const getCurrencyForUserId = async (userId) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { countryCode: true } });
    const country = await getCountryByCode(user?.countryCode ?? 'NG');
    return country.currencyCode;
  } catch (err) {
    console.error('[country.service] getCurrencyForUserId failed, using NGN fallback:', err.message);
    return 'NGN';
  }
};

/**
 * Countries the mobile app should offer at registration, optionally
 * filtered by role. DRIVER and DELIVERY_PARTNER need real payouts, so
 * countries whose payoutMethod is still 'UNSUPPORTED' are excluded for
 * them. CUSTOMER (or no role) only needs a working payment provider, so
 * every seeded country is eligible.
 */
const getRegistrationCountries = async (role) => {
  try {
    if (!_cache || Date.now() - _loadedAt >= CACHE_TTL_MS) {
      await _loadAll();
    }
    const requiresPayout = role === 'DRIVER' || role === 'DELIVERY_PARTNER';

    return Array.from(_cache.values())
      .map(normalizeCountry)
      .filter(c => c.isActive !== false)
      // A country is payout-capable when it has at least one real payout
      // method configured — not just the legacy single `payoutMethod` column.
      .filter(c => !requiresPayout || c.payoutMethods.some(m => m !== 'UNSUPPORTED'))
      .map(c => ({
        code:         c.code,
        name:         c.name,
        flag:         undefined, // frontend derives flag from code
        dialPrefix:   c.phoneDialCode,
        currencyCode: c.currencyCode,
        // Lets the registration screen pre-select the right app language
        // when a user picks their country, instead of relying on the
        // device locale alone.
        languageCode: c.languageCode,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('[country.service] getRegistrationCountries failed, using NG fallback:', err.message);
    return [{ code: 'NG', name: 'Nigeria', dialPrefix: '+234', currencyCode: 'NGN' }];
  }
};

/**
 * Country rows store JSON columns that may be null on rows created before the
 * Orange migration (which only added them as nullable). Normalise here so
 * every caller gets real arrays/objects and never has to null-check a JSON
 * column — and so existing markets keep behaving exactly as before.
 */
const normalizeCountry = (c) => {
  if (!c) return c;
  const providers = Array.isArray(c.paymentProviders) ? c.paymentProviders : [];

  // Derive credit methods from providers when the column hasn't been set,
  // so countries onboarded before this change work untouched.
  const derived = ['CASH', 'WALLET'];
  if (providers.includes('paystack'))    derived.push('PAYSTACK');
  if (providers.includes('flutterwave')) derived.push('FLUTTERWAVE');
  if (providers.includes('orange'))      derived.push('ORANGE_MONEY');

  const creditMethods = Array.isArray(c.creditMethods) && c.creditMethods.length
    ? c.creditMethods.filter(m => ALL_CREDIT_METHODS.includes(m))
    : derived;

  const payoutMethods = Array.isArray(c.payoutMethods) && c.payoutMethods.length
    ? c.payoutMethods.filter(m => ALL_PAYOUT_METHODS.includes(m))
    : [c.payoutMethod || 'UNSUPPORTED'];

  return {
    ...c,
    paymentProviders: providers,
    creditMethods,
    payoutMethods,
    providerConfig:   (c.providerConfig && typeof c.providerConfig === 'object') ? c.providerConfig : {},
    languageCode:     c.languageCode || String(c.defaultLocale || 'en').split('-')[0],
  };
};

/**
 * True when this market settles through Orange Money rather than
 * Paystack/Flutterwave. Controllers use this instead of hardcoding a
 * country list.
 */
const isOrangeCountry = async (code) => {
  const country = await getCountryByCode(code);
  return country.paymentProviders.includes('orange');
};

/** The provider handling a credit method, or null for CASH/WALLET. */
const getProviderForMethod = (method) => METHOD_PROVIDER[method] ?? null;

/**
 * Everything the mobile app needs to render its payment UI for a country:
 * which methods to show, in what order, and which to preselect.
 *
 * Ordering: the country's own primary rail comes first. In an Orange market
 * that's Orange Money; elsewhere it's whichever of Paystack / Flutterwave is
 * listed first in paymentProviders.
 */
const getPaymentConfigForCountry = async (code = 'NG') => {
  const country = await getCountryByCode(code);
  // Required lazily: orange.service requires the error middleware, which in
  // some boot orders requires back into services. Deferring avoids the cycle.
  const orange = require('./orange.service');

  const methods = country.creditMethods.filter(m => {
    // Never offer Orange Money before the merchant keys are live, or the
    // customer reaches a checkout that 503s.
    if (m === 'ORANGE_MONEY') return orange.isOrangeConfigured();
    return true;
  });

  const primary = country.paymentProviders[0] ?? null;
  const rank = (m) => {
    const p = METHOD_PROVIDER[m];
    if (p && p === primary) return 0;
    if (m === 'WALLET') return 1;
    if (m === 'CASH')   return 2;
    return 3;
  };
  methods.sort((a, b) => rank(a) - rank(b));

  return {
    countryCode:    country.code,
    countryName:    country.name,
    currencyCode:   country.currencyCode,
    currencySymbol: country.currencySymbol,
    languageCode:   country.languageCode,
    defaultLocale:  country.defaultLocale,
    providers:      country.paymentProviders,
    creditMethods:  methods,
    defaultMethod:  methods[0] ?? 'CASH',
    payoutMethods:  country.payoutMethods,
    payoutMethod:   country.payoutMethod,
    // Drives which withdrawal form the app shows: a bank form (account
    // number + bank code) or a mobile-money form (phone number).
    payoutStyle:    country.payoutMethods.includes('ORANGE_MONEY') ? 'MOBILE_MONEY' : 'BANK',
    orangeReady:    orange.isOrangeConfigured(),
  };
};

const getPaymentConfigForUser = async (user) => getPaymentConfigForCountry(user?.countryCode ?? 'NG');

/** All countries with full config — admin dashboard only. */
const getAllCountries = async () => {
  if (!_cache || Date.now() - _loadedAt >= CACHE_TTL_MS) await _loadAll();
  return Array.from(_cache.values())
    .map(normalizeCountry)
    .sort((a, b) => a.name.localeCompare(b.name));
};

module.exports = {
  ALL_CREDIT_METHODS,
  ALL_PAYOUT_METHODS,
  METHOD_PROVIDER,
  normalizeCountry,
  isOrangeCountry,
  getProviderForMethod,
  getPaymentConfigForCountry,
  getPaymentConfigForUser,
  getAllCountries,
  getCountryByCode,
  getCountryForUser,
  getCurrencyForUserId,
  getRegistrationCountries,
  invalidateCountryCache,
  FALLBACK_COUNTRY,
};