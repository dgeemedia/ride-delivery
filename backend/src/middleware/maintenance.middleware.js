// backend/src/middleware/maintenance.middleware.js
'use strict';
const prisma = require('../lib/prisma');

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const CACHE_TTL_MS          = 30 * 1000;  // Re-read DB every 30 s under normal operation
const DB_TIMEOUT_MS         = 5_000;      // Never stall a request longer than this
const RETRY_AFTER_ERROR_MS  = 5_000;      // On DB failure, retry after 5 s (not 30 s)

// Routes that always bypass maintenance mode.
// Checked against req.originalUrl so the prefix is always present.
const BYPASS_PREFIXES = [
  '/health',
  '/api/auth',
  '/api/admin',
  '/api/status',
];

// ─────────────────────────────────────────────
// IN-MEMORY CACHE
// ─────────────────────────────────────────────
let cache = {
  isOn:        false,
  isScheduled: false,
  message:     'The platform is currently under maintenance. Please try again later.',
  startsAt:    null,
  endsAt:      null,
  lastFetched: 0,
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Hard-timeout wrapper — prevents a slow DB from stalling every incoming request
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`DB query timed out after ${ms}ms`)),
        ms
      )
    ),
  ]);

// ─────────────────────────────────────────────
// STATE LOADER
// ─────────────────────────────────────────────
const getMaintenanceState = async () => {
  const now = Date.now();

  // Cache hit — serve without hitting DB
  if (now - cache.lastFetched < CACHE_TTL_MS) return cache;

  try {
    const [modeSetting, msgSetting, startsSetting, endsSetting] = await withTimeout(
      Promise.all([
        prisma.systemSettings.findUnique({ where: { key: 'maintenance_mode'      } }),
        prisma.systemSettings.findUnique({ where: { key: 'maintenance_message'   } }),
        prisma.systemSettings.findUnique({ where: { key: 'maintenance_starts_at' } }),
        prisma.systemSettings.findUnique({ where: { key: 'maintenance_ends_at'   } }),
      ]),
      DB_TIMEOUT_MS
    );

    // Admin toggled the switch on
    const adminEnabled =
      modeSetting?.value === true || modeSetting?.value === 'true';

    const startsAt = startsSetting?.value ? new Date(startsSetting.value) : null;
    const endsAt   = endsSetting?.value   ? new Date(endsSetting.value)   : null;
    const nowDate  = new Date();

    // >= so maintenance ends exactly at the scheduled time, not one tick after
    const expired  = endsAt   && nowDate >= endsAt;
    const pending  = startsAt && nowDate <  startsAt;

    cache = {
      // Active right now: admin switched it on AND window hasn't expired AND hasn't started yet
      isOn:        adminEnabled && !expired && !pending,
      // Scheduled: admin switched it on AND start is in the future
      isScheduled: adminEnabled && !expired && !!pending,
      message:
        typeof msgSetting?.value === 'string' && msgSetting.value.trim()
          ? msgSetting.value.trim()
          : 'The platform is currently under maintenance. Please try again later.',
      startsAt:    startsAt?.toISOString() ?? null,
      endsAt:      endsAt?.toISOString()   ?? null,
      lastFetched: now,
    };
  } catch (err) {
    // DB error — log, keep serving the last known state, retry sooner than the full TTL
    console.error('[maintenance] DB fetch failed, serving cached state:', err.message);
    cache.lastFetched = now - CACHE_TTL_MS + RETRY_AFTER_ERROR_MS;
  }

  return cache;
};

// ─────────────────────────────────────────────
// CACHE INVALIDATION
// Called by admin.controller.js after any maintenance key is updated
// so the new state takes effect on the very next request.
// ─────────────────────────────────────────────
const invalidateMaintenanceCache = () => {
  cache.lastFetched = 0;
};

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────
const maintenanceMiddleware = async (req, res, next) => {
  // Use originalUrl so the full path including mount prefix is checked,
  // regardless of where this middleware is mounted in the Express tree.
  const path = req.originalUrl?.split('?')[0] || req.path || '';

  // Always let these through — admin, auth, and health routes must stay live
  if (BYPASS_PREFIXES.some(p => path.startsWith(p))) return next();

  try {
    const state = await getMaintenanceState();

    if (state.isOn) {
      return res.status(503).json({
        success:     false,
        maintenance: true,
        message:     state.message,
        // Both timestamps help the client show "back at X" or a countdown
        startsAt:    state.startsAt,
        endsAt:      state.endsAt,
      });
    }

    // Warn clients a window is coming without blocking them yet
    if (state.isScheduled) {
      res.set('X-Maintenance-Scheduled', state.startsAt);
      // Only set the end header when we actually have a value
      if (state.endsAt) res.set('X-Maintenance-Ends', state.endsAt);
    }
  } catch {
    // Fail open — a broken maintenance check must never take down the API
  }

  next();
};

module.exports = { maintenanceMiddleware, invalidateMaintenanceCache, getMaintenanceState };