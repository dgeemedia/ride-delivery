'use strict';
// Regression: authenticate() must load countryCode, otherwise every country-aware
// lookup (payment options, limits, transfer minimums…) silently treats a Malian,
// Ivorian or Senegalese user as Nigerian — the Mali top-up screen showed Paystack.
jest.mock('../src/lib/prisma', () => ({}));

const FULL_USER = {
  id: 'u1', email: 'a@b.co', phone: '+22376427484', firstName: 'Andrey', lastName: 'Diarra',
  role: 'CUSTOMER', isVerified: true, isActive: true, adminDepartment: null, passwordChangedAt: null,
  countryCode: 'ML',
};
const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', currencyCode: 'NGN', currencySymbol: '₦', languageCode: 'en', defaultLocale: 'en-NG',
    paymentProviders: ['paystack', 'flutterwave'], creditMethods: ['CASH', 'WALLET', 'PAYSTACK', 'FLUTTERWAVE'],
    payoutMethod: 'NG_BANK_TRANSFER', payoutMethods: ['NG_BANK_TRANSFER'], providerConfig: {}, isActive: true, phoneDialCode: '+234' },
  { code: 'ML', name: 'Mali', currencyCode: 'XOF', currencySymbol: 'CFA', languageCode: 'fr', defaultLocale: 'fr-ML',
    paymentProviders: ['orange', 'flutterwave'], creditMethods: ['CASH', 'WALLET', 'ORANGE_MONEY', 'FLUTTERWAVE'],
    payoutMethod: 'ORANGE_MONEY', payoutMethods: ['ORANGE_MONEY', 'MANUAL'], providerConfig: {}, isActive: true, phoneDialCode: '+223' },
];

const setup = () => {
  jest.resetModules();
  process.env.JWT_SECRET = 'test-secret';
  let lastSelect = null;
  const fake = {
    // Behaves like Prisma: returns ONLY the fields named in `select`.
    user: { findUnique: async ({ select }) => { lastSelect = select; return Object.fromEntries(Object.keys(select).filter(k => select[k]).map(k => [k, FULL_USER[k]])); } },
    country: { findMany: async () => COUNTRIES },
  };
  jest.doMock('../src/lib/prisma', () => fake);
  jest.doMock('../src/utils/auditLog', () => ({ logActivity: () => {} }));
  jest.doMock('jsonwebtoken', () => ({ verify: () => ({ userId: 'u1', iat: 1 }) }));
  jest.doMock('../src/services/orange.service', () => ({ isOrangeConfigured: () => true }));
  return { auth: require('../src/middleware/auth.middleware'), countryService: require('../src/services/country.service'), getSelect: () => lastSelect };
};

const run = async (auth) => {
  const req = { headers: { authorization: 'Bearer x' } };
  let status = null; const res = { status(c) { status = c; return this; }, json() { return this; } };
  await auth.authenticate(req, res, () => {});
  return { req, status };
};

test('authenticate loads countryCode onto req.user', async () => {
  const { auth, getSelect } = setup();
  const { req } = await run(auth);
  expect(getSelect().countryCode).toBe(true);
  expect(req.user.countryCode).toBe('ML');
});

test('a Mali user gets Mali payment options — Orange + Flutterwave, never Paystack', async () => {
  const { auth, countryService } = setup();
  const { req } = await run(auth);
  const cfg = await countryService.getPaymentConfigForUser(req.user);
  expect(cfg.countryCode).toBe('ML');
  expect(cfg.currencyCode).toBe('XOF');
  expect(cfg.languageCode).toBe('fr');
  expect(cfg.creditMethods).toEqual(expect.arrayContaining(['ORANGE_MONEY', 'FLUTTERWAVE']));
  expect(cfg.creditMethods).not.toContain('PAYSTACK');
});

test('country-aware helpers resolve Mali for the authenticated user', async () => {
  const { auth, countryService } = setup();
  const { req } = await run(auth);
  expect((await countryService.getCountryForUser(req.user)).code).toBe('ML');
});
