'use strict';
jest.mock('../src/lib/prisma', () => ({}));
jest.mock('axios');

const GH = { code: 'GH', name: 'Ghana', currencyCode: 'GHS', currencySymbol: '₵', defaultLocale: 'en-GH', phoneDialCode: '+233', isActive: true,
  paymentProviders: ['flutterwave'], creditMethods: ['CASH'], payoutMethods: ['MOBILE_MONEY', 'MANUAL'], payoutMethod: 'MOBILE_MONEY', languageCode: 'en' };

describe('phone numbers', () => {
  const { normalizeMsisdn, isValidMsisdn } = require('../src/utils/msisdn');
  test.each([
    ['024 123 4567', '233241234567'], ['0241234567', '233241234567'], ['+233 24 123 4567', '233241234567'],
    ['233241234567', '233241234567'], ['241234567', '233241234567'], ['00233241234567', '233241234567'],
  ])('%s → %s', (raw, want) => expect(normalizeMsisdn(raw, 'GH')).toBe(want));

  test('validity: Ghana numbers are exactly 9 digits after 233', () => {
    expect(isValidMsisdn('0241234567', 'GH')).toBe(true);
    expect(isValidMsisdn('024123456', 'GH')).toBe(false);      // too short
    expect(isValidMsisdn('02412345678', 'GH')).toBe(false);    // too long
    expect(isValidMsisdn('', 'GH')).toBe(false);
    expect(isValidMsisdn('abc', 'GH')).toBe(false);
    expect(isValidMsisdn('0241234567', 'ZZ')).toBe(false);     // unknown country never guesses a dial code
  });
  test('a number is never given another country’s dial code', () => {
    expect(normalizeMsisdn('0701234567', 'NG')).toBe('2347012345 67'.replace(' ', ''));
  });
});

describe('Flutterwave mobile-money transfer', () => {
  const load = async (banksResult) => {
    jest.resetModules();
    process.env.FLUTTERWAVE_SECRET_KEY = 'flw';
    const axios = require('axios');
    const calls = { post: [] };
    const inst = {
      get:  jest.fn(async () => { if (banksResult instanceof Error) throw banksResult; return { data: { status: 'success', data: banksResult } }; }),
      post: jest.fn(async (url, body) => { calls.post.push([url, body]); return { data: { status: 'success', data: { id: 99, reference: body.reference } } }; }),
      interceptors: { request: { use() {} }, response: { use() {} } },
    };
    axios.create = jest.fn(() => inst);
    const ps = require('../src/services/payment.service');
    return { ps, calls };
  };

  test('uses the operator code Flutterwave lists, and a full 233… number', async () => {
    const { ps, calls } = await load([{ code: 'MTN', name: 'MTN MOBILE MONEY' }, { code: 'VOD', name: 'VODAFONE CASH' }, { code: 'ATL', name: 'AIRTELTIGO MONEY' }, { code: '044', name: 'Access Bank' }]);
    const r = await ps.initiatePayoutTransfer({ amount: 97, accountNumber: '0241234567', bankCode: 'VODAFONE', accountName: 'Kofi A', reference: 'WD-1', currency: 'GHS', country: GH, reason: 'w' });
    const [url, body] = calls.post[0];
    expect(url).toBe('/transfers');
    expect(body).toMatchObject({ account_bank: 'VOD', account_number: '233241234567', amount: 97, currency: 'GHS', beneficiary_name: 'Kofi A', reference: 'WD-1' });
    expect(r).toMatchObject({ provider: 'flutterwave', transferCode: '99' });
  });

  test('falls back to the documented operator name if the bank list is unavailable', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { ps, calls } = await load(new Error('network down'));
      await ps.initiatePayoutTransfer({ amount: 10, accountNumber: '0551234567', bankCode: 'MTN', accountName: 'A', reference: 'r', currency: 'GHS', country: GH });
      expect(calls.post[0][1].account_bank).toBe('MTN');
      expect(errSpy).toHaveBeenCalled(); // the fallback is logged, just not printed to the test output
    } finally {
      errSpy.mockRestore();
    }
  });

  test('never sends money for a bad number or an unknown network', async () => {
    const { ps, calls } = await load([]);
    await expect(ps.initiatePayoutTransfer({ amount: 1, accountNumber: '123', bankCode: 'MTN', accountName: 'A', reference: 'r', country: GH })).rejects.toThrow(/not valid/);
    await expect(ps.initiatePayoutTransfer({ amount: 1, accountNumber: '0241234567', bankCode: 'ORANGE', accountName: 'A', reference: 'r', country: GH })).rejects.toThrow(/Unknown mobile-money network/);
    expect(calls.post).toHaveLength(0);
  });

  test('Ghana always settles through Flutterwave, offers exactly three networks, and validates numbers', async () => {
    const { ps } = await load([]);
    process.env.PAYOUT_PROVIDER = 'paystack';
    expect(ps.resolvePayoutProviderForCountry(GH)).toBe('flutterwave');
    const nets = await ps.listBanksUnified('GH', GH);
    expect(nets.map(n => n.code)).toEqual(['MTN', 'VODAFONE', 'AIRTELTIGO']);
    expect((await ps.verifyBankAccountUnified('0241234567', 'MTN', 'GH', GH)).account_number).toBe('233241234567');
    await expect(ps.verifyBankAccountUnified('12', 'MTN', 'GH', GH)).rejects.toThrow(/valid mobile-money/);
    delete process.env.PAYOUT_PROVIDER;
  });
});

