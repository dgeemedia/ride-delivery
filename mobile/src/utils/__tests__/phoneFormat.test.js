import { parsePhone, formatPhone, isPlausiblePhoneLength, COUNTRY_PHONE_DIGITS } from '../phoneFormat';

const DIAL = {
  NG: '+234', GH: '+233', CI: '+225', SN: '+221', ML: '+223', TG: '+228', BJ: '+229', BF: '+226',
  NE: '+227', GN: '+224', GW: '+245', SL: '+232', LR: '+231', GM: '+220', CV: '+238',
  CM: '+237', MG: '+261', BW: '+267', CD: '+243', CF: '+236',
};
const fmt = (raw, cc) => formatPhone(raw, cc, DIAL[cc]);
const ok = (raw, cc) => isPlausiblePhoneLength(raw, cc, DIAL[cc]);

describe('the Mali number from the bug report', () => {
  test.each(['76-42 74 84', '76427484', '0 76 42 74 84', '+223 76 42 74 84', '00223 76 42 74 84', '22376427484'])('%s → +22376427484', raw => {
    expect(fmt(raw, 'ML')).toBe('+22376427484');
    expect(ok(raw, 'ML')).toBe(true);
  });
  test('a national number that merely STARTS with the dial digits is not mistaken for a country code', () => {
    expect(fmt('22 34 56 78', 'ML')).toBe('+22322345678');
    expect(ok('22 34 56 78', 'ML')).toBe(true);
  });
});

describe('Nigeria is unchanged', () => {
  test.each(['0801 234 5678', '8012345678', '+234 801 234 5678', '2348012345678'])('%s', raw => {
    expect(fmt(raw, 'NG')).toBe('+2348012345678');
    expect(ok(raw, 'NG')).toBe(true);
  });
});

describe("Côte d'Ivoire keeps the leading 0 (10-digit plan)", () => {
  test.each(['07 01 23 45 67', '0701234567', '+225 07 01 23 45 67', '00225 07 01 23 45 67', '225 07 01 23 45 67'])('%s → +2250701234567', raw => {
    expect(fmt(raw, 'CI')).toBe('+2250701234567');
    expect(ok(raw, 'CI')).toBe(true);
  });
  test('missing the 0 (9 digits) or old 8-digit numbers are flagged', () => {
    expect(ok('701234567', 'CI')).toBe(false);
    expect(ok('01234567', 'CI')).toBe(false);
  });
});

describe('Benin: 10 digits starting 01, old 8-digit numbers upgraded', () => {
  test.each(['01 97 00 00 00', '0197000000', '+229 01 97 00 00 00', '97 00 00 00', '+229 97 00 00 00', '229 97000000'])('%s → +2290197000000', raw => {
    expect(fmt(raw, 'BJ')).toBe('+2290197000000');
    expect(ok(raw, 'BJ')).toBe(true);
  });
  test('wrong length flagged', () => {
    expect(ok('197000', 'BJ')).toBe(false);
  });
});

describe('trunk 0 is still dropped everywhere else', () => {
  test.each([['GH', '024 123 4567', '+233241234567'], ['SN', '77 123 45 67', '+221771234567'], ['TG', '90 12 34 56', '+22890123456']])('%s %s', (cc, raw, e164) => {
    expect(fmt(raw, cc)).toBe(e164);
    expect(ok(raw, cc)).toBe(true);
  });
});

test('every market in the table has a dial prefix we test', () => {
  expect(Object.keys(COUNTRY_PHONE_DIGITS).sort()).toEqual(Object.keys(DIAL).sort());
});

test('unknown country / missing prefix fall back safely', () => {
  expect(isPlausiblePhoneLength('123', 'ZZ')).toBe(true);
  expect(parsePhone('0801 234 5678', 'NG').e164).toBe('+2348012345678'); // default prefix +234
});
