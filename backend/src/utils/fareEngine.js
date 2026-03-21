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

const prisma = require('../lib/prisma');

// ─────────────────────────────────────────────────────────────────────────────
// HARDCODED FALLBACKS
// Used when a setting has never been saved to the DB.
// These must match the PRICING_DEFAULTS in GeneralSettings.tsx.
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_RATES = {
  CAR: {
    baseFare:        500,
    perKm:           130,
    perMinute:       15,
    minimumFare:     500,
    bookingFee:      100,
    cancellationFee: 200,
  },
  BIKE: {
    baseFare:        200,
    perKm:           80,
    perMinute:       8,
    minimumFare:     250,
    bookingFee:      50,
    cancellationFee: 100,
  },
  VAN: {
    baseFare:        800,
    perKm:           180,
    perMinute:       20,
    minimumFare:     1000,
    bookingFee:      150,
    cancellationFee: 300,
  },
  MOTORCYCLE: {
    baseFare:        200,
    perKm:           80,
    perMinute:       8,
    minimumFare:     250,
    bookingFee:      50,
    cancellationFee: 100,
  },
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

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

let _cache = null;       // { rates, delivery, platform, loadedAt }
let _loading = false;    // prevent stampede
let _waiters = [];       // promises waiting for first load

/**
 * Bust the cache — called by admin.controller.js after any settings update.
 * Next call to getRates() will re-query the DB.
 */
const invalidateFareCache = () => {
  _cache = null;
};

/**
 * Load all pricing settings from SystemSettings and build the RATES map.
 * Falls back to hardcoded values for any missing key.
 */
const _loadFromDB = async () => {
  const rows = await prisma.systemSettings.findMany({
    where: {
      key: {
        in: [
          // Rides
          'ride_base_fare_car',   'ride_per_km_car',
          'ride_base_fare_bike',  'ride_per_km_bike',
          'ride_base_fare_van',   'ride_per_km_van',
          'ride_booking_fee',
          'platform_commission_rides',

          // Deliveries
          'delivery_base_fee',
          'delivery_per_km',
          'delivery_weight_fee_per_kg',
          'platform_commission_deliveries',
        ],
      },
    },
  });

  const s = {};
  rows.forEach(r => { s[r.key] = parseFloat(r.value); });

  const n = (key, fallback) => (isNaN(s[key]) ? fallback : s[key]);

  const bookingFee = n('ride_booking_fee', 100);

  const rates = {
    CAR: {
      baseFare:        n('ride_base_fare_car',  500),
      perKm:           n('ride_per_km_car',     130),
      perMinute:       FALLBACK_RATES.CAR.perMinute,   // not yet in admin UI
      minimumFare:     n('ride_base_fare_car',  500),   // min = baseFare
      bookingFee,
      cancellationFee: FALLBACK_RATES.CAR.cancellationFee,
    },
    BIKE: {
      baseFare:        n('ride_base_fare_bike', 200),
      perKm:           n('ride_per_km_bike',    80),
      perMinute:       FALLBACK_RATES.BIKE.perMinute,
      minimumFare:     n('ride_base_fare_bike', 250),
      bookingFee:      Math.round(bookingFee * 0.5),   // bikes get half booking fee
      cancellationFee: FALLBACK_RATES.BIKE.cancellationFee,
    },
    VAN: {
      baseFare:        n('ride_base_fare_van',  800),
      perKm:           n('ride_per_km_van',     180),
      perMinute:       FALLBACK_RATES.VAN.perMinute,
      minimumFare:     n('ride_base_fare_van',  1000),
      bookingFee:      Math.round(bookingFee * 1.5),   // vans pay 1.5× booking fee
      cancellationFee: FALLBACK_RATES.VAN.cancellationFee,
    },
    MOTORCYCLE: {
      baseFare:        n('ride_base_fare_bike', 200),  // shares bike rates
      perKm:           n('ride_per_km_bike',    80),
      perMinute:       FALLBACK_RATES.MOTORCYCLE.perMinute,
      minimumFare:     250,
      bookingFee:      Math.round(bookingFee * 0.5),
      cancellationFee: FALLBACK_RATES.MOTORCYCLE.cancellationFee,
    },
  };

  const delivery = {
    baseFee:           n('delivery_base_fee',          500),
    perKm:             n('delivery_per_km',            80),
    weightFeePerKg:    n('delivery_weight_fee_per_kg', 50),
    platformCommission: n('platform_commission_deliveries', 15) / 100,
  };

  const platform = {
    ridesCommission:    n('platform_commission_rides',       20) / 100,
    deliveryCommission: n('platform_commission_deliveries',  15) / 100,
  };

  return { rates, delivery, platform, loadedAt: Date.now() };
};

/**
 * Get current rates — from cache if fresh, otherwise re-load from DB.
 * Handles concurrent calls safely (no thundering herd).
 */
const getSettings = async () => {
  // Cache hit
  if (_cache && Date.now() - _cache.loadedAt < CACHE_TTL_MS) {
    return _cache;
  }

  // Someone else is already loading — wait for them
  if (_loading) {
    return new Promise((resolve, reject) => {
      _waiters.push({ resolve, reject });
    });
  }

  _loading = true;
  try {
    const data = await _loadFromDB();
    _cache = data;

    // Resolve all waiters
    _waiters.forEach(w => w.resolve(data));
    _waiters = [];

    return data;
  } catch (err) {
    // On DB error fall back to hardcoded values, don't crash requests
    console.error('[fareEngine] Failed to load settings from DB, using fallbacks:', err.message);

    const fallback = {
      rates:    FALLBACK_RATES,
      delivery: FALLBACK_DELIVERY,
      platform: FALLBACK_PLATFORM,
      loadedAt: Date.now(),
    };
    _cache = fallback;

    _waiters.forEach(w => w.resolve(fallback));
    _waiters = [];

    return fallback;
  } finally {
    _loading = false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SURGE WINDOWS (time-based, not in admin settings — change here)
// ─────────────────────────────────────────────────────────────────────────────

const SURGE_WINDOWS = [
  { label: 'Morning Rush',  days: [1,2,3,4,5], hourStart: 6,  hourEnd: 9,  multiplier: 1.4 },
  { label: 'Evening Rush',  days: [1,2,3,4,5], hourStart: 16, hourEnd: 20, multiplier: 1.5 },
  { label: 'Friday Night',  days: [5],         hourStart: 18, hourEnd: 23, multiplier: 1.6 },
  { label: 'Late Night',    days: [0,1,2,3,4,5,6], hourStart: 23, hourEnd: 24, multiplier: 1.3 },
  { label: 'Early Morning', days: [0,1,2,3,4,5,6], hourStart: 0,  hourEnd: 5,  multiplier: 1.3 },
  { label: 'Weekend Day',   days: [0,6],        hourStart: 10, hourEnd: 20, multiplier: 1.2 },
];

const getSurgeMultiplier = (atTime = new Date()) => {
  const day  = atTime.getDay();
  const hour = atTime.getHours();
  for (const w of SURGE_WINDOWS) {
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
const estimateFare = async (distanceKm, vehicleType = 'CAR', atTime = new Date(), driverFloorMultiplier = 1.0) => {
  const { rates } = await getSettings();
  const r     = rates[vehicleType] ?? rates.CAR;
  const surge = getSurgeMultiplier(atTime);
  const estMin = (distanceKm / AVERAGE_SPEED_KMPH) * 60;

  const distanceCharge = r.perKm     * distanceKm;
  const timeCharge     = r.perMinute * estMin;
  const coreCharge     = (r.baseFare + distanceCharge + timeCharge) * surge.multiplier * driverFloorMultiplier;

  let total = Math.max(r.minimumFare, coreCharge) + r.bookingFee;
  total     = Math.round(total / 50) * 50;

  const { platform } = await getSettings();
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
    currency:         'NGN',
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
}) => {
  const { rates, platform } = await getSettings();
  const r      = rates[vehicleType] ?? rates.CAR;
  const surge  = getSurgeMultiplier(requestedAt ?? startedAt ?? new Date());
  const actualMin = startedAt && completedAt
    ? (new Date(completedAt) - new Date(startedAt)) / 60000
    : (distanceKm / AVERAGE_SPEED_KMPH) * 60;

  const distanceCharge = r.perKm     * distanceKm;
  const timeCharge     = r.perMinute * actualMin;
  const coreCharge     = (r.baseFare + distanceCharge + timeCharge) * surge.multiplier * driverFloorMultiplier;

  let total = Math.max(r.minimumFare, coreCharge) + r.bookingFee;
  total     = Math.round(total / 50) * 50;

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
    platformRevenue: {
      bookingFee:  r.bookingFee,
      commission:  Math.round(platformCommission),
      total:       Math.round(r.bookingFee + platformCommission),
    },
    driverEarnings: Math.round(driverEarnings),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY FEE — replaces helpers.js calculateDeliveryFee
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate delivery fee from DB-backed settings.
 * Returns { estimatedFee, baseFee, distanceCharge, weightCharge, platformFee, partnerEarnings }
 */
const calculateDeliveryFee = async (distanceKm, packageWeightKg = 0) => {
  const { delivery } = await getSettings();

  const baseFee       = delivery.baseFee;
  const distCharge    = delivery.perKm * distanceKm;
  const weightCharge  = delivery.weightFeePerKg * packageWeightKg;
  let total           = baseFee + distCharge + weightCharge;
  total               = Math.round(total / 50) * 50;

  const platformFee    = Math.round(total * delivery.platformCommission);
  const partnerEarnings = total - platformFee;

  return {
    estimatedFee:    total,
    baseFee,
    distanceCharge:  Math.round(distCharge),
    weightCharge:    Math.round(weightCharge),
    platformFee,
    partnerEarnings,
    currency:        'NGN',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER FLOOR PRICE (unchanged logic, no DB dependency)
// ─────────────────────────────────────────────────────────────────────────────

const applyDriverFloor = (driverFloorNgn, platformEstimateNgn) => {
  const MAX_DRIVER_MARKUP = 1.30;
  if (!driverFloorNgn || driverFloorNgn <= platformEstimateNgn) {
    return { multiplier: 1.0, allowed: true, adjustedFare: platformEstimateNgn };
  }
  const requestedMultiplier = driverFloorNgn / platformEstimateNgn;
  if (requestedMultiplier > MAX_DRIVER_MARKUP) {
    const clampedFare = Math.round((platformEstimateNgn * MAX_DRIVER_MARKUP) / 50) * 50;
    return { multiplier: MAX_DRIVER_MARKUP, allowed: true, adjustedFare: clampedFare, clamped: true };
  }
  return {
    multiplier:   requestedMultiplier,
    allowed:      true,
    adjustedFare: Math.round(driverFloorNgn / 50) * 50,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM REVENUE SUMMARY (admin analytics)
// ─────────────────────────────────────────────────────────────────────────────

const summarizePlatformRevenue = async (rides) => {
  const { rates } = await getSettings();
  let totalFares = 0, totalBooking = 0, totalCommission = 0, totalDriverPay = 0;

  for (const ride of rides) {
    const fare     = ride.actualFare || ride.estimatedFare || 0;
    const r        = rates[ride.vehicleType] ?? rates.CAR;
    const commission = (fare - r.bookingFee) * 0.20;
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

const calculateFare = (distanceKm, vehicleType = 'CAR') => {
  // If cache is warm, use it synchronously
  if (_cache) {
    const r = _cache.rates[vehicleType] ?? _cache.rates.CAR;
    const estMin = (distanceKm / AVERAGE_SPEED_KMPH) * 60;
    const { multiplier } = getSurgeMultiplier();
    const core  = (r.baseFare + r.perKm * distanceKm + r.perMinute * estMin) * multiplier;
    let   total = Math.max(r.minimumFare, core) + r.bookingFee;
    return Math.round(total / 50) * 50;
  }

  // Cold cache fallback (first request before DB load)
  const r = FALLBACK_RATES[vehicleType] ?? FALLBACK_RATES.CAR;
  const estMin = (distanceKm / AVERAGE_SPEED_KMPH) * 60;
  const { multiplier } = getSurgeMultiplier();
  const core  = (r.baseFare + r.perKm * distanceKm + r.perMinute * estMin) * multiplier;
  let   total = Math.max(r.minimumFare, core) + r.bookingFee;
  return Math.round(total / 50) * 50;
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
  getSettings,           // expose for testing / admin analytics

  // Legacy sync compat
  calculateFare,

  // Expose fallbacks for tests
  FALLBACK_RATES,
  SURGE_WINDOWS,
};