// backend/src/utils/currency.js
'use strict';

const SYMBOLS = { NGN: '₦', GHS: '₵', XOF: 'CFA', GMD: 'D', GNF: 'FG', SLE: 'Le', LRD: 'L$', CVE: '$' };
const LOCALES = { NGN: 'en-NG', GHS: 'en-GH', XOF: 'fr-CI', GMD: 'en-GM', GNF: 'fr-GN', SLE: 'en-SL', LRD: 'en-LR', CVE: 'pt-CV' };

// XOF is shared by several countries with different official languages —
// the currency-keyed LOCALES map above can only pick one default (fr-CI).
// Override by country code for the ones that differ.
const COUNTRY_LOCALE_OVERRIDES = { GW: 'pt-GW' };

const formatMoney = (amount, currency = 'NGN', countryCode = null) => {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const locale = (countryCode && COUNTRY_LOCALE_OVERRIDES[countryCode]) || LOCALES[currency] || 'en-US';
  return `${symbol}${Number(amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

module.exports = { formatMoney, SYMBOLS, LOCALES, COUNTRY_LOCALE_OVERRIDES };