'use strict';
// A country-limited admin ("Mali admin") must stay inside Mali; unrestricted admins and
// super admins are unaffected.

const UUID = '3f2b8c1e-0000-4000-8000-000000000001';

const setup = (rows = {}) => {
  jest.resetModules();
  const one = (name) => ({ findUnique: async ({ where }) => rows[name]?.(where) ?? null });
  jest.doMock('../src/lib/prisma', () => ({
    user: one('user'), driverProfile: one('driverProfile'), deliveryPartnerProfile: one('partner'),
    ride: one('ride'), delivery: one('delivery'), payment: one('payment'),
    shieldSession: one('shield'), duoPayAccount: one('duopay'),
    payout: one('payout'), transfer: one('transfer'), walletTransaction: one('topup'),
  }));
  return require('../src/middleware/marketGuard');
};

const call = async (mw, user, path) => {
  const req = { user, path };
  let status = 200, body, nexted = false;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  await mw(req, res, (e) => { nexted = true; if (e) throw e; });
  return { status, body, nexted };
};

const MALI = { role: 'ADMIN', supportCountries: ['ML'] };
const OPEN = { role: 'ADMIN', supportCountries: [] };
const SUPER = { role: 'SUPER_ADMIN', supportCountries: ['ML'] };

describe('marketGuard (admin routes)', () => {
  const rows = {
    user:          () => ({ countryCode: 'NG' }),
    driverProfile: () => ({ user: { countryCode: 'NG' } }),
    ride:          () => ({ customer: { countryCode: 'NG' } }),
    payment:       () => ({ user: { countryCode: 'NG' } }),
  };

  test('Mali admin cannot open a Nigerian user / driver / ride / payment', async () => {
    const { marketGuard } = setup(rows);
    for (const p of [`/users/${UUID}`, `/users/${UUID}/suspend`, `/drivers/${UUID}`, `/drivers/${UUID}/approve`, `/rides/${UUID}/cancel`, `/payments/${UUID}/refund`]) {
      const r = await call(marketGuard, MALI, p);
      expect([p, r.status]).toEqual([p, 403]);
      expect(r.nexted).toBe(false);
    }
  });

  test('a country admin can always open their own profile', async () => {
    const { marketGuard } = setup(rows);
    const me = { ...MALI, id: UUID };
    expect((await call(marketGuard, me, `/users/${UUID}`)).nexted).toBe(true);
  });

  test('Mali admin can open a Malian record', async () => {
    const { marketGuard } = setup({ driverProfile: () => ({ user: { countryCode: 'ML' } }) });
    const r = await call(marketGuard, MALI, `/drivers/${UUID}`);
    expect(r.nexted).toBe(true); expect(r.status).toBe(200);
  });

  test('unrestricted admin and super admin are never blocked', async () => {
    const { marketGuard } = setup(rows);
    expect((await call(marketGuard, OPEN, `/drivers/${UUID}`)).nexted).toBe(true);
    expect((await call(marketGuard, SUPER, `/drivers/${UUID}`)).nexted).toBe(true);
  });

  test('static paths and unknown ids pass through to the controller', async () => {
    const { marketGuard } = setup({});
    expect((await call(marketGuard, MALI, '/drivers/pending')).nexted).toBe(true);
    expect((await call(marketGuard, MALI, '/rides/live')).nexted).toBe(true);
    expect((await call(marketGuard, MALI, `/drivers/${UUID}`)).nexted).toBe(true); // 404 comes from the controller
  });

  test("a country's own configuration: Mali yes, Nigeria no", async () => {
    const { marketGuard } = setup({});
    expect((await call(marketGuard, MALI, '/countries/ML/settings')).nexted).toBe(true);
    expect((await call(marketGuard, MALI, '/countries/ng/settings')).status).toBe(403);
    expect((await call(marketGuard, MALI, '/countries/overview')).nexted).toBe(true); // list is filtered in the controller
  });
});

