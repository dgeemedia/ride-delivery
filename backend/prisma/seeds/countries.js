// prisma/seeds/countries.js
//
// Country config is the switchboard for the whole app: currency, app
// language, which payment providers a market can charge through, which
// credit (top-up) methods the mobile app renders, and how drivers/partners
// get paid out.
//
// ── Orange markets ───────────────────────────────────────────────────────────
// Countries where Orange Money is the dominant rail list 'orange' FIRST in
// paymentProviders, so country.service ranks ORANGE_MONEY as the default
// method in the PaymentSelector. Paystack/Flutterwave stay listed as
// secondary fallbacks where they genuinely operate, so a customer whose
// Orange payment fails still has a working card option.
//
// ORANGE_MONEY is safe to seed before the merchant keys arrive: the app only
// renders it when orange.service.isOrangeConfigured() is true, so it stays
// hidden until the credentials are in .env.

const prisma = require('../../src/lib/prisma');

const CARD   = ['CASH', 'WALLET', 'PAYSTACK', 'FLUTTERWAVE'];
const FLW    = ['CASH', 'WALLET', 'FLUTTERWAVE'];
const OM_FLW = ['CASH', 'WALLET', 'ORANGE_MONEY', 'FLUTTERWAVE'];

const WEST_AFRICA_COUNTRIES = [
  // ── Card-first markets (no Orange presence) ────────────────────────────────
  { code: 'NG', name: 'Nigeria',       currencyCode: 'NGN', currencySymbol: '\u20A6', defaultLocale: 'en-NG', languageCode: 'en', phoneDialCode: '+234',
    paymentProviders: ['paystack', 'flutterwave'], creditMethods: CARD, payoutMethod: 'NG_BANK_TRANSFER', payoutMethods: ['NG_BANK_TRANSFER'] },

  { code: 'GH', name: 'Ghana',         currencyCode: 'GHS', currencySymbol: '\u20B5', defaultLocale: 'en-GH', languageCode: 'en', phoneDialCode: '+233',
    paymentProviders: ['paystack', 'flutterwave'], creditMethods: CARD, payoutMethod: 'UNSUPPORTED', payoutMethods: ['MANUAL'] },

  { code: 'GM', name: 'Gambia',        currencyCode: 'GMD', currencySymbol: 'D',   defaultLocale: 'en-GM', languageCode: 'en', phoneDialCode: '+220',
    paymentProviders: ['flutterwave'], creditMethods: FLW, payoutMethod: 'UNSUPPORTED', payoutMethods: ['MANUAL'] },

  { code: 'CV', name: 'Cape Verde',    currencyCode: 'CVE', currencySymbol: '$',   defaultLocale: 'pt-CV', languageCode: 'pt', phoneDialCode: '+238',
    paymentProviders: ['flutterwave'], creditMethods: FLW, payoutMethod: 'UNSUPPORTED', payoutMethods: ['MANUAL'] },

  { code: 'TG', name: 'Togo',          currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-TG', languageCode: 'fr', phoneDialCode: '+228',
    paymentProviders: ['flutterwave'], creditMethods: FLW, payoutMethod: 'UNSUPPORTED', payoutMethods: ['MANUAL'] },

  { code: 'BJ', name: 'Benin',         currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-BJ', languageCode: 'fr', phoneDialCode: '+229',
    paymentProviders: ['flutterwave'], creditMethods: FLW, payoutMethod: 'UNSUPPORTED', payoutMethods: ['MANUAL'] },

  // ── Orange Money markets ──────────────────────────────────────────────────
  { code: 'CI', name: "C\u00F4te d'Ivoire", currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-CI', languageCode: 'fr', phoneDialCode: '+225',
    paymentProviders: ['orange', 'paystack', 'flutterwave'],
    creditMethods: ['CASH', 'WALLET', 'ORANGE_MONEY', 'PAYSTACK', 'FLUTTERWAVE'],
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'ci', lang: 'fr' } } },

  { code: 'SN', name: 'Senegal',       currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-SN', languageCode: 'fr', phoneDialCode: '+221',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: OM_FLW,
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'sn', lang: 'fr' } } },

  { code: 'ML', name: 'Mali',          currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-ML', languageCode: 'fr', phoneDialCode: '+223',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: OM_FLW,
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'ml', lang: 'fr' } } },

  { code: 'BF', name: 'Burkina Faso',  currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-BF', languageCode: 'fr', phoneDialCode: '+226',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: OM_FLW,
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'bf', lang: 'fr' } } },

  { code: 'NE', name: 'Niger',         currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-NE', languageCode: 'fr', phoneDialCode: '+227',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: OM_FLW,
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'ne', lang: 'fr' } } },

  { code: 'GN', name: 'Guinea',        currencyCode: 'GNF', currencySymbol: 'FG',  defaultLocale: 'fr-GN', languageCode: 'fr', phoneDialCode: '+224',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: OM_FLW,
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'gn', lang: 'fr' } } },

  { code: 'GW', name: 'Guinea-Bissau', currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'pt-GW', languageCode: 'pt', phoneDialCode: '+245',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: OM_FLW,
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'gw', lang: 'pt' } } },

  { code: 'SL', name: 'Sierra Leone',  currencyCode: 'SLE', currencySymbol: 'Le',  defaultLocale: 'en-SL', languageCode: 'en', phoneDialCode: '+232',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: OM_FLW,
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'sl', lang: 'en' } } },

  { code: 'LR', name: 'Liberia',       currencyCode: 'LRD', currencySymbol: 'L$',  defaultLocale: 'en-LR', languageCode: 'en', phoneDialCode: '+231',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: OM_FLW,
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'],
    providerConfig: { orange: { webpayCountry: 'lr', lang: 'en' } } },
];

async function main() {
  for (const country of WEST_AFRICA_COUNTRIES) {
    const saved = await prisma.country.upsert({
      where:  { code: country.code },
      update: country,
      create: country,
    });
    const providers = Array.isArray(saved.paymentProviders) ? saved.paymentProviders.join('/') : '-';
    console.log(`\u2713 ${saved.code} - ${saved.name} (${providers}, payout: ${saved.payoutMethod}, lang: ${saved.languageCode})`);
  }
  console.log(`\nDone. ${WEST_AFRICA_COUNTRIES.length} countries seeded.`);
}

if (require.main === module) {
  main()
    .catch((err) => { console.error('Seed failed:', err); process.exitCode = 1; })
    .finally(async () => { await prisma.$disconnect(); });
}

module.exports = { WEST_AFRICA_COUNTRIES };
