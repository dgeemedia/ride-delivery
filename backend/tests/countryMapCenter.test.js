'use strict';
jest.mock('../src/lib/prisma', () => ({}));

const fs = require('fs');
const path = require('path');
const { makeFakePrisma, COUNTRIES } = require('./helpers/fakePrisma');

// A market that is NOT in the built-in table: proves new countries work with no code change.
const XX = { ...COUNTRIES.ML, code: 'XX', name: 'Examplia', mapCenterLat: 1.5, mapCenterLng: 2.5, mapCenterCity: 'Exampletown' };

const setup = (countries) => {
  jest.resetModules();
  const fake = makeFakePrisma({ countries });
  fake.user = { count: async () => 0 };
  fake.country.create = async ({ data }) => { const row = { id: 'id-' + data.code, ...data }; fake._db.countries.push(row); return { ...row }; };
  fake.country.update = async ({ where, data }) => { const r = fake._db.countries.find(c => c.code === where.code); Object.assign(r, data); return { ...r }; };
  jest.doMock('../src/lib/prisma', () => fake);
  jest.doMock('../src/utils/auditLog', () => ({ logActivity: () => {} }));
  return fake;
};

const call = async (fn, req) => {
  const out = {};
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  try { await fn({ user: { id: 'a', role: 'SUPER_ADMIN' }, params: {}, body: {}, query: {}, ...req }, res); } catch (e) { out.error = e; }
  return out;
};

describe('country.service map centre', () => {
  test('a centre saved on the Country row wins over the built-in table', async () => {
    setup([COUNTRIES.NG, { ...COUNTRIES.ML, mapCenterLat: 11.1, mapCenterLng: -7.7, mapCenterCity: 'Sikasso' }]);
    const svc = require('../src/services/country.service');
    expect(await svc.getMapCenterForCountry('ML')).toEqual({ lat: 11.1, lng: -7.7, city: 'Sikasso' });
  });
  test('a seeded country with no stored centre uses the built-in table (Bamako, not Lagos)', async () => {
    setup([COUNTRIES.NG, COUNTRIES.ML]);
    const svc = require('../src/services/country.service');
    const c = await svc.getMapCenterForCountry('ml');
    expect(c.city).toBe('Bamako');
    expect(c.lat).toBeCloseTo(12.6392, 3);
  });
  test('a brand-new country works from its row alone', async () => {
    setup([COUNTRIES.NG, XX]);
    const svc = require('../src/services/country.service');
    expect(await svc.getMapCenterForCountry('XX')).toEqual({ lat: 1.5, lng: 2.5, city: 'Exampletown' });
  });
  test('an unknown country with no centre returns null (never another country\'s city)', async () => {
    setup([COUNTRIES.NG]);
    const svc = require('../src/services/country.service');
    expect(await svc.getMapCenterForCountry('ZZ')).toBeNull();
    expect(await svc.getMapCenterForCountry('')).toBeNull();
  });
  test('the config the app downloads includes mapCenter', async () => {
    setup([COUNTRIES.NG, XX]);
    const svc = require('../src/services/country.service');
    const cfg = await svc.getPaymentConfigForCountry('XX');
    expect(cfg.mapCenter).toEqual({ lat: 1.5, lng: 2.5, city: 'Exampletown' });
    const ng = await svc.getPaymentConfigForCountry('NG');
    expect(ng.mapCenter.city).toBe('Lagos');
  });
});

