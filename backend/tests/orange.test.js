'use strict';
jest.mock('axios');

const load = (env) => {
  jest.resetModules();
  for (const k of Object.keys(process.env)) if (k.startsWith('ORANGE_')) delete process.env[k];
  Object.assign(process.env, env);
  const axios = require('axios');
  axios.post = jest.fn().mockResolvedValue({ data: { access_token: 'tok', expires_in: 3600 } });
  return { orange: require('../src/services/orange.service'), axios };
};

test('token call sends the ORANGE_AUTHORISATION_HEADER as the Authorization header', async () => {
  const { orange, axios } = load({ ORANGE_AUTHORISATION_HEADER: 'Basic abc123==', ORANGE_MERCHANT_KEY: 'mk' });
  await orange.getAccessToken();
  expect(axios.post).toHaveBeenCalledTimes(1);
  const [url, body, cfg] = axios.post.mock.calls[0];
  expect(url).toMatch(/\/oauth\/v3\/token$/);
  expect(body).toBe('grant_type=client_credentials');
  expect(cfg.headers.Authorization).toBe('Basic abc123==');
});

test('accepts the value with or without the "Basic " prefix, any case', () => {
  expect(load({ ORANGE_AUTHORISATION_HEADER: 'abc' }).orange.getAuthorisationHeader()).toBe('Basic abc');
  expect(load({ ORANGE_AUTHORISATION_HEADER: 'basic abc' }).orange.getAuthorisationHeader()).toBe('Basic abc');
  expect(load({ ORANGE_AUTHORISATION_HEADER: '  Basic abc  ' }).orange.getAuthorisationHeader()).toBe('Basic abc');
});

test('falls back to CLIENT_ID:CLIENT_SECRET when no header is configured', () => {
  const { orange } = load({ ORANGE_CLIENT_ID: 'id', ORANGE_CLIENT_SECRET: 'secret' });
  expect(orange.getAuthorisationHeader()).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`);
});

test('the header alone (plus merchant key) is enough to activate Orange', () => {
  expect(load({ ORANGE_AUTHORISATION_HEADER: 'Basic x', ORANGE_MERCHANT_KEY: 'mk' }).orange.isOrangeConfigured()).toBe(true);
  expect(load({ ORANGE_AUTHORISATION_HEADER: 'Basic x' }).orange.isOrangeConfigured()).toBe(false);   // no merchant key
  expect(load({ ORANGE_MERCHANT_KEY: 'mk' }).orange.isOrangeConfigured()).toBe(false);                 // no credentials
});

test('webhook token round-trips and rejects forgeries', () => {
  const { orange } = load({ ORANGE_AUTHORISATION_HEADER: 'Basic x', ORANGE_MERCHANT_KEY: 'mk', ORANGE_WEBHOOK_SECRET: 'sekret' });
  const crypto = require('crypto');
  const good = crypto.createHmac('sha256', 'sekret').update('ORDER-1').digest('hex');
  expect(orange.validateWebhook('ORDER-1', good)).toBe(true);
  expect(orange.validateWebhook('ORDER-2', good)).toBe(false);
  expect(orange.validateWebhook('ORDER-1', 'nope')).toBe(false);
});

describe('cash-out partner identity', () => {
  const base = { ORANGE_AUTHORISATION_HEADER: 'Basic x', ORANGE_MERCHANT_KEY: 'mk', ORANGE_B2C_ENABLED: 'true', ORANGE_B2C_PIN: '1234' };

  test('default: channel user identified by phone number (MSISDN) + PIN, as in Orange\'s cash-in spec', async () => {
    const { orange, axios } = load({ ...base, ORANGE_MERCHANT_MSISDN: '+221 77 190 02 62' });
    const spy0 = jest.fn().mockResolvedValue({ data: { transactionId: 'T0' } });
    axios.mockImplementation(spy0);
    await orange.cashOut({ amount: 5000, msisdn: '0701234567', reference: 'R0', currency: 'XOF', countryCode: 'SN' });
    expect(spy0.mock.calls[0][0].data.partner).toEqual({ idType: 'MSISDN', id: '221771900262', encryptedPinCode: '1234', walletType: 'PRINCIPAL' });
  });

  test('agent-code mode → idType CODE', async () => {
    const { orange, axios } = load({ ...base, ORANGE_B2C_PARTNER_ID_TYPE: 'CODE', ORANGE_B2C_AGENT_CODE: 'AGENT42' });
    const spy = jest.fn().mockResolvedValue({ data: { transactionId: 'T1', status: 'SUCCESS' } });
    axios.mockImplementation(spy);
    const r = await orange.cashOut({ amount: 5000, msisdn: '07 01 23 45 67', reference: 'R1', currency: 'XOF', countryCode: 'SN' });
    const sent = spy.mock.calls[0][0].data;
    expect(sent.partner).toMatchObject({ idType: 'CODE', id: 'AGENT42', encryptedPinCode: '1234' });
    expect(sent.customer).toEqual({ idType: 'MSISDN', id: '221701234567' });
    expect(r.transferCode).toBe('T1');
  });

  test('missing agent code / PIN fail loudly with 503 instead of sending a broken request', async () => {
    const { orange } = load({ ...base });
    await expect(orange.cashOut({ amount: 1, msisdn: '1', reference: 'r' })).rejects.toThrow(/ORANGE_MERCHANT_MSISDN/);
    const l2 = load({ ...base, ORANGE_MERCHANT_MSISDN: '221771900262', ORANGE_B2C_PIN: '' });
    await expect(l2.orange.cashOut({ amount: 1, msisdn: '1', reference: 'r' })).rejects.toThrow(/ORANGE_B2C_PIN/);
  });

  test('PIN is RSA-encrypted (PKCS#1 v1.5) when Orange supplies a public key', async () => {
    const crypto = require('crypto');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).replace(/\n/g, '\\n');
    const { orange, axios } = load({ ...base, ORANGE_MERCHANT_MSISDN: '221771900262', ORANGE_B2C_PUBLIC_KEY: pem });
    const spy = jest.fn().mockResolvedValue({ data: {} });
    axios.mockImplementation(spy);
    await orange.cashOut({ amount: 1000, msisdn: '0700000000', reference: 'r' });

    const enc = spy.mock.calls[0][0].data.partner.encryptedPinCode;
    expect(enc).not.toBe('1234');

    // Node >= 20.11.1 / 22 refuses RSA_PKCS1_PADDING for privateDecrypt (CVE-2023-46809),
    // so decrypt raw and strip the PKCS#1 v1.5 padding by hand: 00 02 <non-zero bytes> 00 <message>
    const raw = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_NO_PADDING },
      Buffer.from(enc, 'base64')
    );
    expect(raw[0]).toBe(0x00);
    expect(raw[1]).toBe(0x02);
    const sep = raw.indexOf(0x00, 2);
    expect(sep).toBeGreaterThanOrEqual(10); // spec requires at least 8 padding bytes
    expect(raw.subarray(sep + 1).toString()).toBe('1234');
  });
});