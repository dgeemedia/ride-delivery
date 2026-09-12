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
    return _cache.get(code) ?? _cache.get('NG') ?? FALLBACK_COUNTRY;
  } catch (err) {
    console.error('[country.service] DB lookup failed, using NG fallback:', err.message);
    return FALLBACK_COUNTRY;
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

module.exports = {
  getCountryByCode,
  getCountryForUser,
  getCurrencyForUserId,
  invalidateCountryCache,
  FALLBACK_COUNTRY,
};