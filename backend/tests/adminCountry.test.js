'use strict';
jest.mock('../src/lib/prisma', () => ({}));

const { makeFakePrisma, COUNTRIES } = require('./helpers/fakePrisma');

const setup = () => {
  jest.resetModules();
  const fake = makeFakePrisma({ countries: [
    COUNTRIES.NG, { ...COUNTRIES.ML, isActive: false },
  ]});
  fake.user = { count: async () => 3 };
  fake.country.update = async ({ where, data }) => {
    const row = fake._db.countries.find(c => c.code === where.code);
    Object.assign(row, data); return { ...row };
  };
  fake.countrySetting.upsert = ((orig) => (args) => orig(args))(fake.countrySetting.upsert);
  jest.doMock('../src/lib/prisma', () => fake);
  const audit = [];
  jest.doMock('../src/utils/auditLog', () => ({ logActivity: (e) => audit.push(e) }));
  const ctrl = require('../src/controllers/adminCountry.controller');
  return { ctrl, fake, audit };
};

const call = async (fn, req) => {
  const out = {};
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  try { await fn({ user: { id: 'admin1', role: 'SUPER_ADMIN' }, params: {}, body: {}, query: {}, ...req }, res); }
  catch (e) { out.error = e; }
  return out;
};

test('cannot activate a non-base-currency country whose pricing was never reviewed', async () => {
  const { ctrl, fake } = setup();
  const r = await call(ctrl.setCountryStatus, { params: { code: 'ML' }, body: { isActive: true } });
  expect(r.status).toBe(409);
  expect(r.body.code).toBe('PRICING_NOT_REVIEWED');
  expect(fake._db.countries.find(c => c.code === 'ML').isActive).toBe(false);
});

test('explicit acknowledgement lets it go live', async () => {
  const { ctrl, fake } = setup();
  const r = await call(ctrl.setCountryStatus, { params: { code: 'ML' }, body: { isActive: true, acknowledgeStarterPricing: true } });
  expect(r.status).toBe(200);
  expect(fake._db.countries.find(c => c.code === 'ML').isActive).toBe(true);
});

test('saving pricing clears the guard, so activation then succeeds without acknowledgement', async () => {
  const { ctrl } = setup();
  const save = await call(ctrl.updateCountrySettings, { params: { code: 'ML' }, body: { changes: { ride_base_fare_car: 400, platform_commission_rides: 12 } } });
  expect(save.status).toBe(200);
  expect(save.body.data.pricingReviewed).toBe(true);
  const act = await call(ctrl.setCountryStatus, { params: { code: 'ML' }, body: { isActive: true } });
  expect(act.status).toBe(200);
});

test('Nigeria (base currency) is never blocked by the guard', async () => {
  const { ctrl, fake } = setup();
  fake._db.countries.find(c => c.code === 'NG').isActive = false;
  const r = await call(ctrl.setCountryStatus, { params: { code: 'NG' }, body: { isActive: true } });
  expect(r.status).toBe(200);
});

test('every save is audit-logged with old → new values and the admin id', async () => {
  const { ctrl, audit } = setup();
  await call(ctrl.updateCountrySettings, { params: { code: 'ML' }, body: { changes: { platform_commission_rides: 12 } } });
  const e = audit.find(a => a.action === 'admin_country_settings_updated');
  expect(e.userId).toBe('admin1');
  expect(e.details.changes).toEqual([{ key: 'platform_commission_rides', from: 20, to: 12 }]);
});

test('bad input is a 400 and nothing is logged as saved', async () => {
  const { ctrl, audit, fake } = setup();
  const r = await call(ctrl.updateCountrySettings, { params: { code: 'ML' }, body: { changes: { platform_commission_rides: 99 } } });
  expect(r.error.statusCode ?? r.error.status).toBe(400);
  expect(audit).toHaveLength(0);
  expect(fake._db.countrySettings).toHaveLength(0);
  const r2 = await call(ctrl.updateCountrySettings, { params: { code: 'ML' }, body: { changes: [] } });
  expect(r2.error.message).toMatch(/must be an object/);
});

test('settings description exposes source + override flag for the UI', async () => {
  const { ctrl } = setup();
  await call(ctrl.updateCountrySettings, { params: { code: 'ML' }, body: { changes: { wallet_topup_min: 500 } } });
  const r = await call(ctrl.getCountrySettings, { params: { code: 'ML' } });
  const s = Object.fromEntries(r.body.data.settings.map(x => [x.key, x]));
  expect(s.wallet_topup_min).toMatchObject({ value: 500, source: 'country', overridden: true });
  expect(s.ride_base_fare_car).toMatchObject({ source: 'starter', overridden: false });
  expect(s.platform_commission_rides).toMatchObject({ source: 'default', value: 20 });
  expect(r.body.data.currency).toBe('XOF');
});

test('compare returns one row per country', async () => {
  const { ctrl } = setup();
  await call(ctrl.updateCountrySettings, { params: { code: 'ML' }, body: { changes: { platform_commission_rides: 10 } } });
  const r = await call(ctrl.compareCountrySettings, { query: { keys: 'platform_commission_rides' } });
  const by = Object.fromEntries(r.body.data.countries.map(c => [c.code, c.values.platform_commission_rides]));
  expect(by).toEqual({ NG: 20, ML: 10 });
  const bad = await call(ctrl.compareCountrySettings, { query: { keys: 'nope' } });
  expect(bad.error.message).toMatch(/Unknown/);
});
