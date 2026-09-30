// Minimal in-memory stand-in for the parts of Prisma the per-country code uses.
// Lets us test real resolution / validation / write logic without a database.
'use strict';

const makeFakePrisma = ({ countries = [], systemSettings = [], countrySettings = [] } = {}) => {
  const db = {
    countries:       countries.map(c => ({ ...c })),
    systemSettings:  systemSettings.map(s => ({ ...s })),
    countrySettings: countrySettings.map(s => ({ ...s })),
  };

  const fake = {
    _db: db,
    country: {
      findMany:   async () => db.countries.map(c => ({ ...c })),
      findUnique: async ({ where }) => db.countries.find(c => c.code === where.code) ?? null,
    },
    systemSettings: {
      findMany: async ({ where } = {}) => {
        const keys = where?.key?.in;
        return db.systemSettings.filter(s => !keys || keys.includes(s.key));
      },
    },
    countrySetting: {
      findMany: async ({ where }) => db.countrySettings.filter(s => s.countryCode === where.countryCode),
      upsert: ({ where, update, create }) => async () => {
        const { countryCode, key } = where.countryCode_key;
        const row = db.countrySettings.find(s => s.countryCode === countryCode && s.key === key);
        if (row) Object.assign(row, update);
        else db.countrySettings.push({ ...create });
      },
      deleteMany: ({ where }) => async () => {
        db.countrySettings = db.countrySettings.filter(
          s => !(s.countryCode === where.countryCode && where.key.in.includes(s.key)));
      },
    },
    // Real Prisma builds lazy operations; the fake runs the thunks in order.
    $transaction: async (ops) => { for (const op of ops) await op(); },
  };
  return fake;
};

const COUNTRIES = {
  NG: { code: 'NG', name: 'Nigeria', currencyCode: 'NGN', currencySymbol: '₦', defaultLocale: 'en-NG', phoneDialCode: '+234', isActive: true, paymentProviders: ['paystack'], payoutMethod: 'NG_BANK_TRANSFER', languageCode: 'en' },
  ML: { code: 'ML', name: 'Mali',    currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-ML', phoneDialCode: '+223', isActive: true, paymentProviders: ['orange'], payoutMethod: 'ORANGE_MONEY', languageCode: 'fr' },
  GN: { code: 'GN', name: 'Guinea',  currencyCode: 'GNF', currencySymbol: 'FG',  defaultLocale: 'fr-GN', phoneDialCode: '+224', isActive: true, paymentProviders: ['orange'], payoutMethod: 'ORANGE_MONEY', languageCode: 'fr' },
  GH: { code: 'GH', name: 'Ghana',   currencyCode: 'GHS', currencySymbol: '₵',  defaultLocale: 'en-GH', phoneDialCode: '+233', isActive: true, paymentProviders: ['paystack'], payoutMethod: 'UNSUPPORTED', languageCode: 'en' },
};

module.exports = { makeFakePrisma, COUNTRIES };
