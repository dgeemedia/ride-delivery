'use strict';

jest.mock('../src/lib/prisma', () => ({}));   // replaced per-test below

const { makeFakePrisma, COUNTRIES } = require('./helpers/fakePrisma');

const load = (seed = {}) => {
  jest.resetModules();
  const fake = makeFakePrisma({
    countries: [COUNTRIES.NG, COUNTRIES.ML, COUNTRIES.GN, COUNTRIES.GH],
    ...seed,
  });
  jest.doMock('../src/lib/prisma', () => fake);
  const svc = require('../src/services/countrySettings.service');
  svc.invalidateCountrySettingsCache();
  require('../src/services/country.service').invalidateCountryCache();
  return { svc, fake };
};

describe('resolution order', () => {
  test('Nigeria inherits the existing global SystemSettings (nothing changes for NG)', async () => {
    const { svc } = load({ systemSettings: [
      { key: 'ride_base_fare_car', value: '650' },
      { key: 'platform_commission_rides', value: '18' },
    ]});
    const e = await svc.getEffectiveSettings('NG');
    expect(e.values.ride_base_fare_car).toBe(650);
    expect(e.sources.ride_base_fare_car).toBe('global');
    expect(e.values.platform_commission_rides).toBe(18);
  });

  test('a country override beats the global value', async () => {
    const { svc } = load({
      systemSettings:  [{ key: 'platform_commission_rides', value: '20' }],
      countrySettings: [{ countryCode: 'ML', key: 'platform_commission_rides', value: 12 }],
    });
    expect((await svc.getEffectiveSettings('ML')).values.platform_commission_rides).toBe(12);
    expect((await svc.getEffectiveSettings('NG')).values.platform_commission_rides).toBe(20);
  });

  test('percentages inherit globally into non-NGN markets, money does NOT', async () => {
    const { svc } = load({ systemSettings: [
      { key: 'platform_commission_rides', value: '17' },
      { key: 'ride_base_fare_car', value: '500' },       // a Naira amount
    ]});
    const ml = await svc.getEffectiveSettings('ML');
    expect(ml.values.platform_commission_rides).toBe(17);
    expect(ml.sources.platform_commission_rides).toBe('global');
    // 500 NGN must never leak into a CFA market as "500 XOF"
    expect(ml.sources.ride_base_fare_car).toBe('starter');
    expect(ml.values.ride_base_fare_car).toBe(185);       // 500 × 0.37
  });

  test('starter money values are whole numbers in whole-unit currencies and never zero', async () => {
    const { svc } = load();
    const gn = await svc.getEffectiveSettings('GN');
    for (const d of svc.DEFS.filter(d => d.type === 'money' && d.base > 0)) {
      const v = gn.values[d.key];
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
    const gh = await svc.getEffectiveSettings('GH');
    expect(gh.values.ride_per_minute_bike).toBeGreaterThan(0);   // 8 NGN → 0.08 GHS, not 0
  });

  test('rounding step defaults per currency', async () => {
    const { svc } = load();
    expect((await svc.getEffectiveSettings('NG')).values.price_rounding_step).toBe(50);
    expect((await svc.getEffectiveSettings('ML')).values.price_rounding_step).toBe(25);
    expect((await svc.getEffectiveSettings('GN')).values.price_rounding_step).toBe(500);
  });

  test('timezone offset defaults per country and is never inherited', async () => {
    const { svc } = load({ systemSettings: [{ key: 'utc_offset_minutes', value: '999' }] });
    expect((await svc.getEffectiveSettings('NG')).values.utc_offset_minutes).toBe(60);
    expect((await svc.getEffectiveSettings('ML')).values.utc_offset_minutes).toBe(0);
  });

  test('garbage in the global table falls back instead of NaN', async () => {
    const { svc } = load({ systemSettings: [{ key: 'ride_base_fare_car', value: 'abc' }] });
    expect((await svc.getEffectiveSettings('NG')).values.ride_base_fare_car).toBe(500);
  });
});

describe('validation', () => {
  const { svc } = load();
  test.each([
    ['platform_commission_rides', 75, 'XOF', /at most 60/],
    ['platform_commission_rides', -1, 'XOF', /at least 0/],
    ['wallet_topup_min', 100.5, 'XOF', /whole number/],
    ['ride_base_fare_car', 'abc', 'XOF', /not a valid/],
    ['nope', 1, 'XOF', /Unknown setting/],
    ['cashback_mode', 'bogus', 'XOF', /not a valid/],
    ['utc_offset_minutes', 30.5, 'XOF', /whole number/],
  ])('%s = %s rejected', (key, val, cur, msg) => {
    expect(() => svc.validateValue(key, val, cur)).toThrow(msg);
  });

  test('decimals are fine where the currency has them', () => {
    expect(svc.validateValue('wallet_topup_min', 2.5, 'GHS')).toBe(2.5);
  });

  test('surge windows are validated and normalised', () => {
    expect(() => svc.validateValue('surge_windows', [{ days: [1], hourStart: 9, hourEnd: 6, multiplier: 1.5 }], 'XOF')).toThrow(/before hourEnd/);
    expect(() => svc.validateValue('surge_windows', [{ days: [9], hourStart: 6, hourEnd: 9, multiplier: 1.5 }], 'XOF')).toThrow(/0–6/);
    expect(() => svc.validateValue('surge_windows', [{ days: [1], hourStart: 6, hourEnd: 9, multiplier: 9 }], 'XOF')).toThrow(/between 1 and 5/);
    const ok = svc.validateValue('surge_windows', [{ label: 'Rush', days: [2, 1, 1], hourStart: 6, hourEnd: 9, multiplier: 1.5 }], 'XOF');
    expect(ok[0].days).toEqual([1, 2]);
  });

  test('cross-field rules', () => {
    expect(() => svc.validateConsistency({ wallet_topup_min: 500, wallet_topup_max: 100 })).toThrow(/Minimum top-up/);
    expect(() => svc.validateConsistency({ cashback_enabled: true, cashback_mode: 'fixed', cashback_amount: 0 })).toThrow(/fixed reward/);
    expect(() => svc.validateConsistency({ withdrawal_max: 1000, withdrawal_min_customer: 5000, withdrawal_min_earner: 100 })).toThrow(/Customer minimum/);
  });
});

describe('saving', () => {
  test('saves overrides, is isolated per country, and marks pricing reviewed', async () => {
    const { svc, fake } = load();
    expect(await svc.isPricingReviewed('ML')).toBe(false);

    const res = await svc.saveCountrySettings('ML', { ride_base_fare_car: 400, platform_commission_rides: 12 }, 'admin1');
    expect(res.applied.map(a => a.key).sort()).toEqual(['platform_commission_rides', 'ride_base_fare_car']);
    expect((await svc.getEffectiveSettings('ML')).values.ride_base_fare_car).toBe(400);
    expect((await svc.getEffectiveSettings('GN')).values.ride_base_fare_car).not.toBe(400);
    expect((await svc.getEffectiveSettings('NG')).values.platform_commission_rides).toBe(20);
    expect(await svc.isPricingReviewed('ML')).toBe(true);
    expect(fake._db.countrySettings.find(s => s.key === 'ride_base_fare_car').updatedBy).toBe('admin1');
  });

  test('null clears an override so the country inherits again', async () => {
    const { svc } = load({ countrySettings: [{ countryCode: 'ML', key: 'platform_commission_rides', value: 5 }],
                           systemSettings:  [{ key: 'platform_commission_rides', value: '20' }] });
    expect((await svc.getEffectiveSettings('ML')).values.platform_commission_rides).toBe(5);
    await svc.saveCountrySettings('ML', { platform_commission_rides: null }, 'a');
    expect((await svc.getEffectiveSettings('ML')).values.platform_commission_rides).toBe(20);
  });

  test('a bad value writes NOTHING (all-or-nothing)', async () => {
    const { svc, fake } = load();
    await expect(svc.saveCountrySettings('ML', { ride_base_fare_car: 400, platform_commission_rides: 500 }, 'a')).rejects.toThrow(/at most 60/);
    expect(fake._db.countrySettings).toHaveLength(0);
  });

  test('rejects an unknown country', async () => {
    const { svc } = load();
    await expect(svc.saveCountrySettings('ZZ', { ride_base_fare_car: 1 }, 'a')).rejects.toThrow(/Country not found/);
  });

  test('changing only wallet limits does not mark pricing as reviewed', async () => {
    const { svc } = load();
    await svc.saveCountrySettings('ML', { wallet_topup_min: 500 }, 'a');
    expect(await svc.isPricingReviewed('ML')).toBe(false);
  });

  test('cross-field violation against merged state is caught', async () => {
    const { svc } = load({ countrySettings: [{ countryCode: 'ML', key: 'wallet_topup_max', value: 1000 }] });
    await expect(svc.saveCountrySettings('ML', { wallet_topup_min: 5000 }, 'a')).rejects.toThrow(/Minimum top-up/);
  });
});

describe('copySettings', () => {
  test('requires an exchange factor across currencies and applies it to money only', async () => {
    const { svc } = load();
    await expect(svc.copySettings('ML', 'NG', {})).rejects.toThrow(/supply "factor"/);
    await svc.copySettings('ML', 'NG', { factor: 0.5, adminId: 'a' });
    const ml = await svc.getEffectiveSettings('ML');
    expect(ml.values.ride_base_fare_car).toBe(250);            // 500 × 0.5
    expect(ml.values.platform_commission_rides).toBe(20);      // percent untouched
    expect(ml.values.utc_offset_minutes).toBe(0);              // timezone never copied
  });
});

describe('withdrawal rules', () => {
  const rules = { enabled: true, min: 1000, max: 0, feeFlat: 100, feePct: 1.5, currency: 'XOF' };
  test('fee = flat + percent, net = gross − fee', () => {
    expect(svc().applyWithdrawalRules(10000, rules)).toEqual({ gross: 10000, fee: 250, net: 9750 });
  });
  test('paused, below min, above max, fee eats amount', () => {
    expect(() => svc().applyWithdrawalRules(5000, { ...rules, enabled: false })).toThrow(/paused/);
    expect(() => svc().applyWithdrawalRules(500, rules)).toThrow(/Minimum/);
    expect(() => svc().applyWithdrawalRules(90000, { ...rules, max: 50000 })).toThrow(/Maximum/);
    expect(() => svc().applyWithdrawalRules(1000, { ...rules, feeFlat: 1000 })).toThrow(/too small/);
  });
  function svc() { return load().svc; }
});
