'use strict';
jest.mock('../src/lib/prisma', () => ({}));

const load = () => {
  jest.resetModules();
  process.env.FLUTTERWAVE_WEBHOOK_HASH = 'h';
  const applied = [];
  jest.doMock('../src/services/payoutSettlement.service', () => ({ applyTransferResult: async (a) => { applied.push(a); return { handled: true }; } }));
  jest.doMock('../src/utils/auditLog', () => ({ logActivity: () => {} }));
  jest.doMock('../src/services/notification.service', () => ({ notify: async () => {}, TYPES: {} }));
  jest.doMock('../src/services/email.service', () => ({}));
  return { applied, wallet: require('../src/controllers/wallet.controller'), payment: require('../src/controllers/payment.controller') };
};
const hit = async (fn, body, hash = 'h') => {
  const out = {};
  const res = { sendStatus(c) { out.status = c; return this; }, status(c) { out.status = c; return this; }, json() { return this; } };
  await fn({ headers: { 'verif-hash': hash }, body }, res);
  return out;
};
const failed = { event: 'transfer.completed', data: { id: 77, reference: 'WD-1', status: 'FAILED', complete_message: 'Invalid number' } };
const ok     = { event: 'transfer.completed', data: { id: 77, reference: 'WD-1', status: 'SUCCESSFUL' } };

test.each([['wallet webhook', (m) => m.wallet.verifyFlutterwaveWebhook], ['payments webhook', (m) => m.payment.flutterwaveWebhook]])(
  '%s: a failed transfer triggers the refund, a successful one confirms it', async (_n, pick) => {
    const m = load();
    expect((await hit(pick(m), failed)).status).toBe(200);
    expect(m.applied[0]).toEqual({ reference: 'WD-1', outcome: 'FAILED', message: 'Invalid number', transferCode: '77' });
    await hit(pick(m), ok);
    expect(m.applied[1]).toMatchObject({ reference: 'WD-1', outcome: 'SUCCESS' });
  });

test('a webhook with the wrong signature is rejected and applies nothing', async () => {
  const m = load();
  expect((await hit(m.wallet.verifyFlutterwaveWebhook, failed, 'wrong')).status).toBe(401);
  expect((await hit(m.payment.flutterwaveWebhook, failed, 'wrong')).status).toBe(401);
  expect(m.applied).toHaveLength(0);
});

test('in-progress transfer statuses are acknowledged but not acted on', async () => {
  const m = load();
  await hit(m.wallet.verifyFlutterwaveWebhook, { event: 'transfer.completed', data: { reference: 'WD-1', status: 'NEW' } });
  expect(m.applied).toHaveLength(0);
});
