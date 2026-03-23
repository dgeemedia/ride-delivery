// backend/src/services/shield.service.js
//
// Core logic for SHIELD sessions:
//  - Token generation
//  - Auto-trigger detection (night rides)
//  - WhatsApp deep-link + SMS fallback construction
//  - Session expiry management

'use strict';

const crypto = require('crypto');
const prisma  = require('../lib/prisma');
const { logger } = require('../utils/logger');

// ── Config ────────────────────────────────────────────────────────────────────

const APP_BASE_URL   = process.env.APP_BASE_URL   || 'https://duoride.app';
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours max — covers any realistic ride

// Night window (WAT = UTC+1): 9 PM – 5 AM
const NIGHT_START_HOUR = 21;
const NIGHT_END_HOUR   = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a 48-character URL-safe token.
 * Avoids gen_random_bytes() in JS to keep it portable.
 */
const generateToken = () => crypto.randomBytes(24).toString('hex');

/**
 * True if the current WAT hour falls in the night window (9 PM – 5 AM).
 */
const isNightTime = () => {
  const watHour = (new Date().getUTCHours() + 1) % 24;
  return watHour >= NIGHT_START_HOUR || watHour < NIGHT_END_HOUR;
};

/**
 * Build the public beneficiary view URL.
 *   e.g. https://duoride.app/shield/abc123def456
 */
const buildViewUrl = (token) => `${APP_BASE_URL}/shield/${token}`;

/**
 * Build a WhatsApp wa.me deep-link for sharing.
 * Works on Android and iOS without the app needing to be installed.
 */
const buildWhatsAppLink = (phone, message) => {
  const normalised = phone.replace(/\D/g, '');
  const e164 = normalised.startsWith('0') ? `234${normalised.slice(1)}` : normalised;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
};

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Create (or replace) a SHIELD session for a ride or delivery.
 *
 * @param {object} opts
 * @param {string} opts.userId           — customer who owns the ride
 * @param {string} [opts.rideId]
 * @param {string} [opts.deliveryId]
 * @param {string} opts.beneficiaryName
 * @param {string} opts.beneficiaryPhone
 * @param {string} [opts.beneficiaryEmail]
 * @param {boolean} [opts.autoTriggered]  — true when triggered by night-time logic
 * @returns {Promise<{ session, viewUrl, whatsappLink, smsMessage }>}
 */
const createSession = async ({
  userId,
  rideId,
  deliveryId,
  beneficiaryName,
  beneficiaryPhone,
  beneficiaryEmail,
  autoTriggered = false,
}) => {
  if (!rideId && !deliveryId) {
    throw new Error('Either rideId or deliveryId is required');
  }

  // Deactivate any previous session for this ride/delivery
  await prisma.shieldSession.updateMany({
    where: {
      isActive: true,
      ...(rideId     && { rideId }),
      ...(deliveryId && { deliveryId }),
    },
    data: { isActive: false },
  });

  const token     = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.shieldSession.create({
    data: {
      token,
      userId,
      rideId     : rideId     || null,
      deliveryId : deliveryId || null,
      beneficiaryPhone,
      beneficiaryName,
      beneficiaryEmail : beneficiaryEmail || null,
      autoTriggered,
      expiresAt,
    },
  });

  const viewUrl  = buildViewUrl(token);
  const typeLabel = rideId ? 'ride' : 'delivery';

  const smsMessage =
    `🛡️ ${beneficiaryName}, you've been set as a safety guardian on DuoRide.\n` +
    `Track this ${typeLabel} live here:\n${viewUrl}\n` +
    `Link expires when the ${typeLabel} ends.`;

  const whatsappLink = buildWhatsAppLink(beneficiaryPhone, smsMessage);

  logger.info(`[SHIELD] Session created: ${token} for user=${userId} ride=${rideId ?? '-'} delivery=${deliveryId ?? '-'}`);

  return { session, viewUrl, whatsappLink, smsMessage };
};

/**
 * Fetch a session by token — used by the PUBLIC beneficiary web view.
 * Returns null if the token is expired or inactive.
 */
const getSessionByToken = async (token) => {
  const session = await prisma.shieldSession.findUnique({
    where: { token },
    include: {
      ride: {
        include: {
          customer: {
            select: { firstName: true, lastName: true, profileImage: true },
          },
          driver: {
            select: {
              firstName: true, lastName: true, profileImage: true,
              driverProfile: {
                select: {
                  vehicleType: true, vehicleMake: true, vehicleModel: true,
                  vehicleColor: true, vehiclePlate: true, rating: true,
                  currentLat: true, currentLng: true,
                },
              },
            },
          },
        },
      },
      delivery: {
        include: {
          customer: {
            select: { firstName: true, lastName: true, profileImage: true },
          },
          partner: {
            select: {
              firstName: true, lastName: true, profileImage: true,
              deliveryProfile: {
                select: {
                  vehicleType: true, vehiclePlate: true, rating: true,
                  currentLat: true, currentLng: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!session)              return null;
  if (!session.isActive)     return null;
  if (new Date() > session.expiresAt) {
    // Expire it lazily
    await prisma.shieldSession.update({ where: { token }, data: { isActive: false } });
    return null;
  }

  // Increment view count
  await prisma.shieldSession.update({
    where: { token },
    data:  { viewCount: { increment: 1 }, lastPingAt: new Date() },
  });

  return session;
};

/**
 * Mark a session as "arrived safe" (customer taps button at destination).
 * Automatically deactivates the session after 5 min.
 */
const markArrivedSafe = async (token) => {
  await prisma.shieldSession.update({
    where: { token },
    data:  {
      arrivedSafe: true,
      expiresAt:   new Date(Date.now() + 5 * 60 * 1000), // 5 min grace
    },
  });
};

/**
 * Deactivate all active sessions for a ride or delivery.
 * Called by completeRide / completeDelivery / cancelRide / cancelDelivery.
 */
const closeSessionsForRide = async (rideId) =>
  prisma.shieldSession.updateMany({
    where: { rideId, isActive: true },
    data:  { isActive: false },
  });

const closeSessionsForDelivery = async (deliveryId) =>
  prisma.shieldSession.updateMany({
    where: { deliveryId, isActive: true },
    data:  { isActive: false },
  });

/**
 * Check whether the current time qualifies as "night" and whether
 * the user has a default beneficiary — if both true, auto-SHIELD should fire.
 */
const shouldAutoShield = async (userId) => {
  if (!isNightTime()) return { should: false };

  const defaultBeneficiary = await prisma.shieldBeneficiary.findFirst({
    where: { userId, isDefault: true },
  });

  return {
    should:      !!defaultBeneficiary,
    beneficiary: defaultBeneficiary,
  };
};

module.exports = {
  createSession,
  getSessionByToken,
  markArrivedSafe,
  closeSessionsForRide,
  closeSessionsForDelivery,
  shouldAutoShield,
  isNightTime,
  buildViewUrl,
  buildWhatsAppLink,
};