describe('admin create/update validation', () => {
  const base = { name: 'Examplia', currencyCode: 'EXA', currencySymbol: 'E', phoneDialCode: '+999' };

  test('new country WITHOUT a centre is rejected', async () => {
    setup([COUNTRIES.NG]);
    const ctrl = require('../src/controllers/adminCountry.controller');
    const r = await call(ctrl.createCountry, { body: { ...base, code: 'XX' } });
    expect(r.error?.statusCode ?? r.error?.status).toBe(400);
    expect(String(r.error.message)).toMatch(/map centre/i);
  });
  test('new country with a valid centre is saved', async () => {
    const fake = setup([COUNTRIES.NG]);
    const ctrl = require('../src/controllers/adminCountry.controller');
    const r = await call(ctrl.createCountry, { body: { ...base, code: 'XX', mapCenterLat: '1.5', mapCenterLng: '2.5', mapCenterCity: 'Exampletown' } });
    expect(r.status).toBe(201);
    const row = fake._db.countries.find(c => c.code === 'XX');
    expect(row).toMatchObject({ mapCenterLat: 1.5, mapCenterLng: 2.5, mapCenterCity: 'Exampletown' });
  });
  test('a seeded country code may omit it (built-in default is used)', async () => {
    const fake = setup([COUNTRIES.NG]);
    const ctrl = require('../src/controllers/adminCountry.controller');
    const r = await call(ctrl.createCountry, { body: { ...base, code: 'SN' } });
    expect(r.status).toBe(201);
    expect(fake._db.countries.find(c => c.code === 'SN').mapCenterCity).toBe('Dakar');
  });
  test.each([
    [{ mapCenterLat: 91, mapCenterLng: 0 }, /latitude/i],
    [{ mapCenterLat: 0, mapCenterLng: 181 }, /longitude/i],
    [{ mapCenterLat: 'abc', mapCenterLng: 0 }, /latitude/i],
    [{ mapCenterLat: 5 }, /both/i],
  ])('rejects bad centre %j', async (centre, re) => {
    setup([COUNTRIES.NG]);
    const ctrl = require('../src/controllers/adminCountry.controller');
    const r = await call(ctrl.createCountry, { body: { ...base, code: 'XX', ...centre } });
    expect(r.error).toBeTruthy();
    expect(String(r.error.message)).toMatch(re);
  });
  test('an admin can move the centre of an existing country; omitting it leaves it alone', async () => {
    const fake = setup([COUNTRIES.NG, { ...COUNTRIES.ML, mapCenterLat: 12.6, mapCenterLng: -8.0, mapCenterCity: 'Bamako' }]);
    const ctrl = require('../src/controllers/adminCountry.controller');
    let r = await call(ctrl.updateCountry, { params: { code: 'ML' }, body: { name: 'Mali' } });
    expect(r.status).toBe(200);
    expect(fake._db.countries.find(c => c.code === 'ML').mapCenterCity).toBe('Bamako');
    r = await call(ctrl.updateCountry, { params: { code: 'ML' }, body: { mapCenterLat: 11.1, mapCenterLng: -7.7, mapCenterCity: 'Sikasso' } });
    expect(r.status).toBe(200);
    expect(fake._db.countries.find(c => c.code === 'ML')).toMatchObject({ mapCenterLat: 11.1, mapCenterCity: 'Sikasso' });
  });
});

describe('address search uses the DB-backed centre', () => {
  test('new country, no GPS: Google request is restricted to it and biased to ITS centre', async () => {
    setup([COUNTRIES.NG, XX]);
    process.env.GOOGLE_PLACES_API_KEY = 'k';
    const sent = [];
    jest.doMock('axios', () => ({ post: async (_u, body) => { sent.push(body); return { data: { suggestions: [] } }; }, get: async () => ({ data: { features: [] } }) }));
    jest.doMock('express-validator', () => ({ validationResult: () => ({ isEmpty: () => true }) }));
    const ctrl = require('../src/controllers/places.controller');
    const res = { status: () => ({ json: () => {} }) };
    await ctrl.autocomplete({ body: { input: 'town', sessionToken: 's' }, user: { countryCode: 'XX' } }, res);
    expect(sent[0].includedRegionCodes).toEqual(['xx']);
    expect(sent[0].locationBias.circle.center).toEqual({ latitude: 1.5, longitude: 2.5 });
  });
  test('GPS coordinates still win over the country centre', async () => {
    setup([COUNTRIES.NG, XX]);
    process.env.GOOGLE_PLACES_API_KEY = 'k';
    const sent = [];
    jest.doMock('axios', () => ({ post: async (_u, body) => { sent.push(body); return { data: { suggestions: [] } }; }, get: async () => ({ data: { features: [] } }) }));
    jest.doMock('express-validator', () => ({ validationResult: () => ({ isEmpty: () => true }) }));
    const ctrl = require('../src/controllers/places.controller');
    await ctrl.autocomplete({ body: { input: 'town', sessionToken: 's', lat: 9, lng: 9 }, user: { countryCode: 'XX' } }, { status: () => ({ json: () => {} }) });
    expect(sent[0].locationBias.circle.center).toEqual({ latitude: 9, longitude: 9 });
  });
});

describe('migration', () => {
  const dir = fs.readdirSync(path.join(__dirname, '../prisma/migrations')).find(d => d.endsWith('add_country_map_center'));
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations', dir, 'migration.sql'), 'utf8');
  test('adds the 3 columns idempotently and back-fills all 20 seeded markets without overwriting', () => {
    expect((sql.match(/ADD COLUMN IF NOT EXISTS/g) || []).length).toBe(3);
    expect((sql.match(/UPDATE "Country"/g) || []).length).toBe(20);
    expect((sql.match(/"mapCenterLat" IS NULL/g) || []).length).toBe(20);
  });
  test('migration back-fill matches the built-in table', () => {
    const { COUNTRY_CENTERS } = require('../src/utils/countryGeo');
    for (const [code, c] of Object.entries(COUNTRY_CENTERS)) {
      const line = sql.split('\n').find(l => l.includes(`"code" = '${code}'`));
      expect(line).toContain(`"mapCenterLat" = ${c.lat},`);
      expect(line).toContain(`"mapCenterLng" = ${c.lng},`);
    }
  });
});
