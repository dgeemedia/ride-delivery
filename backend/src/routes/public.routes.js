// backend/src/routes/public.routes.js
'use strict';
const express = require('express');
const router  = express.Router();
const prisma  = require('../lib/prisma');
const { getMaintenanceState } = require('../middleware/maintenance.middleware');

const PUBLIC_SETTING_KEYS = [
  'support_email',
  'support_phone',
  'support_whatsapp',   // ← new — may differ from support_phone
  'platform_name',
];

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
      data: {
        support_email:    '',
        support_phone:    '',
        support_whatsapp: '',
        platform_name:    '',
      },
    });
  }
});

module.exports = router;