// backend/src/services/countrySettings.service.js
//
// Per-country pricing, commission, wallet, payout and bonus configuration.
//
// ── RESOLUTION ORDER (for one country + one key) ─────────────────────────────
//   1. CountrySetting row for that country            → source: 'country'
//   2. SystemSettings row (the old global value)      → source: 'global'
//        …but ONLY for keys that are safe to inherit (see below)
//   3. Starter value scaled to the country's currency → source: 'starter'
//   4. Built-in default                               → source: 'default'
//
// ── WHY MONEY KEYS DON'T ALWAYS INHERIT ──────────────────────────────────────
// The existing SystemSettings values (base fare 500, 130/km, top-up min 100…)
// are Naira amounts. Inheriting them into a CFA, GNF or Ariary market would
// charge nonsense (500 GNF is about 6 US cents). So:
//   - percentages, flags, counts, modes  → inherit the global value everywhere
//   - money amounts                      → inherit the global value ONLY when the
//                                          country's currency is the base currency
//                                          (NGN); otherwise a starter value scaled
//                                          to the local currency is used until an
//                                          admin sets the real number.
// Starter values are a safety net, not a recommendation: the admin API marks a
// country's pricing as "not reviewed" until someone saves it, and refuses to
// activate a non-base-currency country in that state without an explicit override.

'use strict';

const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const { DEFAULT_ROUNDING_STEP, isWholeUnitCurrency, formatMoney } = require('../utils/currency');

const BASE_CURRENCY = (process.env.BASE_PRICING_CURRENCY || 'NGN').toUpperCase();
const BASE_COUNTRY  = 'NG';
const CACHE_TTL_MS  = 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// STARTER SCALING  (1 NGN  →  N units of local currency)
//
// Rough market-rate ratios, deliberately rounded. They only exist so a freshly
// added country has *plausible* numbers instead of Naira amounts. They are NOT
// purchasing-power adjusted and exchange rates move — an admin must review
// them before the country goes live (the UI flags this).
// ─────────────────────────────────────────────────────────────────────────────
const STARTER_FACTOR_FROM_NGN = {
  NGN: 1,
  GHS: 0.010,
  XOF: 0.37,
  XAF: 0.37,
  GNF: 5.7,
  SLE: 0.015,
  LRD: 0.13,
  GMD: 0.045,
  CVE: 0.068,
  MGA: 3.0,
  CDF: 1.9,
  BWP: 0.009,
};

// UTC offset (minutes) per country, used to evaluate surge windows in the
// country's own local time rather than whatever timezone the server runs in.
// Countries spanning several zones (DR Congo) use the capital's offset; an
// admin can override it per country with `utc_offset_minutes`.
const DEFAULT_UTC_OFFSET = {
  NG: 60, GH: 0, GM: 0, CV: -60, TG: 0, BJ: 60,
  CI: 0, SN: 0, ML: 0, BF: 0, NE: 60, GN: 0, GW: 0, SL: 0, LR: 0,
  CM: 60, MG: 180, BW: 120, CD: 60, CF: 60,
};

const DEFAULT_SURGE_WINDOWS = [
  { label: 'Morning Rush',  days: [1, 2, 3, 4, 5],       hourStart: 6,  hourEnd: 9,  multiplier: 1.4 },
  { label: 'Evening Rush',  days: [1, 2, 3, 4, 5],       hourStart: 16, hourEnd: 20, multiplier: 1.5 },
  { label: 'Friday Night',  days: [5],                   hourStart: 18, hourEnd: 23, multiplier: 1.6 },
  { label: 'Late Night',    days: [0, 1, 2, 3, 4, 5, 6], hourStart: 23, hourEnd: 24, multiplier: 1.3 },
  { label: 'Early Morning', days: [0, 1, 2, 3, 4, 5, 6], hourStart: 0,  hourEnd: 5,  multiplier: 1.3 },
  { label: 'Weekend Day',   days: [0, 6],                hourStart: 10, hourEnd: 20, multiplier: 1.2 },
];

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY
//
// One entry per configurable value. The admin UI is generated from this list,
// and every write is validated against it, so adding a setting later is a
// one-line change here.
//
//   type       money | percent | number | boolean | enum | date | json
//   base       built-in default, expressed in BASE_CURRENCY for money keys
//   inherit    may a country fall back to the global SystemSettings value?
//              undefined → yes for non-money, base-currency-only for money
//              false     → never;  'base' → base-currency country only
//   strictWhole  money that becomes a real transfer — must be a whole number in
//                whole-unit currencies (XOF/XAF/GNF/MGA/CDF)
// ─────────────────────────────────────────────────────────────────────────────

