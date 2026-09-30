// backend/src/utils/currency.js
'use strict';

const SYMBOLS = {
  NGN: '₦', GHS: '₵', XOF: 'CFA', XAF: 'FCFA', GMD: 'D', GNF: 'FG', SLE: 'Le',
  LRD: 'L$', CVE: '$', MGA: 'Ar', CDF: 'FC', BWP: 'P',
};
const LOCALES = {
  NGN: 'en-NG', GHS: 'en-GH', XOF: 'fr-CI', XAF: 'fr-CM', GMD: 'en-GM', GNF: 'fr-GN',
  SLE: 'en-SL', LRD: 'en-LR', CVE: 'pt-CV', MGA: 'fr-MG', CDF: 'fr-CD', BWP: 'en-BW',
};

// XOF/XAF are shared by several countries with different official languages —
// the currency-keyed LOCALES map above can only pick one default. Override by
// country code for the ones that differ.
const COUNTRY_LOCALE_OVERRIDES = { GW: 'pt-GW', CF: 'fr-CF', ML: 'fr-ML', SN: 'fr-SN' };

// Currencies with no usable minor unit. Orange Money (and most mobile-money
// rails in these markets) reject decimals outright, so amounts in these
// currencies must be whole numbers — see assertWholeUnits in wallet.controller.
const WHOLE_UNIT_CURRENCIES = ['XOF', 'XAF', 'GNF', 'MGA', 'CDF'];

// Smallest sensible price increment per currency. Fares are rounded to this
// (it replaces the old hard-coded "round to 50", which only makes sense for
// Naira). Admins can override it per country via `price_rounding_step`.
const DEFAULT_ROUNDING_STEP = {
  NGN: 50, GHS: 0.5, XOF: 25, XAF: 25, GNF: 500, SLE: 0.5,
  LRD: 10, GMD: 2, CVE: 10, MGA: 100, CDF: 100, BWP: 0.5,
};

const isWholeUnitCurrency = (currency) => WHOLE_UNIT_CURRENCIES.includes(String(currency).toUpperCase());

const formatMoney = (amount, currency = 'NGN', countryCode = null) => {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const locale = (countryCode && COUNTRY_LOCALE_OVERRIDES[countryCode]) || LOCALES[currency] || 'en-US';
  const whole = isWholeUnitCurrency(currency);
  return `${symbol}${Number(amount).toLocaleString(locale, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
};

module.exports = {
  formatMoney, SYMBOLS, LOCALES, COUNTRY_LOCALE_OVERRIDES,
  WHOLE_UNIT_CURRENCIES, DEFAULT_ROUNDING_STEP, isWholeUnitCurrency,
};
