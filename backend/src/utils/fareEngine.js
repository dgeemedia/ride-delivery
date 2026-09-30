// backend/src/utils/fareEngine.js
//
// Diakite Fare Engine — fully dynamic, DB-backed pricing
//
// Rates are loaded from SystemSettings on first call, then cached for
// CACHE_TTL_MS (60 seconds). When an admin updates a setting via
// PUT /api/admin/settings/:key the cache is busted automatically via
// invalidateFareCache() which admin.controller.js calls after every save.
//
// FORMULA (per ride):
//   fare = baseFare
//        + (perKm × distanceKm)
//        + (perMinute × durationMinutes)   ← captures traffic holdups
//        + bookingFee
//        × surgeMultiplier
//        − promoDiscount

'use strict';

const countrySettings = require('../services/countrySettings.service');
const { DEFAULT_ROUNDING_STEP } = require('./currency');

const BASE_COUNTRY = countrySettings.BASE_COUNTRY;

// Last-resort values used only when the settings layer itself throws. They are
// Naira-scale, so they are only ever returned for the base country.
const FALLBACK_RATES = {
  CAR:        { baseFare: 500,  perKm: 130, perMinute: 15, minimumFare: 500,  bookingFee: 100, cancellationFee: 200 },
  BIKE:       { baseFare: 200,  perKm: 80,  perMinute: 8,  minimumFare: 250,  bookingFee: 50,  cancellationFee: 100 },
  VAN:        { baseFare: 800,  perKm: 180, perMinute: 20, minimumFare: 1000, bookingFee: 150, cancellationFee: 300 },
  MOTORCYCLE: { baseFare: 200,  perKm: 80,  perMinute: 8,  minimumFare: 250,  bookingFee: 50,  cancellationFee: 100 },
  TRICYCLE:   { baseFare: 300,  perKm: 100, perMinute: 10, minimumFare: 300,  bookingFee: 75,  cancellationFee: 150 },
};

const FALLBACK_DELIVERY = {
  baseFee:          500,
  perKm:            80,
  weightFeePerKg:   50,
  platformCommission: 0.15,
};

const FALLBACK_PLATFORM = {
  ridesCommission:     0.20,
  deliveryCommission:  0.15,
};

const SURGE_WINDOWS = countrySettings.DEFAULT_SURGE_WINDOWS;

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE  (one entry per country)
//
// The heavy lifting — DB reads, inheritance, validation — lives in
// countrySettings.service, which has its own 60s cache. This map only holds the
// *shaped* result so the two synchronous helpers (getSurgeMultiplier,
// calculateFare) can read it without awaiting.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 1000;
const _cache = new Map();   // countryCode → { rates, delivery, platform, surgeWindows, ..., loadedAt }

/**
 * Bust the cache — called after any settings update (global or per-country).
 * Pass a country code to drop just that market, or nothing to drop all.
 */
const invalidateFareCache = (countryCode) => {
  if (countryCode) _cache.delete(String(countryCode).toUpperCase());
  else _cache.clear();
  try { countrySettings.invalidateCountrySettingsCache(countryCode); } catch { /* not loaded */ }
};

/**
 * Shape a country's effective settings into the structure the engine uses.
 * Pure (no I/O) so it can be unit tested.
 */