const VEHICLES = [
  { id: 'car',      label: 'Car',      base: { base: 500, km: 130, min: 15, floor: 500,  cancel: 200 } },
  { id: 'bike',     label: 'Bike / Motorcycle', base: { base: 200, km: 80,  min: 8,  floor: 250,  cancel: 100 } },
  { id: 'van',      label: 'Van',      base: { base: 800, km: 180, min: 20, floor: 1000, cancel: 300 } },
  { id: 'tricycle', label: 'Tricycle', base: { base: 300, km: 100, min: 10, floor: 300,  cancel: 150 } },
];

const DEFS = [];
const def = (d) => DEFS.push({ inherit: undefined, strictWhole: false, ...d });

// ── Ride pricing ────────────────────────────────────────────────────────────
for (const v of VEHICLES) {
  def({ key: `ride_base_fare_${v.id}`,         group: 'ride_pricing', label: `${v.label} — base fare`,        type: 'money', base: v.base.base,   min: 0 });
  def({ key: `ride_per_km_${v.id}`,            group: 'ride_pricing', label: `${v.label} — per km`,           type: 'money', base: v.base.km,     min: 0 });
  def({ key: `ride_per_minute_${v.id}`,        group: 'ride_pricing', label: `${v.label} — per minute`,       type: 'money', base: v.base.min,    min: 0 });
  def({ key: `ride_minimum_fare_${v.id}`,      group: 'ride_pricing', label: `${v.label} — minimum fare`,     type: 'money', base: v.base.floor,  min: 0 });
  def({ key: `ride_cancellation_fee_${v.id}`,  group: 'ride_pricing', label: `${v.label} — cancellation fee`, type: 'money', base: v.base.cancel, min: 0 });
}
def({ key: 'ride_booking_fee',    group: 'ride_pricing', label: 'Booking fee (car; bike ×0.5, tricycle ×0.75, van ×1.5)', type: 'money', base: 100, min: 0 });
def({ key: 'price_rounding_step', group: 'ride_pricing', label: 'Round fares to nearest',                                   type: 'money', base: 50,  min: 0.01, help: 'e.g. 25 or 50 for CFA, 0.5 for cedis. Defaults per currency.' });

// ── Delivery pricing ────────────────────────────────────────────────────────
def({ key: 'delivery_base_fee',           group: 'delivery_pricing', label: 'Delivery — base fee',   type: 'money', base: 500, min: 0 });
def({ key: 'delivery_per_km',             group: 'delivery_pricing', label: 'Delivery — per km',     type: 'money', base: 80,  min: 0 });
def({ key: 'delivery_weight_fee_per_kg',  group: 'delivery_pricing', label: 'Delivery — per kg',     type: 'money', base: 50,  min: 0 });

// ── Commission ──────────────────────────────────────────────────────────────
def({ key: 'platform_commission_rides',      group: 'commission', label: 'Platform commission — rides (%)',      type: 'percent', base: 20, min: 0, max: 60 });
def({ key: 'platform_commission_deliveries', group: 'commission', label: 'Platform commission — deliveries (%)', type: 'percent', base: 15, min: 0, max: 60 });

// ── Surge ───────────────────────────────────────────────────────────────────
def({ key: 'surge_windows',       group: 'surge', label: 'Surge windows',                 type: 'json',   base: DEFAULT_SURGE_WINDOWS, help: 'Times are in the country\'s local time.' });
def({ key: 'utc_offset_minutes',  group: 'surge', label: 'UTC offset (minutes)',          type: 'number', base: 60, min: -720, max: 840, inherit: false, help: 'Lagos = 60, Dakar = 0, Antananarivo = 180.' });

