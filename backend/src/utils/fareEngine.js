// backend/src/utils/fareEngine.js
//
// Diakite Fare Engine — Lagos-tuned pricing model
//
// FORMULA (per ride):
//   fare = base_fare
//        + (per_km_rate × distance_km)
//        + (per_minute_rate × duration_minutes)   ← captures holdups
//        + booking_fee
//        + surge_multiplier adjustment
//        - promo discount
//
// PLATFORM REVENUE SOURCES:
//   1. Commission (20% of fare) — every ride
//   2. Booking fee (₦100 flat) — every ride, non-negotiable
//   3. Surge premium — during peak hours platform keeps 5% extra above driver normal rate
//   4. Cancellation fee (₦200) — customer cancels after driver accepted
//   5. Driver subscriptions (future) — ₦5,000/mo for 15% commission tier

// ─────────────────────────────────────────────────────────────────────────────
// RATE TABLES — tweak these per vehicle category
// ─────────────────────────────────────────────────────────────────────────────

const RATES = {
  CAR: {
    baseFare:      500,    // ₦ flat start
    perKm:         130,    // ₦ per kilometre
    perMinute:     15,     // ₦ per minute (traffic meter)
    minimumFare:   500,    // floor — no ride below this
    bookingFee:    100,    // platform booking fee (non-refundable)
    cancellationFee: 200,  // charged if customer cancels after acceptance
  },
  BIKE: {
    baseFare:      200,
    perKm:         80,
    perMinute:     8,
    minimumFare:   250,
    bookingFee:    50,
    cancellationFee: 100,
  },
  VAN: {
    baseFare:      800,
    perKm:         180,
    perMinute:     20,
    minimumFare:   1000,
    bookingFee:    150,
    cancellationFee: 300,
  },
  MOTORCYCLE: {
    baseFare:      200,
    perKm:         80,
    perMinute:     8,
    minimumFare:   250,
    bookingFee:    50,
    cancellationFee: 100,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SURGE — multipliers applied to base + distance + time components
// Booking fee is never surged (customers hate it)
// ─────────────────────────────────────────────────────────────────────────────

const SURGE_WINDOWS = [
  // { label, days (0=Sun..6=Sat), hourStart (24h), hourEnd, multiplier }
  { label: 'Morning Rush',   days: [1,2,3,4,5], hourStart: 6,  hourEnd: 9,  multiplier: 1.4 },
  { label: 'Evening Rush',   days: [1,2,3,4,5], hourStart: 16, hourEnd: 20, multiplier: 1.5 },
  { label: 'Friday Night',   days: [5],         hourStart: 18, hourEnd: 23, multiplier: 1.6 },
  { label: 'Late Night',     days: [0,1,2,3,4,5,6], hourStart: 23, hourEnd: 24, multiplier: 1.3 },
  { label: 'Early Morning',  days: [0,1,2,3,4,5,6], hourStart: 0,  hourEnd: 5,  multiplier: 1.3 },
  { label: 'Weekend Day',    days: [0,6],        hourStart: 10, hourEnd: 20, multiplier: 1.2 },
];

/**
 * Returns the current surge multiplier (1.0 = no surge).
 * Pass a Date for testing, omit for live.
 */
const getSurgeMultiplier = (atTime = new Date()) => {
  const day  = atTime.getDay();   // 0=Sun
  const hour = atTime.getHours();

  for (const w of SURGE_WINDOWS) {
    if (w.days.includes(day) && hour >= w.hourStart && hour < w.hourEnd) {
      return { multiplier: w.multiplier, label: w.label };
    }
  }
  return { multiplier: 1.0, label: null };
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ESTIMATE — called before the ride starts (no time known yet)
// Uses estimated duration = distanceKm / averageSpeedKmph
// ─────────────────────────────────────────────────────────────────────────────

const AVERAGE_SPEED_KMPH = 18; // Lagos average (heavy traffic city)

/**
 * Estimate fare before ride starts.
 *
 * @param {number}  distanceKm
 * @param {string}  vehicleType  'CAR' | 'BIKE' | 'VAN' | 'MOTORCYCLE'
 * @param {Date}    [atTime]     When is the ride? (default: now)
 * @param {number}  [driverFloorMultiplier]  1.0 = standard, >1 = driver markup
 *
 * @returns {FareEstimate}
 */
const estimateFare = (distanceKm, vehicleType = 'CAR', atTime = new Date(), driverFloorMultiplier = 1.0) => {
  const rates  = RATES[vehicleType] ?? RATES.CAR;
  const surge  = getSurgeMultiplier(atTime);
  const estMin = (distanceKm / AVERAGE_SPEED_KMPH) * 60;

  // Core components
  const distanceCharge = rates.perKm    * distanceKm;
  const timeCharge     = rates.perMinute * estMin;
  const coreCharge     = (rates.baseFare + distanceCharge + timeCharge) * surge.multiplier * driverFloorMultiplier;

  // Platform booking fee — not surged, not discountable
  const bookingFee = rates.bookingFee;

  // Total before minimum check
  let total = Math.max(rates.minimumFare, coreCharge) + bookingFee;

  // Round to nearest 50 (cleaner UX)
  total = Math.round(total / 50) * 50;

  // Platform breakdown (for display, not charged twice)
  const platformCommission = (total - bookingFee) * 0.20;
  const surgeBonus         = surge.multiplier > 1 ? (total - bookingFee) * (surge.multiplier - 1) * 0.05 : 0;
  const driverEarnings     = total - bookingFee - platformCommission;

  return {
    estimatedFare:    total,
    bookingFee,
    distanceCharge:   Math.round(distanceCharge),
    timeCharge:       Math.round(timeCharge),
    baseFare:         rates.baseFare,
    surgeMultiplier:  surge.multiplier,
    surgeLabel:       surge.label,
    estimatedMinutes: Math.ceil(estMin),
    distanceKm:       parseFloat(distanceKm.toFixed(2)),
    vehicleType,
    currency:         'NGN',
    // Platform revenue breakdown (informational)
    platformRevenue: {
      bookingFee,
      commission:    Math.round(platformCommission),
      surgeBonus:    Math.round(surgeBonus),
      total:         Math.round(bookingFee + platformCommission + surgeBonus),
    },
    driverEarnings:  Math.round(driverEarnings),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// FINAL FARE — called at ride completion (actual time is known)
// This is what gets charged.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate final fare using actual trip data.
 *
 * @param {object} params
 * @param {number}  params.distanceKm       GPS-measured actual distance
 * @param {Date}    params.startedAt        When ride started (IN_PROGRESS)
 * @param {Date}    params.completedAt      When ride ended
 * @param {string}  params.vehicleType
 * @param {Date}    params.requestedAt      For surge calculation
 * @param {number}  [params.driverFloorMultiplier]  Driver markup if feature enabled
 *
 * @returns {FinalFare}
 */
const calculateFinalFare = ({
  distanceKm,
  startedAt,
  completedAt,
  vehicleType = 'CAR',
  requestedAt,
  driverFloorMultiplier = 1.0,
}) => {
  const rates    = RATES[vehicleType] ?? RATES.CAR;
  const surge    = getSurgeMultiplier(requestedAt ?? startedAt ?? new Date());
  const actualMin = startedAt && completedAt
    ? (new Date(completedAt) - new Date(startedAt)) / 60000
    : (distanceKm / AVERAGE_SPEED_KMPH) * 60;

  const distanceCharge = rates.perKm     * distanceKm;
  const timeCharge     = rates.perMinute  * actualMin;
  const coreCharge     = (rates.baseFare + distanceCharge + timeCharge) * surge.multiplier * driverFloorMultiplier;

  const bookingFee = rates.bookingFee;
  let total        = Math.max(rates.minimumFare, coreCharge) + bookingFee;
  total            = Math.round(total / 50) * 50;

  const platformCommission = (total - bookingFee) * 0.20;
  const driverEarnings     = total - bookingFee - platformCommission;

  return {
    finalFare:       total,
    bookingFee,
    distanceCharge:  Math.round(distanceCharge),
    timeCharge:      Math.round(timeCharge),
    actualMinutes:   Math.round(actualMin),
    surgeMultiplier: surge.multiplier,
    surgeLabel:      surge.label,
    platformRevenue: {
      bookingFee,
      commission:   Math.round(platformCommission),
      total:        Math.round(bookingFee + platformCommission),
    },
    driverEarnings:  Math.round(driverEarnings),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER FLOOR PRICE — allows driver to set minimum acceptable fare
// The customer sees a range: platform estimate ↔ driver floor (if higher)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and apply a driver-set floor price.
 * Returns the multiplier to apply to the platform estimate.
 *
 * @param {number} driverFloorNgn  The minimum fare the driver will accept (₦)
 * @param {number} platformEstimateNgn  What the platform calculated
 * @returns {{ multiplier: number, allowed: boolean, adjustedFare: number }}
 */
const applyDriverFloor = (driverFloorNgn, platformEstimateNgn) => {
  const MAX_DRIVER_MARKUP = 1.30; // driver can charge up to 30% above platform rate

  if (!driverFloorNgn || driverFloorNgn <= platformEstimateNgn) {
    return { multiplier: 1.0, allowed: true, adjustedFare: platformEstimateNgn };
  }

  const requestedMultiplier = driverFloorNgn / platformEstimateNgn;
  if (requestedMultiplier > MAX_DRIVER_MARKUP) {
    // Clamp to max allowed
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
// PLATFORM REVENUE SUMMARY — useful for admin dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given an array of completed rides, return platform revenue breakdown.
 */
const summarizePlatformRevenue = (rides) => {
  let totalFares    = 0;
  let totalBooking  = 0;
  let totalCommission = 0;
  let totalDriverPay  = 0;

  for (const ride of rides) {
    const fare       = ride.actualFare || ride.estimatedFare || 0;
    const booking    = RATES[ride.vehicleType]?.bookingFee ?? RATES.CAR.bookingFee;
    const commission = (fare - booking) * 0.20;
    const driver     = fare - booking - commission;
    totalFares      += fare;
    totalBooking    += booking;
    totalCommission += commission;
    totalDriverPay  += driver;
  }

  return {
    totalFares:      Math.round(totalFares),
    totalBookingFees:Math.round(totalBooking),
    totalCommission: Math.round(totalCommission),
    totalPlatformRevenue: Math.round(totalBooking + totalCommission),
    totalDriverPayouts:   Math.round(totalDriverPay),
    platformMargin: totalFares > 0
      ? ((totalBooking + totalCommission) / totalFares * 100).toFixed(1) + '%'
      : '0%',
    rides: rides.length,
    currency: 'NGN',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD-COMPATIBLE EXPORTS — drop-in replacements for calculateFare
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple fare for backward compatibility with existing controllers.
 * Returns a single number (₦).
 */
const calculateFare = (distanceKm, vehicleType = 'CAR') => {
  return estimateFare(distanceKm, vehicleType).estimatedFare;
};

module.exports = {
  estimateFare,
  calculateFinalFare,
  applyDriverFloor,
  getSurgeMultiplier,
  summarizePlatformRevenue,
  calculateFare,   // backward compat
  RATES,
  SURGE_WINDOWS,
};