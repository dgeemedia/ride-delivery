// backend/src/routes/public.routes.js
'use strict';
const express = require('express');
const router  = express.Router();
const prisma  = require('../lib/prisma');
const { getMaintenanceState } = require('../middleware/maintenance.middleware');
const jwt     = require('jsonwebtoken');
const countrySettings = require('../services/countrySettings.service');
const { getCountryByCode } = require('../services/country.service');

const PUBLIC_SETTING_KEYS = [
  'support_email',
  'support_phone',
  'support_whatsapp',
  'platform_name',
  'help_center_url',
  'terms_url',
  'privacy_url',
];

// Keys that differ per country (resolved through countrySettings).
const COUNTRY_CONTACT_KEYS = ['support_email', 'support_phone', 'support_whatsapp'];

// Signed-in user's own country wins, then ?country=XX, else null → global values (as before).
const resolveContactCountry = async (req) => {
  try {
    const h = req.headers.authorization;
    if (h?.startsWith('Bearer ')) {
      const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
      const u = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { countryCode: true } });
      if (u?.countryCode) return String(u.countryCode).toUpperCase();
    }
  } catch { /* bad/expired token → fall through */ }
  const q = String(req.query?.country || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(q) ? q : null;
};

const LEGAL_KEYS = [
  'terms_content',
  'privacy_content',
  'help_content',
];

// ── GET /status/maintenance ───────────────────────────────────────────────────
router.get('/maintenance', async (req, res) => {
  try {
    const state = await getMaintenanceState();
    return res.json({
      success: true,
      data: {
        isOn:        state.isOn,
        isScheduled: state.isScheduled ?? false,
        message:     state.message,
        startsAt:    state.startsAt,
        endsAt:      state.endsAt,
      },
    });
  } catch {
    return res.json({
      success: true,
      data: { isOn: false, isScheduled: false, message: '', startsAt: null, endsAt: null },
    });
  }
});

// ── GET /status/contact ───────────────────────────────────────────────────────
// Returns support contact info (email, phone, whatsapp) and link settings.
// Called by the mobile app on SupportScreen mount.
router.get('/contact', async (req, res) => {
  try {
    const rows = await prisma.systemSettings.findMany({
      where:  { key: { in: PUBLIC_SETTING_KEYS } },
      select: { key: true, value: true },
    });
    const data = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const safe = Object.fromEntries(PUBLIC_SETTING_KEYS.map(k => [k, data[k] ?? '']));

    // Never answer a Malian user with Nigeria's number: unknown country → no phone/WhatsApp.
    const country = await resolveContactCountry(req);
    if (country) {
      const known = (await getCountryByCode(country)).code === country;
      if (known) {
        const eff = await countrySettings.getEffectiveSettings(country);
        for (const k of COUNTRY_CONTACT_KEYS) safe[k] = eff.values[k] ?? '';
      } else {
        safe.support_phone = '';
        safe.support_whatsapp = '';
      }
      safe.countryCode = country;
    }
    return res.json({ success: true, data: safe });
  } catch {
    return res.json({
      success: true,
      data: Object.fromEntries(PUBLIC_SETTING_KEYS.map(k => [k, ''])),
    });
  }
});

// ── GET /status/legal ─────────────────────────────────────────────────────────
// Returns markdown content for Terms, Privacy, and Help Center pages.
// Called by the mobile app when user taps any of those three items.
router.get('/legal', async (req, res) => {
  try {
    const rows = await prisma.systemSettings.findMany({
      where:  { key: { in: LEGAL_KEYS } },
      select: { key: true, value: true },
    });
    const data = Object.fromEntries(rows.map(r => [r.key, r.value]));
    // Return every key — empty string if not yet configured
    const safe = Object.fromEntries(LEGAL_KEYS.map(k => [k, data[k] ?? '']));
    return res.json({ success: true, data: safe });
  } catch {
    return res.json({
      success: true,
      data: Object.fromEntries(LEGAL_KEYS.map(k => [k, ''])),
    });
  }
});

module.exports = router;