// ── Wallet ──────────────────────────────────────────────────────────────────
def({ key: 'wallet_topup_min',            group: 'wallet', label: 'Minimum top-up',                       type: 'money',   base: 100,       min: 0, strictWhole: true });
def({ key: 'wallet_topup_max',            group: 'wallet', label: 'Maximum top-up',                       type: 'money',   base: 1_000_000, min: 0, strictWhole: true });
def({ key: 'transfer_min',                group: 'wallet', label: 'Minimum wallet-to-wallet transfer',    type: 'money',   base: 50,        min: 0, strictWhole: true });
def({ key: 'driver_min_balance_percent',  group: 'wallet', label: 'Driver/partner wallet balance needed to accept a job (% of fare)', type: 'percent', base: 100, min: 0, max: 100,
     help: '100 = wallet must cover the whole fare (current behaviour). 0 = no balance required.' });

// ── Payouts / withdrawals ───────────────────────────────────────────────────
def({ key: 'withdrawals_enabled',          group: 'payouts', label: 'Withdrawals enabled',                    type: 'boolean', base: true });
def({ key: 'withdrawal_min_customer',      group: 'payouts', label: 'Minimum withdrawal — customers',         type: 'money',   base: 500,  min: 0, strictWhole: true });
def({ key: 'withdrawal_min_earner',        group: 'payouts', label: 'Minimum withdrawal — drivers & partners', type: 'money',  base: 1000, min: 0, strictWhole: true });
def({ key: 'withdrawal_max',               group: 'payouts', label: 'Maximum per withdrawal (0 = no limit)',  type: 'money',   base: 0,    min: 0, strictWhole: true });
def({ key: 'withdrawal_fee_flat',          group: 'payouts', label: 'Withdrawal fee — flat',                  type: 'money',   base: 0,    min: 0, strictWhole: true });
def({ key: 'withdrawal_fee_percent',       group: 'payouts', label: 'Withdrawal fee — percent (%)',           type: 'percent', base: 0,    min: 0, max: 20 });

// ── Onboarding bonuses ──────────────────────────────────────────────────────
def({ key: 'onboarding_bonus_driver',   group: 'bonuses', label: 'Driver onboarding bonus (non-withdrawable)',  type: 'money', base: 5000, min: 0, strictWhole: true });
def({ key: 'onboarding_bonus_partner',  group: 'bonuses', label: 'Partner onboarding bonus (non-withdrawable)', type: 'money', base: 5000, min: 0, strictWhole: true });

// ── Customer cashback ───────────────────────────────────────────────────────
def({ key: 'cashback_enabled',         group: 'cashback', label: 'Cashback enabled',                type: 'boolean', base: false, inherit: 'base', help: 'Each country must be switched on explicitly.' });
def({ key: 'cashback_milestone_trips', group: 'cashback', label: 'Trips needed',                    type: 'number',  base: 10, min: 1, max: 1000 });
def({ key: 'cashback_mode',            group: 'cashback', label: 'Reward type',                     type: 'enum',    base: 'fixed', options: ['fixed', 'percentage'] });
def({ key: 'cashback_amount',          group: 'cashback', label: 'Fixed reward',                    type: 'money',   base: 0, min: 0, strictWhole: true });
def({ key: 'cashback_percentage',      group: 'cashback', label: 'Percentage reward (%)',           type: 'percent', base: 0, min: 0, max: 100 });
def({ key: 'cashback_max_amount',      group: 'cashback', label: 'Reward cap (percentage mode)',    type: 'money',   base: 0, min: 0, strictWhole: true, help: '0 = no cap' });
def({ key: 'cashback_new_user_after',  group: 'cashback', label: 'Only users who joined after',     type: 'date',    base: '' });

const DEF_BY_KEY = Object.fromEntries(DEFS.map(d => [d.key, d]));
const INTEGER_KEYS = new Set(['utc_offset_minutes', 'cashback_milestone_trips']);

