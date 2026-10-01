'use strict';
jest.mock('../src/lib/prisma', () => ({}));
const { body, validationResult } = require('express-validator');
const { checkPhoneForCountry, normalizePhoneForStorage, phoneCandidates, isPhoneAcceptable, registrationPhoneCheck, countryOfPhone } = require('../src/utils/phone');

// A real number from every market we serve (app sends +<dial><national digits>).
const SAMPLES = {
  NG: '+2348012345678', GH: '+233241234567', ML: '+22376427484', SN: '+221771234567', CI: '+2250701234567',
  CM: '+237671234567', MG: '+261321234567', BW: '+26771234567', GN: '+224621234567', GW: '+2459551234',
  SL: '+23276123456', CD: '+243812345678', CF: '+23672123456', BF: '+22670123456', NE: '+22790123456',
  TG: '+22890123456', BJ: '+2290197123456', GM: '+2207123456', CV: '+2389912345', LR: '+231771234567',
};

describe('registration accepts a real number from every market', () => {
  test.each(Object.entries(SAMPLES))('%s %s', (cc, num) => {
    expect(checkPhoneForCountry(num, cc)).toEqual({ ok: true });
    expect(countryOfPhone(num)).toBe(cc);
  });
  test('THE BUG: the Mali number from the report (76 42 74 84) registers', () => {
    expect(checkPhoneForCountry('+22376427484', 'ML').ok).toBe(true);
    expect(checkPhoneForCountry('+223 76 42 74 84', 'ML').ok).toBe(true);
  });
});

describe('Nigeria is exactly as strict as before', () => {
  test.each(['+2348012345678', '08012345678', '+2347012345678', '09012345678'])('%s ok', n => expect(checkPhoneForCountry(n, 'NG').ok).toBe(true));
  test.each(['+2346012345678', '8012345678', '0801234567', '+234801234567890', 'abc'])('%s rejected', n => {
    const r = checkPhoneForCountry(n, 'NG');
    expect(r.ok).toBe(false); expect(r.reason).toMatch(/Nigerian/);
  });
  test('missing country defaults to Nigeria (older app versions)', () => {
    expect(checkPhoneForCountry('08012345678').ok).toBe(true);
  });
});

describe('rejects what is wrong', () => {
  test('a number from another country', () => {
    expect(checkPhoneForCountry('+2348012345678', 'ML').reason).toMatch(/does not belong to the selected country \(expected \+223\)/);
    expect(checkPhoneForCountry('+22376427484', 'NG').ok).toBe(false);
  });
  test('missing country code, too short, too long, letters, unknown country', () => {
    expect(checkPhoneForCountry('76427484', 'ML').reason).toMatch(/\+223 country code/);
    expect(checkPhoneForCountry('+22312', 'ML').ok).toBe(false);
    expect(checkPhoneForCountry('+2237642748412345', 'ML').ok).toBe(false);
    expect(checkPhoneForCountry('+223abc', 'ML').ok).toBe(false);
    expect(checkPhoneForCountry('+22376427484', 'ZZ').reason).toMatch(/not available/);
  });
  test('a trunk 0 after the dial code is dropped when stored', () => {
    expect(normalizePhoneForStorage('+223 076 42 74 84', 'ML')).toBe('+22376427484');
    expect(normalizePhoneForStorage('+22376427484', 'ML')).toBe('+22376427484');
    expect(normalizePhoneForStorage('08012345678', 'NG')).toBe('08012345678');        // legacy, untouched
    expect(normalizePhoneForStorage('+2348012345678', 'NG')).toBe('+2348012345678');
  });
});

describe('the real register validator (what Express runs)', () => {
  const run = async (b) => {
    const req = { body: b };
    await body('phone').custom(registrationPhoneCheck).run(req);
    return validationResult(req);
  };
  test('Mali user: passes', async () => expect((await run({ phone: '+22376427484', countryCode: 'ML' })).isEmpty()).toBe(true));
  test('Nigerian user, no country sent: passes', async () => expect((await run({ phone: '08012345678' })).isEmpty()).toBe(true));
  test('Mali number with country Nigeria: fails with the Nigerian message', async () => {
    const r = await run({ phone: '+22376427484', countryCode: 'NG' });
    expect(r.array()[0].msg).toMatch(/valid Nigerian/);
  });
  test('Nigerian number with country Mali: fails', async () => expect((await run({ phone: '+2348012345678', countryCode: 'ML' })).isEmpty()).toBe(false));
});

