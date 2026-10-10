'use strict';
jest.mock('../src/lib/prisma', () => ({}));
const { makeFakePrisma, COUNTRIES } = require('./helpers/fakePrisma');

describe('supportI18n + routing', () => {
  test('all 11 languages fully translated, placeholders filled', () => {
    const { SUPPORTED_LANGUAGES, tr } = require('../src/utils/supportI18n');
    expect(SUPPORTED_LANGUAGES).toHaveLength(11);
    for (const l of SUPPORTED_LANGUAGES) for (const k of ['submitted', 'replyTitle', 'resolvedTitle', 'resolvedOutro']) {
      const v = tr(l, k, { n: 'T1', name: 'Awa' });
      expect(v).not.toMatch(/\{\w+\}/);
      if (l !== 'en') expect(v).not.toBe(tr('en', k, { n: 'T1', name: 'Awa' }));
    }
    expect(tr('fr', 'replyTitle', { n: 'TKT-1' })).toBe('Mise à jour du ticket n° TKT-1');
    expect(require('../src/utils/supportI18n').normalizeLanguage('xx', 'fr')).toBe('fr');
  });
  test('coverage rules; never orphan a ticket', () => {
    const r = require('../src/utils/supportRouting'); const ML = { countryCode: 'ML', language: 'fr' };
    expect(r.coversTicket({}, ML)).toBe(true);
    expect(r.coversTicket({ supportCountries: ['NG'] }, ML)).toBe(false);
    expect(r.coversTicket({ supportCountries: ['ml'], supportLanguages: ['FR'] }, ML)).toBe(true);
    const a = { id: 'a', role: 'SUPPORT', supportCountries: ['ML'] }, b = { id: 'b', role: 'SUPPORT', supportCountries: ['NG'] };
    expect(r.pickRecipients([a, b], ML).map(s => s.id)).toEqual(['a']);
    const s = { id: 's', role: 'SUPER_ADMIN', supportCountries: ['GH'] };
    expect(r.pickRecipients([b, s], ML).map(x => x.id)).toEqual(['s']);
    expect(r.ticketScopeWhere({ role: 'SUPER_ADMIN', supportCountries: ['ML'] })).toEqual({});
    expect(r.ticketScopeWhere({ role: 'SUPPORT', supportCountries: ['ml'] })).toEqual({ countryCode: { in: ['ML'] } });
  });
});

describe('per-country support contact', () => {
  const GLOBAL = [{ key: 'support_phone', value: '+2348000000001' }, { key: 'support_whatsapp', value: '+2348000000002' }, { key: 'support_email', value: 'help@diakite.app' }];
  const setup = () => { jest.resetModules(); const fake = makeFakePrisma({ countries: [COUNTRIES.NG, COUNTRIES.ML, COUNTRIES.GH], systemSettings: GLOBAL }); jest.doMock('../src/lib/prisma', () => fake); return { fake, svc: require('../src/services/countrySettings.service') }; };
  test('Nigeria keeps global numbers; Mali never gets them', async () => {
    const { svc } = setup();
    expect((await svc.getEffectiveSettings('NG')).values.support_phone).toBe('+2348000000001');
    const ml = (await svc.getEffectiveSettings('ML')).values;
    expect(ml.support_phone).toBe(''); expect(ml.support_whatsapp).toBe(''); expect(ml.support_email).toBe('help@diakite.app');
  });
  test('admin sets Mali numbers (normalised); validation; empty allowed; reset inherits', async () => {
    const { svc } = setup();
    await svc.saveCountrySettings('ML', { support_phone: '+223 20 22 00 00', support_whatsapp: '00223 70-00-00-00', support_email: 'ml@diakite.app' }, 'a');
    const v = (await svc.getEffectiveSettings('ML')).values;
    expect(v.support_phone).toBe('+22320220000'); expect(v.support_whatsapp).toBe('+22370000000'); expect(v.support_email).toBe('ml@diakite.app');
    expect((await svc.getEffectiveSettings('NG')).values.support_phone).toBe('+2348000000001');
    await expect(svc.saveCountrySettings('ML', { support_phone: '20220000' }, 'a')).rejects.toThrow(/country code/i);
    await expect(svc.saveCountrySettings('ML', { support_email: 'nope' }, 'a')).rejects.toThrow(/email/i);
    await svc.saveCountrySettings('ML', { support_phone: '' }, 'a');
    expect((await svc.getEffectiveSettings('ML')).values.support_phone).toBe('');
    await svc.saveCountrySettings('ML', { support_email: null }, 'a');
    expect((await svc.getEffectiveSettings('ML')).values.support_email).toBe('help@diakite.app');
  });
  test('copySettings never clones support numbers', async () => {
    const { fake, svc } = setup();
    await svc.saveCountrySettings('NG', { support_email: 'ng@diakite.app' }, 'a');
    await svc.copySettings('ML', 'NG', { factor: 0.37, adminId: 'a' });
    expect(fake._db.countrySettings.filter(s => s.countryCode === 'ML' && s.key.startsWith('support_'))).toEqual([]);
  });
});

