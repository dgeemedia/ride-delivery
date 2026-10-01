// mobile/src/utils/phoneFormat.js
//
// Turns what a user types into the E.164 number the API expects, per country.
// Kept in its own file (pure JS, no React Native imports) so it can be unit-tested.
//
// Two kinds of national numbering plan:
//   • Most markets: a leading "0" is a trunk prefix and is dropped
//       (Nigeria 0801… → +234801…, Mali 76 42 74 84 → +22376427484).
//   • Closed 10-digit plans — Côte d'Ivoire (since Jan 2021) and Benin (since
//     30 Nov 2024): the leading 0 is PART of the number and must be kept
//       (CI 07 01 23 45 67 → +2250701234567, BJ 01 97 00 00 00 → +2290197000000).
//     Benin's old 8-digit numbers (97 00 00 00) are upgraded by prefixing "01".

// Digits of the national number the app expects (leading 0 INCLUDED for CI/BJ,
// EXCLUDED everywhere else).
export const COUNTRY_PHONE_DIGITS = {
  NG: 10, GH: 9, CI: 10, SN: 9, ML: 8, TG: 8, BJ: 10, BF: 8,
  NE: 8, GN: 9, GW: 7, GM: 7, SL: 8, LR: 8, CV: 7,
  CM: 9, MG: 9, BW: 8, CD: 9, CF: 8,
};

const KEEP_LEADING_ZERO = new Set(['CI', 'BJ']);

const toNational = (digits, countryCode) => {
  if (KEEP_LEADING_ZERO.has(countryCode)) {
    return countryCode === 'BJ' && /^\d{8}$/.test(digits) ? `01${digits}` : digits;
  }
  return digits.replace(/^0+/, '');
};

/**
 * @param {string} raw         exactly what the user typed
 * @param {string} countryCode ISO code of the selected country, e.g. "ML"
 * @param {string} dialPrefix  e.g. "+223"
 * @returns {{ national: string, e164: string }}
 */
export const parsePhone = (raw, countryCode, dialPrefix = '+234') => {
  const typed = String(raw || '').trim();
  const explicit = typed.startsWith('+') || typed.startsWith('00');
  let digits = typed.replace(/\D/g, '');
  if (typed.startsWith('00')) digits = digits.slice(2);

  const bareDial = dialPrefix.replace('+', '');
  const expected = COUNTRY_PHONE_DIGITS[countryCode];

  if (digits.startsWith(bareDial)) {
    const rest = toNational(digits.slice(bareDial.length), countryCode);
    // "+223…" / "00223…" is explicitly international. A bare "223…" only counts as
    // a country code when the remainder is a full-length number — otherwise it is a
    // national number that merely starts with those digits (a Malian 22 34 56 78).
    if (explicit || !expected || rest.length === expected) {
      return { national: rest, e164: `${dialPrefix}${rest}` };
    }
  }
  const national = toNational(digits, countryCode);
  return { national, e164: `${dialPrefix}${national}` };
};

/** The number to send to the API. */
export const formatPhone = (raw, countryCode, dialPrefix = '+234') =>
  parsePhone(raw, countryCode, dialPrefix).e164;

/** Soft check: does the digit count look right for the selected country? */
export const isPlausiblePhoneLength = (raw, countryCode, dialPrefix = '+234') => {
  const expected = COUNTRY_PHONE_DIGITS[countryCode];
  if (!expected) return true; // unknown country — don't gate on it
  return parsePhone(raw, countryCode, dialPrefix).national.length === expected;
};
