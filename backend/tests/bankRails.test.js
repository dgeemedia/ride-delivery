'use strict';
jest.mock('../src/lib/prisma', () => ({}));
jest.mock('axios');

const C = (code, name, cur, methods, extra = {}) => ({ code, name, currencyCode: cur, currencySymbol: cur, defaultLocale: 'en', phoneDialCode: '+1', isActive: true,
  paymentProviders: ['flutterwave'], creditMethods: ['CASH'], payoutMethods: methods, payoutMethod: methods[0], languageCode: 'fr', ...extra });
const SN = C('SN', 'Senegal', 'XOF', ['ORANGE_MONEY', 'BANK_TRANSFER', 'MANUAL']);
const GH = C('GH', 'Ghana',   'GHS', ['MOBILE_MONEY', 'BANK_TRANSFER', 'MANUAL']);
const ML = C('ML', 'Mali',    'XOF', ['ORANGE_MONEY', 'MANUAL']);
const NG = C('NG', 'Nigeria', 'NGN', ['NG_BANK_TRANSFER']);
const GM = C('GM', 'Gambia',  'GMD', ['MANUAL']);

describe('which options a country offers the person', () => {
  const rails = (c) => { jest.resetModules(); return require('../src/services/country.service').payoutRails(c); };
  test.each([[SN, ['ORANGE', 'BANK']], [GH, ['MOMO', 'BANK']], [ML, ['ORANGE']], [NG, ['BANK']], [GM, ['MANUAL']]])(
    '%# → %j', (c, want) => expect(rails(c)).toEqual(want));
  test('MANUAL is only shown when it is the only option', () => {
    expect(rails(C('XX', 'X', 'XOF', ['ORANGE_MONEY', 'MANUAL']))).not.toContain('MANUAL');
    expect(rails(C('XX', 'X', 'XOF', ['UNSUPPORTED']))).toEqual(['MANUAL']);
  });
});

describe('payouts are routed by the method the user chose', () => {
  let ps; beforeAll(() => { jest.resetModules(); process.env.PAYOUT_PROVIDER = 'paystack'; ps = require('../src/services/payment.service'); });
  test('a Senegalese BANK payout goes to Flutterwave, an Orange payout to Orange — same country', () => {
    expect(ps.providerForMethod('BANK_TRANSFER', SN)).toBe('flutterwave');
    expect(ps.providerForMethod('ORANGE_MONEY', SN)).toBe('orange');
    expect(ps.providerForMethod('MOBILE_MONEY', GH)).toBe('flutterwave');
    expect(ps.providerForMethod('MANUAL', GM)).toBe('manual');
    expect(ps.providerForMethod('NG_BANK_TRANSFER', NG)).toBe('paystack');
    expect(ps.resolvePayoutProviderForCountry(SN, 'BANK_TRANSFER')).toBe('flutterwave');
    expect(ps.resolvePayoutProviderForCountry(SN)).toBe('orange');     // legacy rows without a method
  });
});

