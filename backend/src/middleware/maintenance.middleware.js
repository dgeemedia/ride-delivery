// backend/src/middleware/maintenance.middleware.js
'use strict';
const prisma = require('../lib/prisma');

let cache = {
  isOn:        false,
  isScheduled: false,
  message:     '',
  startsAt:    null,
  endsAt:      null,
  lastFetched: 0,
};

const CACHE_TTL_MS    = 30 * 1000;
const DB_TIMEOUT_MS   = 5_000; // Don't let a slow DB stall every request

// Wraps a promise with a hard timeout
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`DB query timed out after ${ms}ms`)), ms)
    ),
  ]);

const getMaintenanceState = async () => {
  const now = Date.now();
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

    const adminEnabled =
      modeSetting?.value === true || modeSetting?.value === 'true';

    const startsAt = startsSetting?.value ? new Date(startsSetting.value) : null;
    const endsAt   = endsSetting?.value   ? new Date(endsSetting.value)   : null;
    const nowDate  = new Date();

    const expired = endsAt   && nowDate > endsAt;
    const pending = startsAt && nowDate < startsAt;

    cache = {
      isOn:        adminEnabled && !expired && !pending,
      isScheduled: adminEnabled && !expired && !!pending,
      message:
        typeof msgSetting?.value === 'string'
          ? msgSetting.value
          : 'The platform is currently under maintenance. Please try again later.',
      startsAt:    startsAt?.toISOString() ?? null,
      endsAt:      endsAt?.toISOString()   ?? null,
      lastFetched: now,
    };
  } catch (err) {
    console.error('[maintenance] DB fetch failed, serving cached state:', err.message);
    // Update timestamp so we don't hammer a broken DB every request,
    // but use a shorter retry window so we recover quickly
    cache.lastFetched = now - CACHE_TTL_MS + 5_000; // retry in 5s
  }

  return cache;
};

const invalidateMaintenanceCache = () => { cache.lastFetched = 0; };

const BYPASS_PREFIXES = ['/health', '/api/auth', '/api/admin', '/api/status'];

const maintenanceMiddleware = async (req, res, next) => {
  const path = req.path || '';
  if (BYPASS_PREFIXES.some(p => path.startsWith(p))) return next();

  try {
    const state = await getMaintenanceState();
    if (state.isOn) {
      return res.status(503).json({
        success:     false,
        maintenance: true,
        message:     state.message,
        endsAt:      state.endsAt,
      });
    }
    if (state.isScheduled) {
      res.set('X-Maintenance-Scheduled', state.startsAt);
      res.set('X-Maintenance-Ends',      state.endsAt ?? '');
    }
  } catch {
    // Fail open — a broken maintenance check must never take down the API
  }

  next();
};

module.exports = { maintenanceMiddleware, invalidateMaintenanceCache, getMaintenanceState };