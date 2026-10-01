// backend/src/utils/phone.js
//
// Phone validation for ALL markets.
//
// Registration used to accept only Nigerian numbers (a hard-coded +234/0[7-9]
// regex), so anyone in Mali, Senegal, Cameroon… got "Please enter a valid
// Nigerian phone number". The generic express-validator isMobilePhone() was no
// better: it rejects real numbers from Mali, Senegal, Côte d'Ivoire, Guinea and
// Guinea-Bissau. Both are replaced by the rules below.
//
// RULES
//   Nigeria  — unchanged: "+234" or "0" then [7-9] and 9 more digits. Existing
//              accounts store numbers in either form, so nothing is rewritten.
//   Others   — "+" + that country's dial code + 6–12 digits (a deliberately wide
//              band: national plans change and the app already checks exact lengths).
//              A leading trunk "0" after the dial code is dropped when stored.
//   EXCEPTION — Côte d'Ivoire (since 31 Jan 2021) and Benin (since 30 Nov 2024) run
//              closed 10-digit plans where the leading 0 is PART of the number and must
//              be kept internationally (+225 07 xx xx xx xx, +229 01 xx xx xx xx;
//              ITU-T operational bulletin notices from ARTCI and ARCEP-Bénin). Dropping
//              it produces a number that cannot be called or sent an SMS. For these two
//              the national part must be exactly 10 digits. Benin's pre-2024 8-digit
//              numbers are upgraded by prefixing "01" (unambiguous: every Beninese number
//              now starts with 01). Côte d'Ivoire's old 8-digit numbers cannot be
//              upgraded (the carrier prefix 01/05/07 is unknown), so they are rejected.
//   The number's dial code must match the chosen country, so "+234…" can't be
//   registered as a Mali account.
'use strict';

// `validator` ships with express-validator but is only a transitive dependency; under
// pnpm it isn't resolvable from here. If it's missing we simply skip that extra check.
let validator = null;
try { validator = require('validator'); } catch { /* optional */ }
const { DIAL_CODES } = require('./msisdn');

const NG_RE = /^(\+234|0)[7-9]\d{9}$/;

/** Closed-plan markets: national number length INCLUDING the leading 0. */
const CLOSED_PLAN_LENGTH = { CI: 10, BJ: 10 };

/**
 * Digits after the dial code, in the form we store.
 *  - closed-plan markets keep their leading 0 (Benin's legacy 8-digit form gets "01")
 *  - everyone else loses any trunk 0
 */
const nationalNumber = (cc, rawNational) => {
  const n = String(rawNational || '');
  if (CLOSED_PLAN_LENGTH[cc]) return cc === 'BJ' && /^\d{8}$/.test(n) ? `01${n}` : n;
  return n.replace(/^0+/, '');
};

/** { '223': 'ML', … } — longest dial codes first so +245 isn't read as +24. */
const COUNTRY_BY_DIAL = Object.fromEntries(Object.entries(DIAL_CODES).map(([cc, d]) => [d, cc]));
const DIALS_LONGEST_FIRST = Object.keys(COUNTRY_BY_DIAL).sort((a, b) => b.length - a.length);

const compact = (phone) => String(phone || '').replace(/[\s().-]/g, '');

/** The market a "+<dial>…" number belongs to, or null. */
const countryOfPhone = (phone) => {
  const p = compact(phone);
  if (!p.startsWith('+')) return null;
  const digits = p.slice(1);
  const dial = DIALS_LONGEST_FIRST.find(d => digits.startsWith(d));
  return dial ? COUNTRY_BY_DIAL[dial] : null;
};

/**
 * Is `phone` a plausible number for `countryCode`?
 * @returns {{ok:boolean, reason?:string}}
 */
