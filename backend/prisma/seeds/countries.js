// prisma/seeds/countries.js
const prisma = require('../../src/lib/prisma');

const WEST_AFRICA_COUNTRIES = [
  { code: 'NG', name: 'Nigeria',       currencyCode: 'NGN', currencySymbol: '₦',  defaultLocale: 'en-NG', phoneDialCode: '+234', paymentProviders: ['paystack', 'flutterwave'], payoutMethod: 'NG_BANK_TRANSFER' },
  { code: 'GH', name: 'Ghana',         currencyCode: 'GHS', currencySymbol: '₵',  defaultLocale: 'en-GH', phoneDialCode: '+233', paymentProviders: ['paystack', 'flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'CI', name: "Côte d'Ivoire", currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-CI', phoneDialCode: '+225', paymentProviders: ['paystack', 'flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'SN', name: 'Senegal',       currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-SN', phoneDialCode: '+221', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'BF', name: 'Burkina Faso',  currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-BF', phoneDialCode: '+226', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'ML', name: 'Mali',          currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-ML', phoneDialCode: '+223', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'TG', name: 'Togo',          currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-TG', phoneDialCode: '+228', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'BJ', name: 'Benin',         currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-BJ', phoneDialCode: '+229', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'NE', name: 'Niger',         currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-NE', phoneDialCode: '+227', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'GW', name: 'Guinea-Bissau', currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'pt-GW', phoneDialCode: '+245', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'GN', name: 'Guinea',        currencyCode: 'GNF', currencySymbol: 'FG', defaultLocale: 'fr-GN', phoneDialCode: '+224', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'GM', name: 'Gambia',        currencyCode: 'GMD', currencySymbol: 'D',  defaultLocale: 'en-GM', phoneDialCode: '+220', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'SL', name: 'Sierra Leone',  currencyCode: 'SLE', currencySymbol: 'Le', defaultLocale: 'en-SL', phoneDialCode: '+232', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'LR', name: 'Liberia',       currencyCode: 'LRD', currencySymbol: 'L$', defaultLocale: 'en-LR', phoneDialCode: '+231', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
  { code: 'CV', name: 'Cape Verde',    currencyCode: 'CVE', currencySymbol: '$',  defaultLocale: 'pt-CV', phoneDialCode: '+238', paymentProviders: ['flutterwave'], payoutMethod: 'UNSUPPORTED' },
];

async function main() {
  for (const country of WEST_AFRICA_COUNTRIES) {
    const saved = await prisma.country.upsert({
      where:  { code: country.code },
      update: country,
      create: country,
    });
    console.log(`✓ Seeded ${saved.code} — ${saved.name} (payout: ${saved.payoutMethod})`);
  }
  console.log(`\nDone. ${WEST_AFRICA_COUNTRIES.length} countries seeded.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

module.exports = { WEST_AFRICA_COUNTRIES };