describe('walletMarketGuard (payouts, transfers, top-ups)', () => {
  test('Mali admin cannot touch a Nigerian payout / transfer / top-up', async () => {
    const { walletMarketGuard } = setup({
      payout:   () => ({ user: { countryCode: 'NG' } }),
      transfer: () => ({ sender: { countryCode: 'NG' } }),
      topup:    () => ({ wallet: { user: { countryCode: 'NG' } } }),
    });
    for (const p of ['/payouts/abc/approve', '/transfers/TRF-1/approve', '/topups/xyz/reconcile']) {
      expect([p, (await call(walletMarketGuard, MALI, p)).status]).toEqual([p, 403]);
    }
    expect((await call(walletMarketGuard, SUPER, '/payouts/abc/approve')).nexted).toBe(true);
  });
  test('Malian payout is allowed', async () => {
    const { walletMarketGuard } = setup({ payout: () => ({ user: { countryCode: 'ML' } }) });
    expect((await call(walletMarketGuard, MALI, '/payouts/abc/approve')).nexted).toBe(true);
  });
});

describe('denyScoped (global sections)', () => {
  test('closed to Mali admin, open to unrestricted and super admins', async () => {
    const { denyScoped } = setup({});
    expect((await call(denyScoped, MALI, '/logs')).status).toBe(403);
    expect((await call(denyScoped, OPEN, '/logs')).nexted).toBe(true);
    expect((await call(denyScoped, SUPER, '/logs')).nexted).toBe(true);
  });
});

describe('admin lists are confined to the admin\'s country', () => {
  const run = async (fn, user, query) => {
    jest.resetModules();
    const seen = [];
    const model = (n) => new Proxy({}, { get: (_, op) => async (a) => { seen.push({ n, where: a?.where }); return op === 'findMany' ? [] : 0; } });
    jest.doMock('../src/lib/prisma', () => ({ user: model('user'), payment: model('payment'), wallet: { findMany: async (a) => { seen.push({ n: 'wallet', where: a.where }); return []; }, count: async () => 0, groupBy: async () => [] } }));
    for (const dep of ['notification.service', 'email.service', 'shield.service', 'commission.service', 'payment.service']) jest.doMock(`../src/services/${dep}`, () => ({}));
    jest.doMock('../src/services/countrySettings.service', () => ({}));
    const ctrl = require('../src/controllers/admin.controller');
    await ctrl[fn]({ user, query }, { status: () => ({ json: () => {} }) });
    return seen;
  };
  test('users / payments / wallets', async () => {
    expect((await run('getUsers', MALI, {}))[0].where.countryCode).toEqual({ in: ['ML'] });
    expect((await run('getUsers', MALI, { country: 'NG' }))[0].where.countryCode).toEqual({ in: [] });
    expect((await run('getPayments', MALI, {}))[0].where.AND).toEqual([{ user: { countryCode: { in: ['ML'] } } }]);
    expect((await run('getWallets', MALI, {})).find(s => s.n === 'wallet').where.user).toEqual({ countryCode: { in: ['ML'] } });
    expect((await run('getUsers', OPEN, {}))[0].where.countryCode).toBeUndefined();
  });
});

