'use strict';
jest.mock('../src/lib/prisma', () => ({}));
const { makeFakePrisma, COUNTRIES } = require('./helpers/fakePrisma');

const load = (seed = {}) => {
  jest.resetModules();
  const fake = makeFakePrisma({ countries: Object.values(COUNTRIES), ...seed });
  jest.doMock('../src/lib/prisma', () => fake);
  const engine = require('../src/utils/fareEngine');
  engine.invalidateFareCache();
  require('../src/services/country.service').invalidateCountryCache();
  return { engine, fake, svc: require('../src/services/countrySettings.service') };
};

// Tuesday 12:00 in Lagos (UTC+1) → 11:00 UTC. Not inside any default surge window.
const OFF_PEAK = new Date('2026-09-29T11:00:00Z');

describe('Nigeria regression — pricing must be identical to the old global engine', () => {
  test('5 km car ride, off-peak', async () => {
    const { engine } = load();
    const r = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'NGN', 'NG');
    // (500 + 130*5 + 15*16.667) = 1400 → max(500,1400)+100 = 1500 → nearest 50
    expect(r.estimatedFare).toBe(1500);
    expect(r.bookingFee).toBe(100);
    expect(r.driverEarnings).toBe(1120);          // 1400 × 0.8
    expect(r.platformRevenue.commission).toBe(280);
  });

  test('legacy call without countryCode still works and defaults to NG', async () => {
    const { engine } = load();
    const r = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'NGN');
    expect(r.estimatedFare).toBe(1500);
  });

  test('admin-edited global settings still drive Nigeria', async () => {
    const { engine } = load({ systemSettings: [
      { key: 'ride_base_fare_car', value: '1000' }, { key: 'platform_commission_rides', value: '25' },
    ]});
    const r = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'NGN', 'NG');
    expect(r.estimatedFare).toBe(2000);           // 1000+650+250=1900 +100
    expect(r.commissionRate).toBe(0.25);
  });
});

describe('the commissionRate bug', () => {
  test('estimate + final fare return the rate actually applied (was undefined → callers used 0.20)', async () => {
    const { engine } = load({ systemSettings: [{ key: 'platform_commission_rides', value: '12' }] });
    const est = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'NGN', 'NG');
    expect(est.commissionRate).toBe(0.12);
    const fin = await engine.calculateFinalFare({ distanceKm: 5, vehicleType: 'CAR', requestedAt: OFF_PEAK, currency: 'NGN', countryCode: 'NG' });
    expect(fin.commissionRate).toBe(0.12);
    const del = await engine.calculateDeliveryFee(5, 0, 'NGN', 'NG');
    expect(del.commissionRate).toBe(0.15);
  });
});

describe('per-country isolation', () => {
  test('Mali has its own commission and rounds in CFA steps; Nigeria is unaffected', async () => {
    const { engine, svc } = load();
    await svc.saveCountrySettings('ML', {
      ride_base_fare_car: 600, ride_per_km_car: 200, ride_per_minute_car: 10, ride_minimum_fare_car: 800,
      ride_booking_fee: 150, platform_commission_rides: 10,
    }, 'admin');
    engine.invalidateFareCache();

    const ml = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'XOF', 'ML');
    // Mali local = UTC+0 → 11:00 Tuesday, no surge. 600+1000+166.67=1766.67 → +150 = 1916.67 → step 25 → 1925
    expect(ml.estimatedFare).toBe(1925);
    expect(ml.currency).toBe('XOF');
    expect(ml.commissionRate).toBe(0.10);
    expect(ml.roundingStep).toBe(25);

    const ng = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'NGN', 'NG');
    expect(ng.estimatedFare).toBe(1500);
    expect(ng.commissionRate).toBe(0.20);
  });

  test('an unconfigured CFA market gets scaled starter prices, not Naira numbers', async () => {
    const { engine } = load();
    const ml = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'XOF', 'ML');
    const ng = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'NGN', 'NG');
    expect(ml.estimatedFare).toBeLessThan(ng.estimatedFare);          // 1500 NGN ≈ 555 XOF
    expect(ml.estimatedFare % 25).toBe(0);
    expect(Number.isInteger(ml.estimatedFare)).toBe(true);
  });

  test('Guinea (GNF) rounds to 500', async () => {
    const { engine } = load();
    const gn = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'GNF', 'GN');
    expect(gn.estimatedFare % 500).toBe(0);
  });

  test('delivery uses the country rates', async () => {
    const { engine, svc } = load();
    await svc.saveCountrySettings('ML', { delivery_base_fee: 1000, delivery_per_km: 100, delivery_weight_fee_per_kg: 50, platform_commission_deliveries: 8 }, 'a');
    engine.invalidateFareCache();
    const d = await engine.calculateDeliveryFee(4, 2, 'XOF', 'ML');
    expect(d.estimatedFee).toBe(1500);            // 1000 + 400 + 100
    expect(d.platformFee).toBe(120);              // 8%
    expect(d.partnerEarnings).toBe(1380);
  });
});

describe('surge is evaluated in the country\'s local time', () => {
  test('same instant, different countries → different surge', async () => {
    const { engine } = load();
    // 05:30 UTC on a Tuesday.
    //   Lagos (UTC+1)      = 06:30 → Morning Rush (×1.4)
    //   Bamako (UTC+0)     = 05:30 → nothing (Early Morning ends at 5)
    const t = new Date('2026-09-29T05:30:00Z');
    await engine.getSettings('NG'); await engine.getSettings('ML');
    expect(engine.getSurgeMultiplier(t, 'NG').multiplier).toBe(1.4);
    expect(engine.getSurgeMultiplier(t, 'ML').multiplier).toBe(1.0);
  });

  test('country-specific surge windows and offset override', async () => {
    const { engine, svc } = load();
    await svc.saveCountrySettings('ML', {
      surge_windows: [{ label: 'Market day', days: [2], hourStart: 10, hourEnd: 14, multiplier: 2 }],
      utc_offset_minutes: 0,
    }, 'a');
    engine.invalidateFareCache();
    await engine.getSettings('ML');
    expect(engine.getSurgeMultiplier(new Date('2026-09-29T11:00:00Z'), 'ML')).toEqual({ multiplier: 2, label: 'Market day' });
  });
});

describe('driver floor', () => {
  test('respects the country rounding step', () => {
    const { engine } = load();
    expect(engine.applyDriverFloor(1130, 1000, 25).adjustedFare).toBe(1125);
    expect(engine.applyDriverFloor(5000, 1000, 25)).toMatchObject({ clamped: true, adjustedFare: 1300 });
    expect(engine.applyDriverFloor(500, 1000)).toMatchObject({ multiplier: 1 });
  });
});