const GROUPS = [
  { id: 'ride_pricing',     label: 'Ride pricing',        pricing: true },
  { id: 'delivery_pricing', label: 'Delivery pricing',    pricing: true },
  { id: 'commission',       label: 'Commission',          pricing: true },
  { id: 'surge',            label: 'Surge & timezone',    pricing: true },
  { id: 'wallet',           label: 'Wallet limits' },
  { id: 'payouts',          label: 'Payouts & withdrawals' },
  { id: 'bonuses',          label: 'Onboarding bonuses' },
  { id: 'cashback',         label: 'Customer cashback' },
];
const PRICING_GROUPS = GROUPS.filter(g => g.pricing).map(g => g.id);

// Stored alongside the settings; not part of the editable registry.
const REVIEWED_KEY = 'pricing_reviewed';

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS  (no I/O — unit tested directly)
// ─────────────────────────────────────────────────────────────────────────────

const starterFactor = (currency) => {
  const to   = STARTER_FACTOR_FROM_NGN[String(currency).toUpperCase()];
  const from = STARTER_FACTOR_FROM_NGN[BASE_CURRENCY] ?? 1;
  return to === undefined ? null : to / from;
};

const roundMoney = (value, currency) =>
  isWholeUnitCurrency(currency) ? Math.round(value) : Math.round(value * 100) / 100;

/** Scale a base-currency money amount into `currency`. Null if unknown currency. */
const scaleMoney = (amount, currency) => {
  const f = starterFactor(currency);
  if (f === null) return null;
  const scaled = amount * f;
  // Never let a non-zero amount round down to zero (e.g. 8 NGN/min → 0.07 GHS).
  if (amount > 0 && roundMoney(scaled, currency) === 0) return isWholeUnitCurrency(currency) ? 1 : 0.01;
  return roundMoney(scaled, currency);
};

/** Built-in value for a key in a given currency (used when nothing is stored). */
const builtinValue = (d, currency) => {
  if (d.key === 'price_rounding_step') return DEFAULT_ROUNDING_STEP[currency] ?? d.base;
  if (d.type !== 'money') return d.base;
  if (currency === BASE_CURRENCY) return d.base;
  const scaled = scaleMoney(d.base, currency);
  return scaled === null ? d.base : scaled;
};

const isInheritable = (d, currency) => {
  if (d.inherit === false) return false;
  // 'base' = a switch that spends the company's money (cashback). A new market
  // must be opted in explicitly, never enrolled by inheriting Nigeria's setting.
  if (d.inherit === 'base' || d.type === 'money') return currency === BASE_CURRENCY;
  return true;
};

/** Parse a stored/global value into the registry type. Returns undefined if unusable. */
const coerce = (d, raw) => {
  if (raw === null || raw === undefined) return undefined;
  switch (d.type) {
    case 'money': case 'percent': case 'number': {
      const n = typeof raw === 'number' ? raw : parseFloat(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true')  return true;
      if (raw === 'false') return false;
      return undefined;
    case 'enum':
      return d.options.includes(raw) ? raw : undefined;
    case 'date':
      return typeof raw === 'string' ? raw : undefined;
    case 'json':
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return undefined; } }
      return raw;
    default:
      return raw;
  }
};

const validateSurgeWindows = (windows) => {
  if (!Array.isArray(windows)) throw new AppError('surge_windows must be a list', 400);
  windows.forEach((w, i) => {
    const at = `surge_windows[${i}]`;
    if (!w || typeof w !== 'object') throw new AppError(`${at} must be an object`, 400);
    if (!Array.isArray(w.days) || !w.days.length || w.days.some(d => !Number.isInteger(d) || d < 0 || d > 6))
      throw new AppError(`${at}.days must be a list of 0–6 (Sunday = 0)`, 400);
    if (!Number.isFinite(w.hourStart) || !Number.isFinite(w.hourEnd) || w.hourStart < 0 || w.hourEnd > 24 || w.hourStart >= w.hourEnd)
      throw new AppError(`${at}: hourStart must be before hourEnd, within 0–24`, 400);
    if (!Number.isFinite(w.multiplier) || w.multiplier < 1 || w.multiplier > 5)
      throw new AppError(`${at}.multiplier must be between 1 and 5`, 400);
  });
  return windows.map(w => ({
    label: String(w.label || 'Surge').slice(0, 40),
    days: [...new Set(w.days)].sort(),
    hourStart: w.hourStart, hourEnd: w.hourEnd, multiplier: w.multiplier,
  }));
};