const buildSettings = ({ values: v, currency, countryCode }) => {
  const bookingFee = v.ride_booking_fee;

  const car = {
    baseFare: v.ride_base_fare_car, perKm: v.ride_per_km_car, perMinute: v.ride_per_minute_car,
    minimumFare: v.ride_minimum_fare_car, bookingFee, cancellationFee: v.ride_cancellation_fee_car,
  };
  const bike = {
    baseFare: v.ride_base_fare_bike, perKm: v.ride_per_km_bike, perMinute: v.ride_per_minute_bike,
    minimumFare: v.ride_minimum_fare_bike, bookingFee: Math.round(bookingFee * 0.5), cancellationFee: v.ride_cancellation_fee_bike,
  };
  const van = {
    baseFare: v.ride_base_fare_van, perKm: v.ride_per_km_van, perMinute: v.ride_per_minute_van,
    minimumFare: v.ride_minimum_fare_van, bookingFee: Math.round(bookingFee * 1.5), cancellationFee: v.ride_cancellation_fee_van,
  };
  const tricycle = {
    baseFare: v.ride_base_fare_tricycle, perKm: v.ride_per_km_tricycle, perMinute: v.ride_per_minute_tricycle,
    minimumFare: v.ride_minimum_fare_tricycle, bookingFee: Math.round(bookingFee * 0.75), cancellationFee: v.ride_cancellation_fee_tricycle,
  };

  return {
    countryCode,
    currency,
    rates: { CAR: car, BIKE: bike, VAN: van, MOTORCYCLE: { ...bike }, TRICYCLE: tricycle },
    delivery: {
      baseFee:            v.delivery_base_fee,
      perKm:              v.delivery_per_km,
      weightFeePerKg:     v.delivery_weight_fee_per_kg,
      platformCommission: v.platform_commission_deliveries / 100,
    },
    platform: {
      ridesCommission:    v.platform_commission_rides / 100,
      deliveryCommission: v.platform_commission_deliveries / 100,
    },
    surgeWindows:     Array.isArray(v.surge_windows) ? v.surge_windows : SURGE_WINDOWS,
    utcOffsetMinutes: v.utc_offset_minutes ?? 0,
    roundingStep:     v.price_rounding_step > 0 ? v.price_rounding_step : (DEFAULT_ROUNDING_STEP[currency] ?? 1),
    loadedAt:         Date.now(),
  };
};

/**
 * Get a country's current rates — from cache if fresh, otherwise re-resolve.
 * Defaults to the base country so legacy callers `getSettings()` keep working.
 */
const getSettings = async (countryCode = BASE_COUNTRY) => {
  const code = String(countryCode || BASE_COUNTRY).toUpperCase();
  const hit = _cache.get(code);
  if (hit && Date.now() - hit.loadedAt < CACHE_TTL_MS) return hit;

  try {
    const eff  = await countrySettings.getEffectiveSettings(code);
    const built = buildSettings(eff);
    _cache.set(code, built);
    return built;
  } catch (err) {
    console.error(`[fareEngine] Failed to resolve settings for ${code}, using fallbacks:`, err.message);
    const fallback = {
      countryCode: code, currency: 'NGN',
      rates: FALLBACK_RATES, delivery: FALLBACK_DELIVERY, platform: FALLBACK_PLATFORM,
      surgeWindows: SURGE_WINDOWS, utcOffsetMinutes: 60, roundingStep: 50,
      loadedAt: 0,   // ← force immediate retry on next request
    };
    _cache.set(code, fallback);
    return fallback;
  }
};

const roundToStep = (value, step) => Math.round(value / step) * step;

// ─────────────────────────────────────────────────────────────────────────────
// SURGE WINDOWS (time-based, not in admin settings — change here)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Surge multiplier for a moment in time, evaluated in the COUNTRY'S local time
 * (utc_offset_minutes), not the server's. Reads the cached settings, so call
 * getSettings(countryCode) first if you need a guaranteed-fresh value —
 * estimateFare / calculateFinalFare always do.
 */
const getSurgeMultiplier = (atTime = new Date(), countryCode = BASE_COUNTRY) => {
  const cached  = _cache.get(String(countryCode || BASE_COUNTRY).toUpperCase());
  const windows = cached?.surgeWindows ?? SURGE_WINDOWS;
  const offset  = cached?.utcOffsetMinutes ?? countrySettings.DEFAULT_UTC_OFFSET[countryCode] ?? 60;

  const local = new Date(new Date(atTime).getTime() + offset * 60000);
  const day   = local.getUTCDay();
  const hour  = local.getUTCHours();
  for (const w of windows) {
    if (w.days.includes(day) && hour >= w.hourStart && hour < w.hourEnd) {
      return { multiplier: w.multiplier, label: w.label };
    }
  }
  return { multiplier: 1.0, label: null };
};

// ─────────────────────────────────────────────────────────────────────────────
// FARE ESTIMATE — called before ride starts
// ─────────────────────────────────────────────────────────────────────────────

const AVERAGE_SPEED_KMPH = 18; // Lagos average

/**
 * Estimate fare before ride starts.
 * async because it reads live settings from DB (with cache).
 */