describe('routes that take any user\'s phone', () => {
  test.each(Object.values(SAMPLES))('%s accepted', n => expect(isPhoneAcceptable(n)).toBe(true));
  test('numbers that worked before still work', () => {
    expect(isPhoneAcceptable('08012345678')).toBe(true);
    expect(isPhoneAcceptable('+14155552671')).toBe(true);
  });
  test('garbage is rejected', () => {
    for (const n of ['', 'hello', '123', '+223']) expect(isPhoneAcceptable(n)).toBe(false);
  });
});

// ── Closed 10-digit plans: the leading 0 is part of the number ───────────────
// Côte d'Ivoire since 31 Jan 2021 (ARTCI), Benin since 30 Nov 2024 (ARCEP-Bénin).
describe("Côte d'Ivoire keeps its leading 0", () => {
  test.each(['+2250701234567', '+225 07 01 23 45 67', '+2250501234567', '+2250101234567'])('%s ok', n =>
    expect(checkPhoneForCountry(n, 'CI').ok).toBe(true));
  test('stored WITH the 0 (never stripped)', () => {
    expect(normalizePhoneForStorage('+225 07 01 23 45 67', 'CI')).toBe('+2250701234567');
    expect(normalizePhoneForStorage('+2250701234567', 'CI')).toBe('+2250701234567');
  });
  test('zero-stripped (9 digits) and pre-2021 8-digit numbers are rejected', () => {
    expect(checkPhoneForCountry('+225701234567', 'CI').ok).toBe(false);
    expect(checkPhoneForCountry('+22507123456', 'CI').ok).toBe(false);
    expect(checkPhoneForCountry('+225701234567', 'CI').reason).toMatch(/10-digit/);
  });
});

describe('Benin: 10 digits starting 01', () => {
  test('current format ok and stored as-is', () => {
    expect(checkPhoneForCountry('+2290197000000', 'BJ').ok).toBe(true);
    expect(normalizePhoneForStorage('+229 01 97 00 00 00', 'BJ')).toBe('+2290197000000');
  });
  test('legacy 8-digit number (older app builds) is upgraded with 01', () => {
    expect(checkPhoneForCountry('+22997000000', 'BJ').ok).toBe(true);
    expect(normalizePhoneForStorage('+22997000000', 'BJ')).toBe('+2290197000000');
  });
  test('wrong shapes rejected', () => {
    for (const n of ['+2290297000000', '+229970000', '+229019700000012', '+229abc']) {
      expect(checkPhoneForCountry(n, 'BJ').ok).toBe(false);
    }
  });
});

describe('other markets are unchanged by the closed-plan rule', () => {
  test('trunk 0 still dropped for Mali / Ghana / Senegal', () => {
    expect(normalizePhoneForStorage('+223 076 42 74 84', 'ML')).toBe('+22376427484');
    expect(normalizePhoneForStorage('+2330241234567', 'GH')).toBe('+233241234567');
    expect(normalizePhoneForStorage('+2210771234567', 'SN')).toBe('+221771234567');
  });
  test('a foreign number is never mangled by normalisation', () => {
    expect(normalizePhoneForStorage('+14155552671', 'ML')).toBe('+14155552671');
    expect(normalizePhoneForStorage('+22376427484', 'CI')).toBe('+22376427484');
  });
});

describe('phoneCandidates (wallet lookup)', () => {
  test('Ivorian local input matches the stored number that keeps its 0', () => {
    expect(phoneCandidates('07 01 23 45 67', '225', 'CI')).toContain('+2250701234567');
    expect(phoneCandidates('2250701234567', '225', 'CI')).toContain('+2250701234567');
  });
  test('Benin local input, with or without 01, matches the stored number', () => {
    expect(phoneCandidates('0197000000', '229', 'BJ')).toContain('+2290197000000');
    expect(phoneCandidates('97000000', '229', 'BJ')).toContain('+2290197000000');
    expect(phoneCandidates('22997000000', '229', 'BJ')).toContain('+2290197000000');
  });
  test('Nigeria and Mali behave exactly as before', () => {
    expect(phoneCandidates('08012345678', '234', 'NG')).toEqual(expect.arrayContaining(['+2348012345678']));
    expect(phoneCandidates('76 42 74 84', '223', 'ML')).toContain('+22376427484');
    expect(phoneCandidates('+22376427484', '223', 'ML')).toContain('+22376427484');
  });
  test('empty input', () => expect(phoneCandidates('', '223', 'ML')).toEqual([]));
});