describe('GET /api/status/contact', () => {
  const request = require('supertest'); const jwt = require('jsonwebtoken'); const express = require('express');
  process.env.JWT_SECRET = 'test-secret';
  const build = async (users = {}) => {
    jest.resetModules();
    const fake = makeFakePrisma({ countries: [COUNTRIES.NG, COUNTRIES.ML], systemSettings: [
      { key: 'support_phone', value: '+2348000000001' }, { key: 'support_whatsapp', value: '+2348000000002' }, { key: 'support_email', value: 'help@diakite.app' }],
      countrySettings: [{ countryCode: 'ML', key: 'support_phone', value: '+22320220000' }] });
    fake.systemSettings.findMany = async ({ where } = {}) => { const k = where?.key?.in; return fake._db.systemSettings.filter(s => !k || k.includes(s.key)); };
    fake.user = { findUnique: async ({ where }) => (users[where.id] ? { countryCode: users[where.id] } : null) };
    jest.doMock('../src/lib/prisma', () => fake);
    jest.doMock('../src/middleware/maintenance.middleware', () => ({ getMaintenanceState: async () => ({}) }));
    const app = express(); app.use('/api/status', require('../src/routes/public.routes')); return app;
  };
  test('Malian user gets Mali number; Nigerian gets global; anonymous unchanged; unknown country gets none', async () => {
    const app = await build({ ml: 'ML', ng: 'NG' });
    let r = await request(app).get('/api/status/contact').set('Authorization', `Bearer ${jwt.sign({ userId: 'ml' }, 'test-secret')}`);
    expect(r.body.data.support_phone).toBe('+22320220000'); expect(r.body.data.support_whatsapp).toBe('');
    r = await request(app).get('/api/status/contact').set('Authorization', `Bearer ${jwt.sign({ userId: 'ng' }, 'test-secret')}`);
    expect(r.body.data.support_phone).toBe('+2348000000001');
    expect((await request(app).get('/api/status/contact')).body.data.support_phone).toBe('+2348000000001');
    expect((await request(app).get('/api/status/contact?country=ZZ')).body.data.support_phone).toBe('');
    expect((await request(app).get('/api/status/contact').set('Authorization', 'Bearer junk')).status).toBe(200);
  });
});