const estimateFare = async (distanceKm, vehicleType = 'CAR', atTime = new Date(), driverFloorMultiplier = 1.0, currency = 'NGN', countryCode = BASE_COUNTRY) => {
  const { rates, platform, roundingStep } = await getSettings(countryCode);
  const r     = rates[vehicleType] ?? rates.CAR;
  const surge = getSurgeMultiplier(atTime, countryCode);
  const estMin = (distanceKm / AVERAGE_SPEED_KMPH) * 60;

  const distanceCharge = r.perKm     * distanceKm;
  const timeCharge     = r.perMinute * estMin;
  const coreCharge     = (r.baseFare + distanceCharge + timeCharge) * surge.multiplier * driverFloorMultiplier;

  let total = Math.max(r.minimumFare, coreCharge) + r.bookingFee;
  total     = roundToStep(total, roundingStep);
  const platformCommission = (total - r.bookingFee) * platform.ridesCommission;
  const surgeBonus         = surge.multiplier > 1 ? (total - r.bookingFee) * (surge.multiplier - 1) * 0.05 : 0;
  const driverEarnings     = total - r.bookingFee - platformCommission;

  return {
    estimatedFare:    total,
    bookingFee:       r.bookingFee,
    distanceCharge:   Math.round(distanceCharge),
    timeCharge:       Math.round(timeCharge),
    baseFare:         r.baseFare,
    surgeMultiplier:  surge.multiplier,
    surgeLabel:       surge.label,
    estimatedMinutes: Math.ceil(estMin),
    distanceKm:       parseFloat(distanceKm.toFixed(2)),
    vehicleType,
    currency,
    countryCode:      String(countryCode).toUpperCase(),
    roundingStep,
    // The rate actually applied for this market. Callers used to read this
    // field and silently fall back to a hard-coded 0.20 because it was never
    // returned — so an admin-set commission was ignored in several places.
    commissionRate:   platform.ridesCommission,
    platformRevenue: {
      bookingFee:  r.bookingFee,
      commission:  Math.round(platformCommission),
      surgeBonus:  Math.round(surgeBonus),
      total:       Math.round(r.bookingFee + platformCommission + surgeBonus),
    },
    driverEarnings: Math.round(driverEarnings),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// FINAL FARE — called at ride completion (actual time known)
// ─────────────────────────────────────────────────────────────────────────────

const calculateFinalFare = async ({
  distanceKm,
  startedAt,
  completedAt,
  vehicleType = 'CAR',
  requestedAt,
  driverFloorMultiplier = 1.0,
  currency = 'NGN',
  countryCode = BASE_COUNTRY,
}) => {
  const { rates, platform, roundingStep } = await getSettings(countryCode);
  const r      = rates[vehicleType] ?? rates.CAR;
  const surge  = getSurgeMultiplier(requestedAt ?? startedAt ?? new Date(), countryCode);
  const actualMin = startedAt && completedAt
    ? (new Date(completedAt) - new Date(startedAt)) / 60000
    : (distanceKm / AVERAGE_SPEED_KMPH) * 60;

  const distanceCharge = r.perKm     * distanceKm;
  const timeCharge     = r.perMinute * actualMin;
  const coreCharge     = (r.baseFare + distanceCharge + timeCharge) * surge.multiplier * driverFloorMultiplier;

  let total = Math.max(r.minimumFare, coreCharge) + r.bookingFee;
  total     = roundToStep(total, roundingStep);

  const platformCommission = (total - r.bookingFee) * platform.ridesCommission;
  const driverEarnings     = total - r.bookingFee - platformCommission;

  return {
    finalFare:       total,
    bookingFee:      r.bookingFee,
    distanceCharge:  Math.round(distanceCharge),
    timeCharge:      Math.round(timeCharge),
    actualMinutes:   Math.round(actualMin),
    surgeMultiplier: surge.multiplier,
    surgeLabel:      surge.label,
    commissionRate:  platform.ridesCommission,
    platformRevenue: {
      bookingFee:  r.bookingFee,
      commission:  Math.round(platformCommission),
      total:       Math.round(r.bookingFee + platformCommission),
    },
    driverEarnings: Math.round(driverEarnings),
    currency,
    countryCode: String(countryCode).toUpperCase(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY FEE — replaces helpers.js calculateDeliveryFee
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate delivery fee from DB-backed settings.
 * Returns { estimatedFee, baseFee, distanceCharge, weightCharge, platformFee, partnerEarnings }
 */
const calculateDeliveryFee = async (distanceKm, packageWeightKg = 0, currency = 'NGN', countryCode = BASE_COUNTRY) => {
  const { delivery, roundingStep } = await getSettings(countryCode);

  const baseFee       = delivery.baseFee;
  const distCharge    = delivery.perKm * distanceKm;
  const weightCharge  = delivery.weightFeePerKg * packageWeightKg;
  let total           = baseFee + distCharge + weightCharge;
  total               = roundToStep(total, roundingStep);

  const platformFee    = Math.round(total * delivery.platformCommission);
  const partnerEarnings = total - platformFee;

  return {
    estimatedFee:    total,
    baseFee,
    distanceCharge:  Math.round(distCharge),
    weightCharge:    Math.round(weightCharge),
    platformFee,
    partnerEarnings,
    commissionRate:  delivery.platformCommission,
    roundingStep,
    currency,
    countryCode: String(countryCode).toUpperCase(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER FLOOR PRICE (unchanged logic, no DB dependency)
// ─────────────────────────────────────────────────────────────────────────────

const applyDriverFloor = (driverFloor, platformEstimate, roundingStep = 50) => {
  const MAX_DRIVER_MARKUP = 1.30;
  if (!driverFloor || driverFloor <= platformEstimate) {
    return { multiplier: 1.0, allowed: true, adjustedFare: platformEstimate };
  }
  const requestedMultiplier = driverFloor / platformEstimate;
  if (requestedMultiplier > MAX_DRIVER_MARKUP) {
    const clampedFare = roundToStep(platformEstimate * MAX_DRIVER_MARKUP, roundingStep);
    return { multiplier: MAX_DRIVER_MARKUP, allowed: true, adjustedFare: clampedFare, clamped: true };
  }
  return {
    multiplier:   requestedMultiplier,
    allowed:      true,
    adjustedFare: roundToStep(driverFloor, roundingStep),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM REVENUE SUMMARY (admin analytics)
// ─────────────────────────────────────────────────────────────────────────────

const summarizePlatformRevenue = async (rides) => {
  const { rates, platform } = await getSettings();     // ← destructure platform too
  let totalFares = 0, totalBooking = 0, totalCommission = 0, totalDriverPay = 0;

  for (const ride of rides) {
    const fare     = ride.actualFare || ride.estimatedFare || 0;
    const r        = rates[ride.vehicleType] ?? rates.CAR;
    const commission = (fare - r.bookingFee) * platform.ridesCommission; 
    totalFares      += fare;
    totalBooking    += r.bookingFee;
    totalCommission += commission;
    totalDriverPay  += fare - r.bookingFee - commission;
  }

  return {
    totalFares:           Math.round(totalFares),
    totalBookingFees:     Math.round(totalBooking),
    totalCommission:      Math.round(totalCommission),
    totalPlatformRevenue: Math.round(totalBooking + totalCommission),
    totalDriverPayouts:   Math.round(totalDriverPay),
    platformMargin:       totalFares > 0
      ? ((totalBooking + totalCommission) / totalFares * 100).toFixed(1) + '%'
      : '0%',
    rides:    rides.length,
    currency: 'NGN',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD-COMPATIBLE SYNC WRAPPER
// Some older callers do calculateFare(dist, type) without await.
// This returns the CACHED value synchronously when cache is warm,
// or falls back to hardcoded FALLBACK_RATES if cache is cold.
// ─────────────────────────────────────────────────────────────────────────────

const calculateFare = (distanceKm, vehicleType = 'CAR', countryCode = BASE_COUNTRY) => {
  const cached = _cache.get(String(countryCode || BASE_COUNTRY).toUpperCase());
  const src    = cached ?? { rates: FALLBACK_RATES, roundingStep: 50 };   // cold cache: first request before DB load
  const r      = src.rates[vehicleType] ?? src.rates.CAR;
  const estMin = (distanceKm / AVERAGE_SPEED_KMPH) * 60;
  const { multiplier } = getSurgeMultiplier(new Date(), countryCode);
  const core  = (r.baseFare + r.perKm * distanceKm + r.perMinute * estMin) * multiplier;
  const total = Math.max(r.minimumFare, core) + r.bookingFee;
  return roundToStep(total, src.roundingStep);
};

module.exports = {
  // Primary async API (use these everywhere)
  estimateFare,
  calculateFinalFare,
  calculateDeliveryFee,
  applyDriverFloor,
  getSurgeMultiplier,
  summarizePlatformRevenue,
  invalidateFareCache,   // call this from admin.controller after updateSetting
  getSettings,           // getSettings(countryCode) — per-market rates
  buildSettings,         // pure shaper, exported for tests
  roundToStep,

  // Legacy sync compat
  calculateFare,

  // Expose fallbacks for tests
  FALLBACK_RATES,
  SURGE_WINDOWS,
};