describe('failed transfers are refunded exactly once', () => {
  const setup = (payout) => {
    jest.resetModules();
    const state = { wallet: 1000, payout: { ...payout }, refunds: [], notified: [] };
    const fake = {
      payout: {
        findFirst: async ({ where }) => (where.reference === state.payout.reference ? { ...state.payout } : null),
        update: ({ data }) => async () => Object.assign(state.payout, data),
      },
      wallet: {
        findUnique: async () => ({ id: 'w1', userId: 'u1', balance: state.wallet }),
        update: ({ data }) => async () => { state.wallet += data.balance.increment; },
      },
      walletTransaction: {
        updateMany: () => async () => {},
        create: ({ data }) => async () => {
          if (state.refunds.includes(data.reference)) { const e = new Error('dup'); e.code = 'P2002'; throw e; }
          state.refunds.push(data.reference);
        },
      },
      // real Prisma rolls back on error; mimic by snapshotting
      $transaction: async (ops) => {
        const snap = JSON.stringify({ w: state.wallet, p: state.payout, r: state.refunds });
        try { for (const op of ops) await op(); }
        catch (e) { const s = JSON.parse(snap); state.wallet = s.w; state.payout = s.p; state.refunds = s.r; throw e; }
      },
    };
    jest.doMock('../src/lib/prisma', () => fake);
    jest.doMock('../src/utils/auditLog', () => ({ logActivity: () => {} }));
    jest.doMock('../src/services/notification.service', () => ({ notify: async (n) => { state.notified.push(n); }, TYPES: { WALLET_WITHDRAWAL: 'w' } }));
    return { svc: require('../src/services/payoutSettlement.service'), state };
  };
  const base = { id: 'p1', userId: 'u1', reference: 'WD-1', status: 'COMPLETED', amount: 9750, currency: 'GHS', payoutDetails: { grossAmount: 10000, fee: 250 } };

  test('FAILED: the full amount (incl. fee) goes back to the wallet and the user is told', async () => {
    const { svc, state } = setup(base);
    const r = await svc.applyTransferResult({ reference: 'WD-1', outcome: 'FAILED', message: 'Invalid number' });
    expect(r.action).toBe('refunded');
    expect(state.wallet).toBe(11000);
    expect(state.payout.status).toBe('FAILED');
    expect(state.notified[0].message).toMatch(/returned to your wallet/);
  });
  test('the provider retrying the webhook never refunds twice', async () => {
    const { svc, state } = setup(base);
    await svc.applyTransferResult({ reference: 'WD-1', outcome: 'FAILED' });
    const again = await svc.applyTransferResult({ reference: 'WD-1', outcome: 'FAILED' });
    expect(again.action).toBe('already-refunded');
    expect(state.wallet).toBe(11000);
  });
  test('SUCCESS confirms; a late SUCCESS after a failure is ignored; unknown references are ignored', async () => {
    const a = setup({ ...base, status: 'PROCESSING' });
    expect((await a.svc.applyTransferResult({ reference: 'WD-1', outcome: 'SUCCESS' })).action).toBe('completed');
    expect(a.state.payout.status).toBe('COMPLETED');
    const b = setup({ ...base, status: 'FAILED' });
    expect((await b.svc.applyTransferResult({ reference: 'WD-1', outcome: 'SUCCESS' })).action).toBe('ignored-after-failure');
    expect((await b.svc.applyTransferResult({ reference: 'NOPE', outcome: 'FAILED' })).handled).toBe(false);
    expect(b.state.wallet).toBe(1000);
  });
});