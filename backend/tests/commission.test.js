'use strict';
jest.mock('../src/lib/prisma', () => ({}));
const { makeFakePrisma, COUNTRIES } = require('./helpers/fakePrisma');

const load = () => {
  jest.resetModules();
  const fake = makeFakePrisma({ countries: Object.values(COUNTRIES) });
  // users → country
  const users = { ngUser: 'NG', mlUser: 'ML', gnUser: 'GN', ghUser: 'GH' };
  fake.user = { findUnique: async ({ where }) => users[where.id] ? { countryCode: users[where.id] } : null };
  jest.doMock('../src/lib/prisma', () => fake);
  const svc = require('../src/services/countrySettings.service');
  const engine = require('../src/utils/fareEngine');
  const { paymentSplit } = require('../src/services/paymentSplit.service');
  engine.invalidateFareCache(); require('../src/services/country.service').invalidateCountryCache();
  return { svc, engine, paymentSplit };
};
const OFF_PEAK = new Date('2026-09-29T11:00:00Z');

test('an admin can set commission to exactly 0% and it is honoured everywhere', async () => {
  const { svc, engine, paymentSplit } = load();
  const res = await svc.saveCountrySettings('ML', { platform_commission_rides: 0, platform_commission_deliveries: 0 }, 'admin');
  expect(res.applied.find(a => a.key === 'platform_commission_rides')).toMatchObject({ to: 0, source: 'country' });
  engine.invalidateFareCache();

  // fare quote
  const est = await engine.estimateFare(5, 'CAR', OFF_PEAK, 1.0, 'XOF', 'ML');
  expect(est.commissionRate).toBe(0);
  expect(est.platformRevenue.commission).toBe(0);
  expect(est.driverEarnings).toBe(est.estimatedFare - est.bookingFee);

  // final fare + delivery
  const fin = await engine.calculateFinalFare({ distanceKm: 5, vehicleType: 'CAR', requestedAt: OFF_PEAK, currency: 'XOF', countryCode: 'ML' });
  expect(fin.commissionRate).toBe(0);
  const del = await engine.calculateDeliveryFee(4, 1, 'XOF', 'ML');
  expect(del.platformFee).toBe(0);
  expect(del.partnerEarnings).toBe(del.estimatedFee);

  // the actual money split when the customer pays (this was hard-coded 20/80)
  const ride = await paymentSplit('mlUser', { rideId: 'r1' }, 10000);
  expect(ride).toEqual({ platformFee: 0, driverEarnings: 10000, commissionRate: 0 });
  const dlv = await paymentSplit('mlUser', { deliveryId: 'd1' }, 10000);
  expect(dlv).toMatchObject({ platformFee: 0, driverEarnings: 10000 });
});

test('each country has its own rate; changing one never moves another', async () => {
  const { svc, engine, paymentSplit } = load();
  await svc.saveCountrySettings('ML', { platform_commission_rides: 0 }, 'a');
  await svc.saveCountrySettings('GN', { platform_commission_rides: 12.5 }, 'a');
  engine.invalidateFareCache();

  expect((await paymentSplit('mlUser', { rideId: 'x' }, 20000)).platformFee).toBe(0);
  expect((await paymentSplit('gnUser', { rideId: 'x' }, 20000)).platformFee).toBe(2500);
  expect((await paymentSplit('ngUser', { rideId: 'x' }, 20000)).platformFee).toBe(4000);   // untouched default 20%
  expect((await paymentSplit('ghUser', { rideId: 'x' }, 20000)).platformFee).toBe(4000);   // untouched, inherits 20%

  // rides and deliveries are separate rates within one country
  await svc.saveCountrySettings('GN', { platform_commission_deliveries: 5 }, 'a');
  engine.invalidateFareCache();
  expect((await paymentSplit('gnUser', { deliveryId: 'd' }, 20000)).platformFee).toBe(1000);
  expect((await paymentSplit('gnUser', { rideId: 'r' }, 20000)).platformFee).toBe(2500);
});

test('platform fee + earner share always add back to exactly the amount paid (whole-unit currency)', async () => {
  const { svc, engine, paymentSplit } = load();
  await svc.saveCountrySettings('ML', { platform_commission_rides: 13.3 }, 'a');
  engine.invalidateFareCache();
  for (const amt of [1, 333, 1234, 9999, 100001]) {
    const s = await paymentSplit('mlUser', { rideId: 'r' }, amt);
    expect(Number.isInteger(s.platformFee) && Number.isInteger(s.driverEarnings)).toBe(true);
    expect(s.platformFee + s.driverEarnings).toBe(amt);
  }
});

test('the old global commission still drives Nigeria', async () => {
  const { engine, paymentSplit } = load();
  const jest_ = require('../src/lib/prisma');
  jest_._db.systemSettings.push({ key: 'platform_commission_rides', value: '18' });
  engine.invalidateFareCache();
  expect((await paymentSplit('ngUser', { rideId: 'r' }, 10000)).platformFee).toBe(1800);
});
