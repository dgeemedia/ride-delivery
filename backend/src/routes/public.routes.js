// backend/src/routes/public.routes.js
'use strict';
const express = require('express');
const router  = express.Router();
const prisma  = require('../lib/prisma');
const { getMaintenanceState } = require('../middleware/maintenance.middleware');

const PUBLIC_SETTING_KEYS = [
  'support_email',
  'support_phone',
  'support_whatsapp',
  'platform_name',
  'help_center_url',
  'terms_url',
  'privacy_url',
];

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