const world = () => {
  jest.resetModules();
  const db = { tickets: [], users: [] };
  const match = (t, where = {}) => Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return v.some(o => match(t, o));
    if (v && typeof v === 'object') { if ('in' in v) return v.in.includes(t[k]); if ('contains' in v) return String(t[k]).toLowerCase().includes(v.contains.toLowerCase()); }
    return t[k] === v;
  });
  const fake = makeFakePrisma({ countries: [COUNTRIES.NG, COUNTRIES.ML, COUNTRIES.GH] });
  fake.user = { findMany: async () => db.users.filter(u => u.isActive !== false), findUnique: async ({ where }) => db.users.find(u => u.id === where.id) ?? null,
    update: async ({ where, data }) => { const u = db.users.find(x => x.id === where.id); Object.assign(u, data); return u; } };
  fake.supportTicket = {
    count: async (a) => (a?.where ? db.tickets.filter(t => match(t, a.where)).length : db.tickets.length),
    create: async ({ data }) => { const t = { id: `t${db.tickets.length + 1}`, status: 'open', ...data }; db.tickets.push(t); return t; },
    findMany: async ({ where, skip = 0, take = 100, include }) => db.tickets.filter(t => match(t, where)).slice(skip, skip + take).map(t => ({ ...t, ...(include?.user ? { user: db.users.find(u => u.id === t.userId) } : {}) })),
    groupBy: async ({ where }) => { const o = {}; db.tickets.filter(t => match(t, where)).forEach(t => { o[t.countryCode] = (o[t.countryCode] || 0) + 1; }); return Object.entries(o).map(([countryCode, n]) => ({ countryCode, _count: { _all: n } })); },
    findUnique: async ({ where, include }) => { const t = db.tickets.find(x => x.id === where.id); return t ? { ...t, ...(include?.user ? { user: db.users.find(u => u.id === t.userId) } : {}), ...(include?.replies ? { replies: [] } : {}) } : null; },
    update: async ({ where, data }) => { const t = db.tickets.find(x => x.id === where.id); Object.assign(t, data); return t; } };
  fake.ticketReply = { create: async ({ data }) => data };
  const notify = jest.fn(async () => {}); const emails = [];
  jest.doMock('../src/lib/prisma', () => fake);
  jest.doMock('../src/services/notification.service', () => ({ notify, TYPES: {}, setIO() {} }));
  jest.doMock('../src/utils/auditLog', () => ({ logActivity: async () => {} }));
  jest.doMock('../src/services/email.service', () => ({ sendTicketReplyEmail: async (...a) => emails.push(['reply', ...a]), sendTicketResolvedEmail: async (...a) => emails.push(['resolved', ...a]) }));
  return { db, notify, emails };
};
const call = async (fn, req) => { const o = {}; const res = { status(c) { o.status = c; return this; }, json(b) { o.body = b; return this; } }; try { await fn({ params: {}, body: {}, query: {}, ...req }, res); } catch (e) { o.error = e; } return o; };
const staff = (x) => ({ isActive: true, role: 'SUPPORT', supportCountries: [], supportLanguages: [], ...x });