describe('full authority for a country admin (and no more)', () => {
  const m = require('../src/utils/marketScope');

  test('who has country authority', () => {
    expect(m.hasCountryAuthority(SUPER)).toBe(true);
    expect(m.hasCountryAuthority(MALI)).toBe(true);
    expect(m.hasCountryAuthority(OPEN)).toBe(false);                       // plain admin is NOT elevated
    expect(m.hasCountryAuthority({ role: 'SUPPORT', supportCountries: ['ML'] })).toBe(false);
  });

  test('superOrCountryAdmin middleware', async () => {
    const { superOrCountryAdmin } = setup({});
    expect((await call(superOrCountryAdmin, SUPER, '/')).nexted).toBe(true);
    expect((await call(superOrCountryAdmin, MALI, '/')).nexted).toBe(true);
    expect((await call(superOrCountryAdmin, OPEN, '/')).status).toBe(403);
    expect((await call(superOrCountryAdmin, { role: 'SUPPORT', supportCountries: ['ML'] }, '/')).status).toBe(403);
  });

  test('which staff a country admin may manage', () => {
    const ML_STAFF = { role: 'SUPPORT', supportCountries: ['ML'] };
    expect(m.staffInsideMarkets(MALI, ML_STAFF)).toBe(true);
    expect(m.staffInsideMarkets(MALI, { role: 'ADMIN', supportCountries: ['ML', 'NG'] })).toBe(false); // spans another country
    expect(m.staffInsideMarkets(MALI, { role: 'ADMIN', supportCountries: [] })).toBe(false);          // all-country account
    expect(m.staffInsideMarkets(MALI, { role: 'SUPER_ADMIN', supportCountries: ['ML'] })).toBe(false);
    expect(m.staffInsideMarkets(SUPER, { role: 'ADMIN', supportCountries: [] })).toBe(true);
  });

  const controller = (prismaStub) => {
    jest.resetModules();
    jest.doMock('../src/lib/prisma', () => prismaStub);
    for (const dep of ['notification.service', 'email.service', 'shield.service', 'commission.service', 'payment.service']) jest.doMock(`../src/services/${dep}`, () => ({}));
    jest.doMock('../src/services/countrySettings.service', () => ({}));
    return require('../src/controllers/admin.controller');
  };
  const res = () => ({ status() { return this; }, json() { return this; } });
  const known = (...codes) => ({ findMany: async () => codes.map(code => ({ code })) });

  test('country admin cannot create a Super Admin, nor staff for a country they do not manage', async () => {
    const ctrl = controller({ country: known('ML', 'NG'), user: { findFirst: async () => null } });
    const base = { email: 'a@b.c', phone: '+22370000000', password: 'x'.repeat(8), firstName: 'A', lastName: 'B' };
    await expect(ctrl.createAdminUser({ user: MALI, body: { ...base, role: 'SUPER_ADMIN' } }, res())).rejects.toThrow(/Super Admin/);
    await expect(ctrl.createAdminUser({ user: MALI, body: { ...base, role: 'ADMIN', supportCountries: ['NG'] } }, res())).rejects.toThrow(/manage yourself/);
    await expect(ctrl.createAdminUser({ user: MALI, body: { ...base, role: 'DRIVER', countryCode: 'NG' } }, res())).rejects.toThrow(/own countries/);
  });

  test('country admin cannot touch coverage of outside staff, themselves, or grant all-country access', async () => {
    const staff = { id: 's1', role: 'SUPPORT', supportCountries: ['ML'] };
    const ctrl = controller({
      country: known('ML', 'NG'),
      user: { findUnique: async ({ where }) => ({ s1: staff, s2: { id: 's2', role: 'ADMIN', supportCountries: [] } }[where.id] ?? null), update: async ({ data }) => ({ id: 's1', ...data }) },
    });
    const call2 = (id, body, user = MALI) => ctrl.updateStaffSupportCoverage({ user, params: { id }, body }, res());
    await expect(call2('s2', { supportCountries: ['ML'] })).rejects.toThrow(/your own countries/);                    // all-country admin
    await expect(call2('s1', { supportCountries: [] })).rejects.toThrow(/all-country/);                                // would widen
    await expect(call2('s1', { supportCountries: ['NG'] })).rejects.toThrow(/your own countries/);                    // outside
    await expect(call2('s1', { supportCountries: ['ML'] }, { ...MALI, id: 's1' })).rejects.toThrow(/your own country/); // self
    await expect(call2('s1', { supportCountries: ['ML'], supportLanguages: ['fr'] })).resolves.toBeUndefined();        // fine
    await expect(call2('s2', { supportCountries: [] }, SUPER)).resolves.toBeUndefined();                               // super may
  });

  test('onboarding bonuses only reach the admin\'s own country', async () => {
    const seen = [];
    const ctrl = controller({
      driverProfile: { findMany: async (a) => { seen.push(a.where); return []; } },
      deliveryPartnerProfile: { findMany: async (a) => { seen.push(a.where); return []; } },
    });
    await ctrl.previewOnboardingBonuses({ user: MALI, query: {} }, res());
    expect(seen.every(w => JSON.stringify(w.user) === JSON.stringify({ countryCode: { in: ['ML'] } }))).toBe(true);
    await expect(ctrl.previewOnboardingBonuses({ user: OPEN, query: {} }, res())).rejects.toThrow(/Super Admin or a country admin/);
  });

  test('a country admin cannot adjust their own wallet', async () => {
    const ctrl = controller({});
    await expect(ctrl.adjustWallet({ user: { ...MALI, id: 'me' }, params: { userId: 'me' }, body: { amount: 10, type: 'credit' } }, res())).rejects.toThrow(/own wallet/);
  });
});