/**
 * Validate + normalise an admin-supplied value. Throws AppError(400) with a
 * message an admin can act on; never silently clamps.
 */
const validateValue = (key, raw, currency) => {
  const d = DEF_BY_KEY[key];
  if (!d) throw new AppError(`Unknown setting "${key}"`, 400);

  if (d.type === 'json') {
    const parsed = coerce(d, raw);
    if (parsed === undefined) throw new AppError(`${d.label}: invalid JSON`, 400);
    return key === 'surge_windows' ? validateSurgeWindows(parsed) : parsed;
  }

  const v = coerce(d, raw);
  if (v === undefined) {
    // '' means "no value" for a date; anything else unparseable is an error.
    if (d.type === 'date' && raw === '') return '';
    throw new AppError(`${d.label}: "${raw}" is not a valid ${d.type}`, 400);
  }

  if (d.type === 'date') {
    if (v !== '' && Number.isNaN(Date.parse(v))) throw new AppError(`${d.label}: not a valid date`, 400);
    return v;
  }
  if (d.type === 'boolean' || d.type === 'enum') return v;

  if (d.min !== undefined && v < d.min) throw new AppError(`${d.label} must be at least ${d.min}`, 400);
  if (d.max !== undefined && v > d.max) throw new AppError(`${d.label} must be at most ${d.max}`, 400);

  if (INTEGER_KEYS.has(d.key) && !Number.isInteger(v))
    throw new AppError(`${d.label} must be a whole number`, 400);

  if (d.type === 'money' && d.strictWhole && isWholeUnitCurrency(currency) && !Number.isInteger(v))
    throw new AppError(`${d.label}: ${currency} has no decimals — use a whole number`, 400);

  return v;
};

/**
 * Cross-field rules that a single-key validator can't see. Runs on the
 * *effective* values after the change is applied.
 */