describe('tickets', () => {
  test('stored with country+language; confirmation localized; default language from country', async () => {
    const w = world(); w.db.users.push(staff({ id: 'a' }));
    const c = require('../src/controllers/user.controller'); const b = { subject: 's', description: 'd', category: 'ride' };
    const r = await call(c.submitSupportTicket, { user: { id: 'c1', countryCode: 'ML' }, body: { ...b, language: 'fr' } });
    expect(r.status).toBe(201); expect(r.body.message).toMatch(/Notre équipe/);
    await call(c.submitSupportTicket, { user: { id: 'c2', countryCode: 'ML' }, body: b });
    await call(c.submitSupportTicket, { user: { id: 'c3', countryCode: 'NG' }, body: { ...b, language: 'klingon' } });
    expect(w.db.tickets.map(t => [t.countryCode, t.language])).toEqual([['ML', 'fr'], ['ML', 'fr'], ['NG', 'en']]);
  });
  test('only covering staff notified; fallback to super admin', async () => {
    const w = world();
    w.db.users.push(staff({ id: 'ml', supportCountries: ['ML'] }), staff({ id: 'ng', supportCountries: ['NG'] }), staff({ id: 'gen', role: 'ADMIN' }));
    const c = require('../src/controllers/user.controller');
    await call(c.submitSupportTicket, { user: { id: 'x', countryCode: 'ML' }, body: { subject: 's', description: 'd', category: 'ride', language: 'fr' } });
    expect(w.notify.mock.calls.map(x => x[0].userId).sort()).toEqual(['gen', 'ml']);
  });
  const seed = (w) => { w.db.users.push({ id: 'um', firstName: 'Awa', role: 'CUSTOMER', email: 'a@x' }, { id: 'un', firstName: 'Ada', role: 'CUSTOMER', email: 'b@x' });
    w.db.tickets.push({ id: 't1', ticketNumber: 'TKT-1', userId: 'um', subject: 'Course', status: 'open', category: 'ride', countryCode: 'ML', language: 'fr' },
      { id: 't2', ticketNumber: 'TKT-2', userId: 'un', subject: 'Refund', status: 'open', category: 'payment', countryCode: 'NG', language: 'en' }); };
  test('agent scope: list, filter widening blocked, 403 on other market, super admin sees all', async () => {
    const w = world(); seed(w); const a = require('../src/controllers/admin.controller');
    const ag = { id: 'g', role: 'SUPPORT', supportCountries: ['ML'] };
    expect((await call(a.getTickets, { user: ag })).body.data.tickets.map(t => t.id)).toEqual(['t1']);
    expect((await call(a.getTickets, { user: ag, query: { countryCode: 'NG' } })).body.data.tickets).toEqual([]);
    expect((await call(a.getTicketById, { user: ag, params: { id: 't2' } })).error.statusCode).toBe(403);
    expect((await call(a.updateTicket, { user: ag, params: { id: 't2' }, body: { replyMessage: 'x' } })).error.statusCode).toBe(403);
    const su = { id: 's', role: 'SUPER_ADMIN' };
    const r = await call(a.getTickets, { user: su, query: { category: 'payment' } });
    expect(r.body.data.tickets.map(t => t.id)).toEqual(['t2']);
    expect((await call(a.getTickets, { user: su })).body.data.openByCountry).toEqual({ ML: 1, NG: 1 });
  });
  test('reply/resolve are in the ticket language', async () => {
    const w = world(); seed(w); const a = require('../src/controllers/admin.controller'); const su = { id: 's', role: 'SUPER_ADMIN' };
    await call(a.updateTicket, { user: su, params: { id: 't1' }, body: { replyMessage: 'Bonjour' } });
    expect(w.notify.mock.calls.find(c => c[0].type === 'ticket_reply')[0].title).toBe('Mise à jour du ticket n° TKT-1');
    expect(w.emails.find(e => e[0] === 'reply')[3].language).toBe('fr');
    await call(a.updateTicket, { user: su, params: { id: 't1' }, body: { status: 'resolved', resolution: 'Remboursé' } });
    expect(w.notify.mock.calls.find(c => c[0].type === 'ticket_resolved')[0].message).toBe("Votre ticket d'assistance a été résolu. Résolution: Remboursé");
  });
  test('staff coverage endpoint: normalises, validates', async () => {
    const w = world(); w.db.users.push({ id: 'ag', role: 'SUPPORT' }, { id: 'cu', role: 'CUSTOMER' }); const a = require('../src/controllers/admin.controller');
    const su = { id: 'b', role: 'SUPER_ADMIN' };
    await call(a.updateStaffSupportCoverage, { user: su, params: { id: 'ag' }, body: { supportCountries: ['ml', 'ML', ' gh '], supportLanguages: ['FR', 'fr'] } });
    expect(w.db.users[0]).toMatchObject({ supportCountries: ['ML', 'GH'], supportLanguages: ['fr'] });
    expect((await call(a.updateStaffSupportCoverage, { user: su, params: { id: 'ag' }, body: { supportCountries: ['ZZ'] } })).error.message).toMatch(/Unknown country/);
    expect((await call(a.updateStaffSupportCoverage, { user: su, params: { id: 'cu' }, body: { supportCountries: ['ML'] } })).error.message).toMatch(/staff/);
  });
});

describe('emails', () => {
  test('French subject, HTML-escaped agent text, Arabic RTL', async () => {
    jest.resetModules(); jest.dontMock('../src/services/email.service'); process.env.BREVO_API_KEY = 'k';
    const sent = []; global.fetch = jest.fn(async (_u, o) => { sent.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({}), text: async () => '' }; });
    const svc = require('../src/services/email.service');
    await svc.sendTicketReplyEmail('a@b.c', 'Awa', { ticketNumber: 'TKT-7', message: 'Voir <b>ici</b>', language: 'fr' });
    expect(sent[0].subject).toBe('Le support a répondu à votre ticket n° TKT-7');
    expect(sent[0].htmlContent).toContain('&lt;b&gt;ici&lt;/b&gt;');
    await svc.sendTicketResolvedEmail('a@b.c', 'Awa', { ticketNumber: 'TKT-7', language: 'ar' });
    expect(sent[1].htmlContent).toContain('dir="rtl"');
  });
});