const checkPhoneForCountry = (phone, countryCode = 'NG') => {
  const cc = String(countryCode || 'NG').toUpperCase();
  const dial = DIAL_CODES[cc];
  if (!dial) return { ok: false, reason: 'Registration is not available for that country' };

  const p = compact(phone);

  if (cc === 'NG') {
    return NG_RE.test(p) ? { ok: true } : { ok: false, reason: 'Please enter a valid Nigerian phone number' };
  }

  if (!/^\+\d+$/.test(p)) {
    return { ok: false, reason: `Please enter your phone number with the +${dial} country code` };
  }
  if (!p.startsWith(`+${dial}`)) {
    return { ok: false, reason: `This phone number does not belong to the selected country (expected +${dial})` };
  }
  const national = nationalNumber(cc, p.slice(dial.length + 1));
  const closedLen = CLOSED_PLAN_LENGTH[cc];
  if (closedLen) {
    const shapeOk = cc === 'BJ' ? /^01\d{8}$/.test(national) : new RegExp(`^\\d{${closedLen}}$`).test(national);
    if (!shapeOk) {
      return { ok: false, reason: `Please enter your full ${closedLen}-digit number, including the leading ${cc === 'BJ' ? '01' : '0'}` };
    }
    return { ok: true };
  }
  if (!/^\d{6,12}$/.test(national)) {
    return { ok: false, reason: 'Please enter a valid phone number for your country' };
  }
  return { ok: true };
};

/** What we store: Nigeria as entered (legacy), everyone else as clean E.164. */
const normalizePhoneForStorage = (phone, countryCode = 'NG') => {
  const cc = String(countryCode || 'NG').toUpperCase();
  const p = compact(phone);
  if (cc === 'NG') return p;
  const dial = DIAL_CODES[cc];
  // Not a "+<this country's dial code>…" number (e.g. a profile edit to a foreign
  // number): leave it exactly as given rather than mangle it.
  if (!dial || !p.startsWith(`+${dial}`)) return p;
  return `+${dial}${nationalNumber(cc, p.slice(dial.length + 1))}`;
};

/**
 * Every E.164 form a stored number might be in for something a user typed
 * (used by lookups, which receive local-style input such as "0712345678").
 * @param {string} raw        what the user typed
 * @param {string} dialDigits the searching user's dial code without "+", e.g. "225"
 * @param {string} cc         the searching user's country code
 */
const phoneCandidates = (raw, dialDigits, cc = 'NG') => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return [];
  const stripped = digits.replace(/^0+/, '');
  const out = new Set([`+${digits}`, `+${dialDigits}${stripped}`, `+${dialDigits}${digits}`]);
  if (CLOSED_PLAN_LENGTH[String(cc).toUpperCase()]) {
    out.add(`+${dialDigits}${nationalNumber(String(cc).toUpperCase(), stripped)}`);     // BJ: "97 00 00 00" → 0197000000
    if (digits.startsWith(dialDigits)) {
      out.add(`+${dialDigits}${nationalNumber(String(cc).toUpperCase(), digits.slice(dialDigits.length))}`);
    }
  }
  return [...out];
};

/**
 * For routes that take ANY user's phone (login, profile, transfers, contacts):
 * accept it if it is a plausible international number for ANY market we serve,
 * or if the standard validator already accepts it (keeps every number that
 * worked before working).
 */
const isPhoneAcceptable = (value) => {
  const p = compact(value);
  if (!p) return false;
  if (validator && validator.isMobilePhone(p, 'any')) return true;
  const cc = countryOfPhone(p);
  return cc ? checkPhoneForCountry(p, cc).ok : false;
};

/** express-validator custom() for the register route: needs req.body.countryCode. */
const registrationPhoneCheck = (value, { req }) => {
  const r = checkPhoneForCountry(value, req.body?.countryCode || 'NG');
  if (!r.ok) throw new Error(r.reason);
  return true;
};

module.exports = { checkPhoneForCountry, normalizePhoneForStorage, phoneCandidates, isPhoneAcceptable, registrationPhoneCheck, countryOfPhone, CLOSED_PLAN_LENGTH };