describe('Flutterwave bank transfer outside Nigeria', () => {
  const load = ({ banks, branches, branchesError } = {}) => {
    jest.resetModules();
    process.env.FLUTTERWAVE_SECRET_KEY = 'flw';
    const axios = require('axios');
    const posts = []; const gets = [];
    const inst = {
      get: jest.fn(async (url) => {
        gets.push(url);
        if (url.startsWith('/banks/') && url.endsWith('/branches')) { if (branchesError) throw new Error('boom'); return { data: { status: 'success', data: branches } }; }
        return { data: { status: 'success', data: banks } };
      }),
      post: jest.fn(async (url, body) => { posts.push([url, body]); return { data: { status: 'success', data: { id: 5, reference: body.reference } } }; }),
      interceptors: { request: { use() {} }, response: { use() {} } },
    };
    axios.create = jest.fn(() => inst);
    return { ps: require('../src/services/payment.service'), posts, gets };
  };
  const BANKS = [{ id: 11, code: 'SN094000', name: 'Ecobank Sénégal' }, { id: 12, code: 'SN001', name: 'CBAO' }];
  const base = { amount: 9750, accountNumber: 'SN0123456789', bankCode: 'SN094000', accountName: 'Awa Ndiaye', reference: 'WD-9', currency: 'XOF', country: SN, method: 'BANK_TRANSFER', reason: 'w' };

  test('sends account_bank, the typed name, and the bank\'s head-office branch code', async () => {
    const { ps, posts } = load({ banks: BANKS, branches: [{ branch_code: 'B2', branch_name: 'Agence Kermel' }, { branch_code: 'B1', branch_name: 'Siège Principal' }] });
    const r = await ps.initiatePayoutTransfer(base);
    expect(posts[0][0]).toBe('/transfers');
    expect(posts[0][1]).toMatchObject({ account_bank: 'SN094000', account_number: 'SN0123456789', beneficiary_name: 'Awa Ndiaye', currency: 'XOF', amount: 9750, destination_branch_code: 'B1' });
    expect(r.provider).toBe('flutterwave');
  });
  test('a bank with one branch uses it', async () => {
    const { ps, posts } = load({ banks: BANKS, branches: [{ branch_code: 'ONLY', branch_name: 'Plateau' }] });
    await ps.initiatePayoutTransfer(base);
    expect(posts[0][1].destination_branch_code).toBe('ONLY');
  });
  test('cannot determine a branch → NOTHING is sent; the error tells the admin to settle manually', async () => {
    for (const opts of [{ banks: BANKS, branches: [] }, { banks: BANKS, branchesError: true }, { banks: [], branches: [] }]) {
      const { ps, posts } = load(opts);
      await expect(ps.initiatePayoutTransfer(base)).rejects.toThrow(/manually/);
      expect(posts).toHaveLength(0);
    }
  });
  test('Nigeria and countries that do not need a branch never ask for one', async () => {
    const { ps, gets } = load({ banks: [] });
    expect(await ps.resolveFlutterwaveBranchCode('NG', '044')).toBeNull();
    expect(await ps.resolveFlutterwaveBranchCode('ML', 'X')).toBeNull();
    expect(gets).toHaveLength(0);
  });
  test('the bank list is Flutterwave\'s own, per rail; verification falls back to "unverified"', async () => {
    const { ps } = load({ banks: BANKS });
    expect((await ps.listBanksUnified('SN', SN, 'BANK')).map(b => b.code)).toEqual(['SN094000', 'SN001']);
    expect((await ps.listBanksUnified('SN', SN, 'ORANGE'))[0].code).toBe('ORANGE_MONEY');
    expect((await ps.listBanksUnified('GH', GH, 'MOMO')).map(b => b.code)).toEqual(['MTN', 'VODAFONE', 'AIRTELTIGO']);
    expect(await ps.verifyBankAccountUnified('SN0123456789', 'SN094000', 'SN', SN, 'BANK')).toMatchObject({ account_name: null, unverifiedName: true });
  });
});

