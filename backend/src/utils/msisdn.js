// backend/src/utils/msisdn.js
//
// Phone-number helpers for mobile-money payouts that are NOT Orange. (Orange has
// its own in orange.service.js, which defaults to Côte d'Ivoire.) Here the
// country is always explicit, so a Ghanaian number can never be silently
// prefixed with someone else's dial code.
'use strict';

const DIAL_CODES = {
  NG: '234', GH: '233', GM: '220', CV: '238', TG: '228', BJ: '229', CI: '225', SN: '221',
  ML: '223', BF: '226', NE: '227', GN: '224', GW: '245', SL: '232', LR: '231',
  CM: '237', MG: '261', BW: '267', CD: '243', CF: '236',
};

// Digits AFTER the country code, where the national plan is fixed-length.
// Only set where we are sure; others fall back to a generic 7–12 digit check.
const NATIONAL_LENGTH = { GH: 9 };

/** '024 123 4567' | '+233241234567' | '241234567' → '233241234567' (or '' if empty). */
const normalizeMsisdn = (raw, countryCode) => {
  const dial = DIAL_CODES[String(countryCode || '').toUpperCase()];
  if (!dial) throw new Error(`No dial code known for country "${countryCode}"`);
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);        // 00233…
  const national = digits.startsWith(dial) && digits.length > dial.length + 5
    ? digits.slice(dial.length)
    : digits.replace(/^0+/, '');
  return `${dial}${national}`;
};

const isValidMsisdn = (raw, countryCode) => {
  let msisdn;
  try { msisdn = normalizeMsisdn(raw, countryCode); } catch { return false; }
  if (!msisdn) return false;
  const dial = DIAL_CODES[String(countryCode).toUpperCase()];
  const national = msisdn.slice(dial.length);
  const fixed = NATIONAL_LENGTH[String(countryCode).toUpperCase()];
  return fixed ? national.length === fixed && /^\d+$/.test(national) : /^\d{7,12}$/.test(national);
};

module.exports = { DIAL_CODES, normalizeMsisdn, isValidMsisdn };
