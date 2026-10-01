'use strict';
jest.mock('../src/lib/prisma', () => ({}));

const setup = ({ countries = [] } = {}) => {
  jest.resetModules();
  const created = [];
  const fake = {
    country: { findUnique: async ({ where }) => countries.find(c => c.code === where.code) ?? null },
    user: { findFirst: async () => null, create: async ({ data }) => { created.push(data); return { id: 'u1', email: data.email, firstName: data.firstName, role: data.role, countryCode: data.countryCode, phone: data.phone }; } },
  };
  // Tables this test doesn't care about (wallet, sessions…) answer with harmless defaults.
  const permissive = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : new Proxy({}, { get: () => async () => ({ id: 'x', balance: 0, currency: 'XOF' }) })) });
  jest.doMock('../src/lib/prisma', () => permissive);
  jest.doMock('../src/services/notification.service', () => ({ notify: async () => {}, TYPES: { ACCOUNT_WELCOME: 'w' } }));
  jest.doMock('../src/services/email.service', () => ({}));
  jest.doMock('../src/services/otp.service', () => ({}));
  jest.doMock('../src/utils/auditLog', () => ({ logActivity: () => {} }));
  jest.doMock('jsonwebtoken', () => ({ sign: () => 'tok', verify: () => ({}) }));
  jest.doMock('bcryptjs', () => ({ hash: async () => 'h', compare: async () => true }));
  const ctrl = require('../src/controllers/auth.controller');
  return { ctrl, created };
};
const reg = async (ctrl, b) => {
  const out = {}; const res = { status(c) { out.status = c; return this; }, json(x) { out.body = x; return this; } };
  try { await ctrl.register({ body: { email: 'a@b.co', password: 'password1', firstName: 'Andrey', lastName: 'Diarra', role: 'CUSTOMER', ...b }, headers: {}, ip: '1' }, res); } catch (e) { out.error = e; }
  return out;
};
const ML = { code: 'ML', isActive: true }; const SN = { code: 'SN', isActive: false };

test('a Malian registers: country saved, phone stored as clean E.164', async () => {
  const { ctrl, created } = setup({ countries: [ML] });
  const r = await reg(ctrl, { phone: '+223 076 42 74 84', countryCode: 'ML' });
  expect(r.error).toBeUndefined();
  expect(created[0]).toMatchObject({ phone: '+22376427484', countryCode: 'ML' });
});
test('a paused country cannot be registered into, even by calling the API directly', async () => {
  const { ctrl, created } = setup({ countries: [SN] });
  expect((await reg(ctrl, { phone: '+221771234567', countryCode: 'SN' })).error.message).toMatch(/not available in that country yet/);
  expect((await reg(ctrl, { phone: '+221771234567', countryCode: 'ZZ' })).error.message).toMatch(/not available/);
  expect(created).toHaveLength(0);
});
test('Nigeria still works with no country sent, and the phone is stored exactly as entered', async () => {
  const { ctrl, created } = setup();
  expect((await reg(ctrl, { phone: '08012345678' })).error).toBeUndefined();
  expect(created[0]).toMatchObject({ phone: '08012345678', countryCode: 'NG' });
});
