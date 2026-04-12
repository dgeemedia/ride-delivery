// backend/src/routes/public.routes.js  (or add to your existing public/health routes)
'use strict';
const express = require('express');
const router  = express.Router();
const { getMaintenanceState } = require('../middleware/maintenance.middleware');

/**
 * GET /api/status/maintenance
 * Completely public — no auth required.
 * Used by mobile clients to display the banner and guard navigation.
 */
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
    // Fail open — never break the app over a status check
    return res.json({
      success: true,
      data: { isOn: false, isScheduled: false, message: '', startsAt: null, endsAt: null },
    });
  }
});

module.exports = router;