describe('dashboard revenue by country', () => {
  const run = async (user, query) => {
    jest.resetModules();
    const now = new Date();
    const calls = [];
    const stub = () => ({ count: async () => 0, groupBy: async () => [], findUnique: async () => null, findMany: async () => [] });
    const prisma = { user: stub(), ride: stub(), delivery: stub(), driverProfile: stub(), deliveryPartnerProfile: stub(), supportTicket: stub(), wallet: stub(), payment: stub() };
    prisma.$queryRawUnsafe = async (sql, ...params) => {
      calls.push({ sql, params });
      if (sql.includes('"Payment"')) return [
        { country: 'ML', currency: 'XOF', today: 1000, month: 1000, year: 1300 },
        { country: 'SN', currency: 'XOF', today: 500, month: 500, year: 500 },
        { country: 'NG', currency: 'NGN', today: 200, month: 200, year: 200 },
      ];
      return [
        { country: 'ML', currency: 'XOF', balance: 700 },
        { country: 'GH', currency: 'GHS', balance: 90 },   // wallet but no payments yet
      ];
    };
    prisma.country = { findMany: async () => [{ code: 'ML', name: 'Mali' }, { code: 'SN', name: 'Senegal' }, { code: 'NG', name: 'Nigeria' }, { code: 'GH', name: 'Ghana' }], findUnique: async () => null };
    jest.doMock('../src/lib/prisma', () => prisma);
    const { getDashboardStats } = require('../src/controllers/admin.controller');
    let out; await getDashboardStats({ user, query }, { status: () => ({ json: (b) => { out = b; } }) });
    return { rows: out.data.revenue.byCountry, calls, out };
  };

  test('splits a shared currency into countries, with wallet balances, nothing summed across currencies', async () => {
    const { rows, calls } = await run({ role: 'SUPER_ADMIN' }, {});
    expect(rows.map(r => r.country).sort()).toEqual(['GH', 'ML', 'NG', 'SN']);
    expect(rows.find(r => r.country === 'ML')).toMatchObject({ currency: 'XOF', year: 1300, walletBalance: 700, name: 'Mali' });
    expect(rows.find(r => r.country === 'SN')).toMatchObject({ year: 500, walletBalance: 0 });
    expect(rows.find(r => r.country === 'GH')).toMatchObject({ currency: 'GHS', year: 0, walletBalance: 90 });
    expect(calls.every(c => !c.sql.includes('ANY('))).toBe(true);                       // super admin: no country filter
  });

  test('a country admin only queries their own countries', async () => {
    const { calls } = await run({ role: 'ADMIN', supportCountries: ['ML', 'SN'] }, {});
    expect(calls).toHaveLength(2);
    calls.forEach(c => { expect(c.sql).toContain('ANY('); expect(c.params).toContainEqual(['ML', 'SN']); });
  });

  test('a single selected country has no per-country table', async () => {
    const { rows, calls } = await run({ role: 'SUPER_ADMIN' }, { country: 'ML' });
    expect(rows).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
