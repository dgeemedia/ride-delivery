'use strict';
jest.mock('../src/lib/prisma', () => ({}));

const base = (over) => ({ code: 'XX', name: 'X', payoutMethod: 'UNSUPPORTED', payoutMethods: ['MANUAL'], ...over });

describe('which rail settles a payout', () => {
  let ps;
  beforeAll(() => { jest.resetModules(); process.env.PAYSTACK_SECRET_KEY = 'sk'; ps = require('../src/services/payment.service'); });

  test('Orange countries → orange', () => {
    expect(ps.resolvePayoutProviderForCountry(base({ payoutMethods: ['ORANGE_MONEY', 'MANUAL'], payoutMethod: 'ORANGE_MONEY' }))).toBe('orange');
  });
  test('Nigeria → a card provider (paystack/flutterwave), never manual', () => {
    expect(['paystack', 'flutterwave']).toContain(ps.resolvePayoutProviderForCountry(base({ payoutMethods: ['NG_BANK_TRANSFER'], payoutMethod: 'NG_BANK_TRANSFER' })));
  });
  test('MANUAL-only countries (Ghana, Gambia, Togo…) → manual, NOT silently sent to Paystack', () => {
    expect(ps.resolvePayoutProviderForCountry(base())).toBe('manual');
    expect(ps.resolvePayoutProviderForCountry(base({ payoutMethods: ['MANUAL'], payoutMethod: 'UNSUPPORTED' }))).toBe('manual');
  });
  test('manual rail: no bank list, no fake verification, transfer refused with a clear message', async () => {
    const gh = base({ code: 'GH' });
    expect(await ps.listBanksUnified('GH', gh)).toEqual([]);
    expect(await ps.verifyBankAccountUnified('0241234567', 'X', 'GH', gh)).toMatchObject({ account_name: null, unverifiedName: true });
    await expect(ps.initiatePayoutTransfer({ amount: 1, accountNumber: '1', reference: 'r', country: gh })).rejects.toThrow(/settled manually/);
  });
});

describe('country payoutStyle tells the app which form to show', () => {
  const style = (methods) => {
    jest.resetModules();
    const { makeFakePrisma } = require('./helpers/fakePrisma');
    jest.doMock('../src/lib/prisma', () => makeFakePrisma({ countries: [{ code: 'ZZ', name: 'Z', currencyCode: 'XOF', currencySymbol: 'CFA', defaultLocale: 'fr-ZZ', phoneDialCode: '+1', isActive: true, paymentProviders: ['flutterwave'], creditMethods: ['CASH'], payoutMethods: methods, payoutMethod: methods[0], languageCode: 'fr' }] }));
    const svc = require('../src/services/country.service');
    return svc.getCountryByCode('ZZ').then(c => svc.buildClientConfig ? svc.buildClientConfig(c) : c);
  };
  test('normalised country keeps its MANUAL-only methods', async () => {
    const c = await style(['MANUAL']);
    expect(c.payoutMethods).toEqual(['MANUAL']);
  });
});

describe('completing a stuck payout', () => {
  const setup = (payout) => {
    jest.resetModules();
    const log = { tx: [], notified: [], audit: [] };
    const fake = {
      payout: { findUnique: async () => payout, update: (a) => async () => { log.tx.push(['payout', a.data]); } },
      walletTransaction: { updateMany: (a) => async () => { log.tx.push(['wtx', a.data]); } },
      $transaction: async (ops) => { for (const o of ops) await o(); },
    };
    jest.doMock('../src/lib/prisma', () => fake);
    jest.doMock('../src/utils/auditLog', () => ({ logActivity: (e) => log.audit.push(e) }));
    jest.doMock('../src/services/notification.service', () => ({ notify: async (n) => log.notified.push(n), TYPES: { WALLET_WITHDRAWAL: 'w' } }));
    jest.doMock('../src/services/email.service', () => ({}));
    const ctrl = require('../src/controllers/wallet.controller');
    return { ctrl, log };
  };
  const call = async (fn, req) => { const out = {}; const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
    try { await fn({ user: { id: 'admin' }, params: { id: 'p1' }, body: {}, ...req }, res); } catch (e) { out.error = e; } return out; };

  const payout = (over) => ({ id: 'p1', userId: 'u1', status: 'PROCESSING', amount: 9750, currency: 'XOF', reference: 'WD-1', bankName: 'Ecobank', accountName: 'A B', payoutDetails: { grossAmount: 10000, fee: 250 }, user: {}, ...over });

  test('PROCESSING → COMPLETED, audited, user notified', async () => {
    const { ctrl, log } = setup(payout());
    const r = await call(ctrl.adminCompletePayout, { body: { reference: 'BANK-REF-9' } });
    expect(r.status).toBe(200);
    expect(log.tx.find(t => t[0] === 'payout')[1]).toMatchObject({ status: 'COMPLETED', transferCode: 'BANK-REF-9' });
    expect(log.tx.find(t => t[0] === 'wtx')[1]).toEqual({ status: 'COMPLETED' });
    expect(log.audit[0].action).toBe('admin_payout_marked_paid');
    expect(log.notified[0].message).toMatch(/has been sent/);
  });
  test('already completed/failed payouts cannot be marked paid again', async () => {
    for (const status of ['COMPLETED', 'FAILED']) {
      const { ctrl } = setup(payout({ status }));
      expect((await call(ctrl.adminCompletePayout, {})).error.message).toMatch(/pending or processing/);
    }
  });
  test('a payout whose transfer already started cannot be retried or refunded (double-pay guard)', async () => {
    const { ctrl } = setup(payout({ transferCode: 'TRF_123' }));
    expect((await call(ctrl.adminApprovePayout, {})).error.message).toMatch(/already started/);
    expect((await call(ctrl.adminRejectPayout, { body: { reason: 'x' } })).error.message).toMatch(/already started/);
  });
});