const validateConsistency = (v) => {
  if (v.wallet_topup_max > 0 && v.wallet_topup_min > v.wallet_topup_max)
    throw new AppError('Minimum top-up cannot be higher than maximum top-up', 400);
  if (v.withdrawal_max > 0 && v.withdrawal_min_customer > v.withdrawal_max)
    throw new AppError('Customer minimum withdrawal cannot exceed the maximum withdrawal', 400);
  if (v.withdrawal_max > 0 && v.withdrawal_min_earner > v.withdrawal_max)
    throw new AppError('Driver/partner minimum withdrawal cannot exceed the maximum withdrawal', 400);
  if (v.cashback_enabled && v.cashback_mode === 'fixed' && !(v.cashback_amount > 0))
    throw new AppError('Cashback is enabled in fixed mode but the fixed reward is 0', 400);
  if (v.cashback_enabled && v.cashback_mode === 'percentage' && !(v.cashback_percentage > 0))
    throw new AppError('Cashback is enabled in percentage mode but the percentage is 0', 400);
  for (const id of ['car', 'bike', 'van', 'tricycle']) {
    if (v[`ride_minimum_fare_${id}`] < 0) throw new AppError('Minimum fare cannot be negative', 400);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CACHE + LOADERS
// ─────────────────────────────────────────────────────────────────────────────

let _globalCache = null;                 // { map, loadedAt }
const _countryCache = new Map();         // code → { rows: Map, loadedAt }

const invalidateCountrySettingsCache = (countryCode) => {
  if (countryCode) _countryCache.delete(String(countryCode).toUpperCase());
  else _countryCache.clear();
  _globalCache = null;
};

const loadGlobal = async () => {
  if (_globalCache && Date.now() - _globalCache.loadedAt < CACHE_TTL_MS) return _globalCache.map;
  const rows = await prisma.systemSettings.findMany({ where: { key: { in: DEFS.map(d => d.key) } } });
  const map = new Map(rows.map(r => [r.key, r.value]));
  _globalCache = { map, loadedAt: Date.now() };
  return map;
};

const loadCountryRows = async (code) => {
  const hit = _countryCache.get(code);
  if (hit && Date.now() - hit.loadedAt < CACHE_TTL_MS) return hit.rows;
  const rows = await prisma.countrySetting.findMany({ where: { countryCode: code } });
  const map = new Map(rows.map(r => [r.key, r.value]));
  _countryCache.set(code, { rows: map, loadedAt: Date.now() });
  return map;
};

// Local import: country.service requires nothing from here, but keep it lazy so
// a future cycle can't bite.
const getCountry = async (code) => require('./country.service').getCountryByCode(code);

/**
 * Resolve every setting for a country.
 * @returns {{ values, sources, currency, countryCode }}
 */
const getEffectiveSettings = async (countryCode = BASE_COUNTRY) => {
  const code = String(countryCode || BASE_COUNTRY).toUpperCase();
  const country  = await getCountry(code);
  const currency = country.currencyCode;

  let global = new Map();
  let rows   = new Map();
  try {
    [global, rows] = await Promise.all([loadGlobal(), loadCountryRows(country.code)]);
  } catch (err) {
    // A settings-table hiccup must never block a ride request; fall through to
    // built-in defaults for this call.
    console.error('[countrySettings] load failed, using built-in defaults:', err.message);
  }

  const values = {};
  const sources = {};
  for (const d of DEFS) {
    let v = coerce(d, rows.get(d.key));
    if (v !== undefined) { values[d.key] = v; sources[d.key] = 'country'; continue; }

    if (isInheritable(d, currency)) {
      v = coerce(d, global.get(d.key));
      if (v !== undefined) { values[d.key] = v; sources[d.key] = 'global'; continue; }
    }

    if (d.key === 'utc_offset_minutes') {
      values[d.key] = DEFAULT_UTC_OFFSET[country.code] ?? d.base;
      sources[d.key] = 'default';
      continue;
    }

    values[d.key]  = builtinValue(d, currency);
    sources[d.key] = d.type === 'money' && currency !== BASE_CURRENCY ? 'starter' : 'default';
  }

  return { values, sources, currency, countryCode: country.code };
};

const getSetting = async (countryCode, key) => (await getEffectiveSettings(countryCode)).values[key];

/** Convenience for money limits: returns {min,max} for wallet top-ups. */
const getTopUpLimits = async (countryCode) => {
  const { values, currency } = await getEffectiveSettings(countryCode);
  return { min: values.wallet_topup_min, max: values.wallet_topup_max, currency };
};

/**
 * Withdrawal rules for a role in a country, plus a helper that computes the fee
 * and net amount for a requested withdrawal.
 */
const getWithdrawalRules = async (countryCode, role = 'CUSTOMER') => {
  const { values, currency } = await getEffectiveSettings(countryCode);
  const earner = role === 'DRIVER' || role === 'DELIVERY_PARTNER';
  const rules = {
    enabled: values.withdrawals_enabled !== false,
    min:     earner ? values.withdrawal_min_earner : values.withdrawal_min_customer,
    max:     values.withdrawal_max,
    feeFlat: values.withdrawal_fee_flat,
    feePct:  values.withdrawal_fee_percent,
    currency,
  };
  return rules;
};

/**
 * Validate a withdrawal against a country's rules and compute the fee.
 * The wallet is debited `amount`; the provider is sent `net`.
 */
const applyWithdrawalRules = (amount, rules) => {
  if (!rules.enabled) throw new AppError('Withdrawals are currently paused for your country. Please try again later.', 403);
  if (amount < rules.min) throw new AppError(`Minimum withdrawal is ${formatMoney(rules.min, rules.currency)}`, 400);
  if (rules.max > 0 && amount > rules.max) throw new AppError(`Maximum withdrawal is ${formatMoney(rules.max, rules.currency)}`, 400);

  let fee = rules.feeFlat + amount * (rules.feePct / 100);
  fee = roundMoney(fee, rules.currency);
  // Rounding a whole-unit currency fee can nudge it up; never let the fee eat
  // the whole withdrawal.
  if (fee >= amount) throw new AppError('The withdrawal amount is too small to cover the withdrawal fee', 400);
  return { gross: amount, fee, net: roundMoney(amount - fee, rules.currency) };
};

/**
 * One call for every withdrawal entry point (customer wallet, driver, partner).
 * Validates the amount against the user's COUNTRY rules and returns what the
 * wallet is debited (gross), what the provider is sent (net) and the fee.
 */
const planWithdrawal = async ({ countryCode, role, amount, currency }) => {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new AppError('Enter a valid withdrawal amount', 400);
  if (isWholeUnitCurrency(currency) && !Number.isInteger(amt)) {
    throw new AppError(`${currency} amounts must be whole numbers.`, 400);
  }
  const rules = await getWithdrawalRules(countryCode, role);
  return { ...applyWithdrawalRules(amt, rules), rules };
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN WRITES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert overrides for one country. `changes` is { key: value }. A value of
 * `null` removes the override (country goes back to inheriting).
 *
 * All-or-nothing: every value is validated, then the merged result is
 * cross-checked, before anything is written.
 *
 * @returns {{ applied: Array<{key, from, to}>, effective }}
 */
const saveCountrySettings = async (countryCode, changes, adminId) => {
  const code = String(countryCode).toUpperCase();
  const existingRow = await prisma.country.findUnique({ where: { code } });
  if (!existingRow) throw new AppError('Country not found', 404);

  const currency = existingRow.currencyCode;
  const before   = await getEffectiveSettings(code);

  const toSet = {};
  const toClear = [];
  for (const [key, raw] of Object.entries(changes || {})) {
    if (key === REVIEWED_KEY) continue;
    if (!DEF_BY_KEY[key]) throw new AppError(`Unknown setting "${key}"`, 400);
    if (raw === null) toClear.push(key);
    else toSet[key] = validateValue(key, raw, currency);
  }
  if (!Object.keys(toSet).length && !toClear.length) throw new AppError('No changes supplied', 400);

  // Cross-field check against what the country would look like afterwards.
  const preview = { ...before.values, ...toSet };
  validateConsistency(preview);

  await prisma.$transaction([
    ...Object.entries(toSet).map(([key, value]) =>
      prisma.countrySetting.upsert({
        where:  { countryCode_key: { countryCode: code, key } },
        update: { value, updatedBy: adminId ?? null },
        create: { countryCode: code, key, value, updatedBy: adminId ?? null },
      })),
    ...(toClear.length
      ? [prisma.countrySetting.deleteMany({ where: { countryCode: code, key: { in: toClear } } })]
      : []),
    // Saving anything in a pricing group is an admin taking ownership of the
    // numbers, which is what clears the "starter values" warning.
    ...(Object.keys({ ...toSet }).some(k => PRICING_GROUPS.includes(DEF_BY_KEY[k].group))
      ? [prisma.countrySetting.upsert({
          where:  { countryCode_key: { countryCode: code, key: REVIEWED_KEY } },
          update: { value: true, updatedBy: adminId ?? null },
          create: { countryCode: code, key: REVIEWED_KEY, value: true, updatedBy: adminId ?? null },
        })]
      : []),
  ]);

  invalidateCountrySettingsCache(code);
  try { require('../utils/fareEngine').invalidateFareCache(); } catch { /* engine not loaded yet */ }

  const after = await getEffectiveSettings(code);
  const applied = [...Object.keys(toSet), ...toClear].map(key => ({
    key, from: before.values[key], to: after.values[key],
    source: after.sources[key],
  }));

  return { applied, effective: after };
};

const isPricingReviewed = async (countryCode) => {
  const code = String(countryCode).toUpperCase();
  const row = await prisma.country.findUnique({ where: { code } });
  // The base-currency market has always been priced from the global settings.
  if (!row || row.currencyCode === BASE_CURRENCY) return true;
  const rows = await loadCountryRows(code);
  return rows.get(REVIEWED_KEY) === true;
};

const markPricingReviewed = async (countryCode, adminId) => {
  const code = String(countryCode).toUpperCase();
  await prisma.countrySetting.upsert({
    where:  { countryCode_key: { countryCode: code, key: REVIEWED_KEY } },
    update: { value: true, updatedBy: adminId ?? null },
    create: { countryCode: code, key: REVIEWED_KEY, value: true, updatedBy: adminId ?? null },
  });
  invalidateCountrySettingsCache(code);
};

/**
 * Clone one country's settings into another, converting money by an explicit
 * exchange factor. `factor` = how many units of the target currency one unit of
 * the source currency is worth.
 *
 * Deliberately requires the caller to state the factor: silently guessing a rate
 * here would be exactly the Naira-amounts-in-CFA bug this feature exists to stop.
 */
const copySettings = async (targetCode, sourceCode, { factor, groups, adminId } = {}) => {
  const target = String(targetCode).toUpperCase();
  const source = String(sourceCode).toUpperCase();
  if (target === source) throw new AppError('Source and target country are the same', 400);

  const [tc, sc] = await Promise.all([
    prisma.country.findUnique({ where: { code: target } }),
    prisma.country.findUnique({ where: { code: source } }),
  ]);
  if (!tc || !sc) throw new AppError('Country not found', 404);
  const sameCurrency = tc.currencyCode === sc.currencyCode;
  const f = sameCurrency ? 1 : Number(factor);
  if (!sameCurrency && !(f > 0)) {
    throw new AppError(`${sc.currencyCode} and ${tc.currencyCode} differ — supply "factor" (1 ${sc.currencyCode} = ? ${tc.currencyCode})`, 400);
  }

  const src = await getEffectiveSettings(source);
  const wanted = new Set(groups && groups.length ? groups : GROUPS.map(g => g.id));
  const changes = {};
  for (const d of DEFS) {
    if (!wanted.has(d.group)) continue;
    if (d.key === 'utc_offset_minutes') continue;        // timezone is per-country, never copied
    let v = src.values[d.key];
    if (d.type === 'money') {
      v = roundMoney(v * f, tc.currencyCode);
      if (d.strictWhole && isWholeUnitCurrency(tc.currencyCode)) v = Math.round(v);
    }
    changes[d.key] = v;
  }
  return saveCountrySettings(target, changes, adminId);
};

/**
 * Describe the full settings surface for one country — what the admin UI renders.
 */
const describeCountrySettings = async (countryCode) => {
  const code = String(countryCode).toUpperCase();
  const eff = await getEffectiveSettings(code);
  const rows = await loadCountryRows(code);
  return {
    countryCode: eff.countryCode,
    currency: eff.currency,
    baseCurrency: BASE_CURRENCY,
    pricingReviewed: await isPricingReviewed(code),
    groups: GROUPS,
    settings: DEFS.map(d => ({
      key: d.key, group: d.group, label: d.label, type: d.type,
      min: d.min, max: d.max, options: d.options, help: d.help,
      strictWhole: d.strictWhole,
      value: eff.values[d.key],
      source: eff.sources[d.key],                       // country | global | starter | default
      overridden: rows.has(d.key),
    })),
  };
};

module.exports = {
  BASE_CURRENCY, BASE_COUNTRY, DEFS, DEF_BY_KEY, GROUPS, PRICING_GROUPS,
  DEFAULT_UTC_OFFSET, DEFAULT_SURGE_WINDOWS, STARTER_FACTOR_FROM_NGN,
  // pure
  scaleMoney, builtinValue, isInheritable, coerce, validateValue, validateConsistency, applyWithdrawalRules,
  // io
  getEffectiveSettings, getSetting, getTopUpLimits, getWithdrawalRules, planWithdrawal,
  saveCountrySettings, copySettings, describeCountrySettings,
  isPricingReviewed, markPricingReviewed, invalidateCountrySettingsCache,
};