describe('withdrawal request: choosing a rail', () => {
  const setup = (country, { bankName = 'Ecobank Sénégal' } = {}) => {
    jest.resetModules();
    const made = { payouts: [], balance: 500000 };
    const wrap = (fn) => (a) => async () => fn(a);
    const fake = {
      country: { findMany: async () => [SN, GH, ML, NG, GM], findUnique: async ({ where }) => [SN, GH, ML, NG, GM].find(c => c.code === where.code) ?? null },
      systemSettings: { findMany: async () => [] }, countrySetting: { findMany: async () => [] },
      wallet: { findUnique: async () => ({ id: 'w1', userId: 'u1', balance: made.balance, currency: country.currencyCode }), update: wrap(({ data }) => { made.balance -= data.balance.decrement ?? 0; }) },
      walletTransaction: { aggregate: async () => ({ _sum: { amount: 0 } }), create: wrap(() => ({})) },
      payout: { create: wrap(({ data }) => { made.payouts.push(data); return { id: 'po1', ...data }; }) },
      $transaction: async (ops) => { const out = []; for (const o of ops) out.push(await o()); return out; },
    };
    jest.doMock('../src/lib/prisma', () => fake);
    jest.doMock('../src/utils/auditLog', () => ({ logActivity: () => {} }));
    jest.doMock('../src/services/notification.service', () => ({ notify: async () => {}, TYPES: { PAYMENT_RECEIVED: 'p', WALLET_WITHDRAWAL: 'w' } }));
    jest.doMock('../src/services/email.service', () => ({}));
    jest.doMock('../src/utils/walletHelpers', () => ({ ensureWallet: async () => ({}), getWithdrawableBalance: async (w) => w.balance }));
    const realPs = jest.requireActual('../src/services/payment.service');
    jest.doMock('../src/services/payment.service', () => ({ ...realPs, resolveBankName: async (code) => (code === 'SN094000' ? bankName : null) }));
    require('../src/services/country.service').invalidateCountryCache();
    return { ctrl: require('../src/controllers/wallet.controller'), made };
  };
  const call = async (ctrl, body, cc) => {
    const out = {}; const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    try { await ctrl.withdraw({ user: { id: 'u1', role: 'DRIVER', countryCode: cc, firstName: 'Awa', lastName: 'Ndiaye' }, body }, res); } catch (e) { out.error = e; }
    return out;
  };

  test('Senegal → BANK: stored as BANK_TRANSFER with the typed name flagged unverified, provider flutterwave', async () => {
    const { ctrl, made } = setup(SN);
    const r = await call(ctrl, { amount: 20000, rail: 'BANK', accountNumber: 'SN01 2345 6789', bankCode: 'SN094000', accountName: 'Awa Ndiaye' }, 'SN');
    expect(r.error).toBeUndefined();
    expect(made.payouts[0]).toMatchObject({ payoutMethod: 'BANK_TRANSFER', accountNumber: 'SN0123456789', bankCode: 'SN094000', bankName: 'Ecobank Sénégal', accountName: 'Awa Ndiaye' });
    expect(made.payouts[0].payoutDetails).toMatchObject({ rail: 'BANK_TRANSFER', nameVerified: false });
  });
  test('Senegal → ORANGE still works and is the default when no rail is sent (old app versions)', async () => {
    for (const body of [{ amount: 20000, rail: 'ORANGE', mobileNumber: '77 123 45 67' }, { amount: 20000, mobileNumber: '77 123 45 67' }]) {
      const { ctrl, made } = setup(SN);
      const r = await call(ctrl, body, 'SN');
      expect(r.error).toBeUndefined();
      expect(made.payouts[0]).toMatchObject({ payoutMethod: 'ORANGE_MONEY', bankName: 'Orange Money' });
    }
  });
  test('rejects: option the country does not offer, unknown bank, missing/short name, bad account number', async () => {
    const cases = [
      [SN, 'SN', { amount: 20000, rail: 'MOMO', mobileNumber: '0241234567', bankCode: 'MTN' }, /not available/],
      [ML, 'ML', { amount: 20000, rail: 'BANK', accountNumber: 'ML123456', bankCode: 'X', accountName: 'Moussa K' }, /not available/],
      [SN, 'SN', { amount: 20000, rail: 'BANK', accountNumber: 'SN0123456789', bankCode: 'FAKE', accountName: 'Awa Ndiaye' }, /Choose your bank/],
      [SN, 'SN', { amount: 20000, rail: 'BANK', accountNumber: 'SN0123456789', bankCode: 'SN094000' }, /name on the account/],
      [SN, 'SN', { amount: 20000, rail: 'BANK', accountNumber: '12', bankCode: 'SN094000', accountName: 'Awa Ndiaye' }, /valid bank account/],
    ];
    for (const [c, cc, body, msg] of cases) {
      const { ctrl, made } = setup(c);
      const r = await call(ctrl, body, cc);
      expect(r.error?.message).toMatch(msg);
      expect(made.payouts).toHaveLength(0);
      expect(made.balance).toBe(500000);                 // nothing debited
    }
  });
  test('Ghana offers MoMo and bank; a MoMo request works when both are offered', async () => {
    const { ctrl, made } = setup(GH, { bankName: 'GCB Bank' });
    jest.resetModules();
    const r = await call(ctrl, { amount: 20000, rail: 'MOMO', mobileNumber: '0241234567', bankCode: 'MTN' }, 'GH');
    expect(r.error).toBeUndefined();
    expect(made.payouts[0].payoutMethod).toBe('MOBILE_MONEY');
  });
});
