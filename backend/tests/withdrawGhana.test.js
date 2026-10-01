'use strict';
jest.mock('../src/lib/prisma', () => ({}));

const GH = { code: 'GH', name: 'Ghana', currencyCode: 'GHS', currencySymbol: '₵', defaultLocale: 'en-GH', phoneDialCode: '+233', isActive: true,
  paymentProviders: ['flutterwave'], creditMethods: ['CASH'], payoutMethods: ['MOBILE_MONEY', 'MANUAL'], payoutMethod: 'MOBILE_MONEY', languageCode: 'en' };
const GM = { ...GH, code: 'GM', name: 'Gambia', currencyCode: 'GMD', payoutMethods: ['MANUAL'], payoutMethod: 'UNSUPPORTED' };

const setup = ({ balance = 500, bonus = 0, country = GH } = {}) => {
  jest.resetModules();
  const made = { payouts: [], balance };
  const wrap = (fn) => (args) => async () => fn(args);
  const fake = {
    country: { findMany: async () => [GH, GM], findUnique: async ({ where }) => [GH, GM].find(c => c.code === where.code) ?? null },
    systemSettings: { findMany: async () => [] },
    countrySetting: { findMany: async () => [] },
    wallet: { findUnique: async () => ({ id: 'w1', userId: 'u1', balance: made.balance, currency: country.currencyCode }),
              update: wrap(({ data }) => { made.balance += data.balance.decrement ? -data.balance.decrement : data.balance.increment; }) },
    walletTransaction: { aggregate: async () => ({ _sum: { amount: bonus } }), create: wrap(() => ({})) },
    payout: { create: wrap(({ data }) => { made.payouts.push(data); return { id: 'po1', ...data }; }) },
    $transaction: async (ops) => { const out = []; for (const o of ops) out.push(await o()); return out; },
  };
  jest.doMock('../src/lib/prisma', () => fake);
  jest.doMock('../src/utils/auditLog', () => ({ logActivity: () => {} }));
  jest.doMock('../src/services/notification.service', () => ({ notify: async () => {}, TYPES: { PAYMENT_RECEIVED: 'p', WALLET_WITHDRAWAL: 'w' } }));
  jest.doMock('../src/services/email.service', () => ({}));
  jest.doMock('../src/utils/walletHelpers', () => ({ ensureWallet: async () => ({}), getWithdrawableBalance: jest.requireActual('../src/utils/walletHelpers').getWithdrawableBalance }));
  require('../src/services/country.service').invalidateCountryCache();
  return { ctrl: require('../src/controllers/wallet.controller'), made };
};
const call = async (ctrl, body, user = {}) => {
  const out = {};
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  try { await ctrl.withdraw({ user: { id: 'u1', role: 'DRIVER', countryCode: 'GH', firstName: 'Kofi', lastName: 'Mensah', email: null, ...user }, body }, res); }
  catch (e) { out.error = e; }
  return out;
};

test('Ghana driver withdraws to MTN mobile money: destination saved as a full 233… number on the MTN rail', async () => {
  const { ctrl, made } = setup();
  const r = await call(ctrl, { amount: 200, mobileNumber: '024 123 4567', bankCode: 'MTN' });
  expect(r.error).toBeUndefined();
  expect(r.status).toBe(200);
  const p = made.payouts[0];
  expect(p).toMatchObject({ accountNumber: '233241234567', bankCode: 'MTN', bankName: 'MTN Mobile Money', payoutMethod: 'MOBILE_MONEY', currency: 'GHS', accountName: 'Kofi Mensah' });
  expect(p.payoutDetails).toMatchObject({ rail: 'MOBILE_MONEY', msisdn: '233241234567', grossAmount: 200 });
  expect(made.balance).toBe(300);                           // wallet debited immediately
});

test('rejects a bad number, a missing or unknown network — and debits nothing', async () => {
  for (const [body, msg] of [
    [{ amount: 200, mobileNumber: '123', bankCode: 'MTN' }, /valid mobile-money number/],
    [{ amount: 200, mobileNumber: '0241234567' }, /Choose your mobile-money network/],
    [{ amount: 200, mobileNumber: '0241234567', bankCode: 'ORANGE' }, /Choose your mobile-money network/],
    [{ amount: 200 }, /number is required/],
  ]) {
    const { ctrl, made } = setup();
    const r = await call(ctrl, body);
    expect(r.error?.message).toMatch(msg);
    expect(made.payouts).toHaveLength(0);
    expect(made.balance).toBe(500);
  }
});

test('onboarding bonus cannot be withdrawn', async () => {
  const { ctrl, made } = setup({ balance: 500, bonus: 400 });     // only 100 is real money
  const r = await call(ctrl, { amount: 200, mobileNumber: '0241234567', bankCode: 'MTN' });
  expect(r.error?.message).toMatch(/can withdraw up to/);
  expect(made.payouts).toHaveLength(0);
});

test('a MANUAL-only country still takes free-text details', async () => {
  const { ctrl, made } = setup({ country: GM });
  const r = await call(ctrl, { amount: 200, accountNumber: '123456789', bankName: 'Trust Bank', accountName: 'Awa Jallow' }, { countryCode: 'GM' });
  expect(r.error).toBeUndefined();
  expect(made.payouts[0]).toMatchObject({ payoutMethod: 'MANUAL', bankName: 'Trust Bank' });
});
