'use strict';
const m = require('../src/utils/marketScope');

describe('marketScope', () => {
  const ML = { role: 'ADMIN', supportCountries: ['ml'] };
  const ALL = { role: 'ADMIN', supportCountries: [] };
  const SUP = { role: 'SUPER_ADMIN', supportCountries: ['ML'] };

  test('countryParam accepts only ISO alpha-2', () => {
    expect(m.countryParam('ml')).toBe('ML');
    expect(m.countryParam(' ng ')).toBe('NG');
    expect(m.countryParam('')).toBeUndefined();
    expect(m.countryParam('MLI')).toBeUndefined();
    expect(m.countryParam('1;')).toBeUndefined();
    expect(m.countryParam(undefined)).toBeUndefined();
  });

  test('unrestricted staff: filter only when a country is requested', () => {
    expect(m.marketWhere(ALL, undefined)).toBeUndefined();
    expect(m.marketWhere(ALL, 'ml')).toEqual({ countryCode: 'ML' });
    expect(m.marketWhere(null, 'gh')).toEqual({ countryCode: 'GH' });
  });

  test('super admin is never restricted, even with coverage set', () => {
    expect(m.staffMarkets(SUP)).toEqual([]);
    expect(m.marketWhere(SUP, undefined)).toBeUndefined();
    expect(m.canActInMarket(SUP, 'NG')).toBe(true);
  });

  test('scoped staff are confined to their countries', () => {
    expect(m.marketWhere(ML, undefined)).toEqual({ countryCode: { in: ['ML'] } });
    expect(m.marketWhere(ML, 'ML')).toEqual({ countryCode: 'ML' });
    expect(m.marketWhere(ML, 'NG')).toEqual({ countryCode: { in: [] } }); // nothing leaks
    expect(m.scopeOnlyWhere(ML)).toEqual({ countryCode: { in: ['ML'] } });
    expect(m.scopeOnlyWhere(ALL)).toBeUndefined();
  });

  test('approval guard', () => {
    expect(m.canActInMarket(ML, 'ml')).toBe(true);
    expect(m.canActInMarket(ML, 'NG')).toBe(false);
    expect(m.canActInMarket(ALL, 'NG')).toBe(true);
  });

  test('coverage list is normalised and de-duplicated', () => {
    expect(m.staffMarkets({ role: 'ADMIN', supportCountries: ['ml', 'ML', ' gh ', ''] })).toEqual(['ML', 'GH']);
  });

  test('tallyByCountry', () => {
    expect(m.tallyByCountry([{ user: { countryCode: 'ML' } }, { user: { countryCode: 'ml' } }, { user: { countryCode: 'NG' } }, { user: {} }]))
      .toEqual({ ML: 2, NG: 2 });
  });
});

describe('admin list endpoints honour the country filter', () => {
  const run = async (name, user, query) => {
    jest.resetModules();
    const calls = [];
    const rec = (model) => ({
      findMany: async (a) => { calls.push({ model, where: a.where }); return []; },
      count: async () => 0,
    });
    jest.doMock('../src/lib/prisma', () => ({
      driverProfile: rec('driver'), deliveryPartnerProfile: rec('partner'), ride: rec('ride'), delivery: rec('delivery'),
    }));
    for (const dep of ['notification.service', 'email.service', 'shield.service', 'commission.service', 'payment.service']) {
      jest.doMock(`../src/services/${dep}`, () => ({}));
    }
    jest.doMock('../src/services/countrySettings.service', () => ({}));
    const ctrl = require('../src/controllers/admin.controller');
    const res = { status: () => ({ json: () => {} }) };
    await ctrl[name]({ user, query, params: {} }, res);
    return calls;
  };

  test('drivers: ?country=ML filters on the user; search keeps the country', async () => {
    const c = await run('getDrivers', { role: 'ADMIN', supportCountries: [] }, { country: 'ml', search: 'awa' });
    expect(c[0].where.user.countryCode).toBe('ML');
    expect(c[0].where.user.OR).toHaveLength(4);
  });
  test('scoped admin cannot see another country in drivers', async () => {
    const c = await run('getDrivers', { role: 'ADMIN', supportCountries: ['ML'] }, { country: 'NG' });
    expect(c[0].where.user.countryCode).toEqual({ in: [] });
  });
  test('pending partners: filtered list + unfiltered per-country tally query', async () => {
    const c = await run('getPendingPartners', { role: 'ADMIN', supportCountries: [] }, { country: 'GH' });
    expect(c[0].where.user).toEqual({ countryCode: 'GH' });
    expect(c[1].where.user).toBeUndefined();
  });
  test('rides and deliveries filter on the customer market', async () => {
    expect((await run('getRides', { role: 'ADMIN', supportCountries: [] }, { country: 'ML' }))[0].where.customer).toEqual({ countryCode: 'ML' });
    expect((await run('getDeliveries', { role: 'ADMIN', supportCountries: ['ML', 'GH'] }, {}))[0].where.customer).toEqual({ countryCode: { in: ['ML', 'GH'] } });
    expect((await run('getRides', { role: 'SUPER_ADMIN', supportCountries: ['ML'] }, {}))[0].where.customer).toBeUndefined();
  });
});
