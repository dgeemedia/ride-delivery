// backend/src/controllers/ride.controller.js
// Uses the fareEngine for proper Lagos-tuned pricing.
//
// KEY FIXES vs the original:
//
// 1. requestSpecificDriver — encodes driverFloorMultiplier in the notes field
//    as  |FLOORX:<multiplier>  so completeRide can recover it.
//
// 2. completeRide — parses FLOORX from notes and passes the correct
//    driverFloorMultiplier to calculateFinalFare (was always 1.0 before).
//
// 3. getActiveRide — appends a live surgeContext block so the frontend
//    ActiveRideBanner / RideTracking screen doesn't need a second API call.

const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError }         = require('../middleware/errorHandler');
const { calculateDistance } = require('../utils/helpers');
const {
  estimateFare,
  calculateFinalFare,
  applyDriverFloor,
  getSurgeMultiplier,
  calculateFare,
} = require('../utils/fareEngine');
const notificationService = require('../services/notification.service');
const { broadcastToDrivers } = require('../services/socket.service');

const getIO = (req) => req.app.get('io');

const emitRideStatus = (io, customerId, rideId, status, extra = {}) => {
  const payload = { rideId, status, ...extra };
  if (io) {
    io.to(`user:${customerId}`).emit('ride:status:update', payload);
    io.to(`ride:${rideId}`).emit('ride:status:update', payload);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — floor multiplier encoding / decoding in ride.notes
//
// Format appended to notes:  |FLOORX:1.18
// We use this rather than a schema migration so the fix is zero-downtime.
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR_TAG = '|FLOORX:';

/**
 * Encode the driver floor multiplier into the notes string.
 * Only written when multiplier > 1.0 (i.e. driver asked for more).
 */
const encodeFloorMultiplier = (notes, multiplier) => {
  if (!multiplier || multiplier <= 1.0) return notes;
  const base = (notes ?? '').replace(/\|FLOORX:[0-9.]+/g, '').trimEnd();
  return `${base}${FLOOR_TAG}${multiplier.toFixed(6)}`;
};

/**
 * Parse the driver floor multiplier back out of a notes string.
 * Returns 1.0 if not present (standard platform rate).
 */
const decodeFloorMultiplier = (notes) => {
  if (!notes) return 1.0;
  const idx = notes.indexOf(FLOOR_TAG);
  if (idx === -1) return 1.0;
  const raw = parseFloat(notes.slice(idx + FLOOR_TAG.length));
  return isNaN(raw) || raw < 1.0 ? 1.0 : raw;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rides/estimate
// ─────────────────────────────────────────────────────────────────────────────
exports.getFareEstimate = async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType = 'CAR' } = req.query;
  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng)
    throw new AppError('Please provide pickup and dropoff coordinates', 400);

  const distance = calculateDistance(
    parseFloat(pickupLat), parseFloat(pickupLng),
    parseFloat(dropoffLat), parseFloat(dropoffLng)
  );

  const estimate = estimateFare(distance, vehicleType.toUpperCase());

  res.status(200).json({
    success: true,
    data: { ...estimate, distance: distance.toFixed(2) }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rides/request
// ─────────────────────────────────────────────────────────────────────────────
exports.requestRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const {
    pickupAddress, pickupLat, pickupLng,
    dropoffAddress, dropoffLat, dropoffLng,
    vehicleType = 'CAR', notes, promoCode,
  } = req.body;

  const activeRide = await prisma.ride.findFirst({
    where: { customerId: req.user.id, status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
  });
  if (activeRide) throw new AppError('You already have an active ride', 400);

  const distance      = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const fareBreakdown = estimateFare(distance, vehicleType.toUpperCase());
  let finalFare       = fareBreakdown.estimatedFare;

  let appliedPromo = null;
  if (promoCode) {
    appliedPromo = await prisma.promoCode.findFirst({
      where: {
        code: promoCode.toUpperCase(), isActive: true,
        validFrom: { lte: new Date() }, validUntil: { gte: new Date() },
        applicableFor: { in: ['rides', 'both'] }
      }
    });
    if (appliedPromo) {
      const discount = appliedPromo.discountType === 'percentage'
        ? finalFare * (appliedPromo.discountValue / 100)
        : appliedPromo.discountValue;
      finalFare = Math.max(
        fareBreakdown.bookingFee + (fareBreakdown.estimatedFare - fareBreakdown.bookingFee - discount),
        fareBreakdown.bookingFee + 100
      );
      finalFare = Math.round(finalFare / 50) * 50;
      await prisma.promoCode.update({ where: { id: appliedPromo.id }, data: { currentUses: { increment: 1 } } });
    }
  }

  const ride = await prisma.ride.create({
    data: {
      customerId: req.user.id,
      pickupAddress, pickupLat, pickupLng,
      dropoffAddress, dropoffLat, dropoffLng,
      distance, estimatedFare: finalFare,
      notes, promoCode: appliedPromo?.code || null,
      status: 'REQUESTED',
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } }
    }
  });

  broadcastToDrivers(getIO(req), 'ride:new_request', {
    rideId:          ride.id,
    pickupAddress:   ride.pickupAddress,
    dropoffAddress:  ride.dropoffAddress,
    estimatedFare:   ride.estimatedFare,
    bookingFee:      fareBreakdown.bookingFee,
    distance:        ride.distance,
    etaMinutes:      fareBreakdown.estimatedMinutes,
    surgeMultiplier: fareBreakdown.surgeMultiplier,
    surgeLabel:      fareBreakdown.surgeLabel,
    paymentMethod:   'CASH',
    customer: {
      firstName:    ride.customer.firstName,
      lastName:     ride.customer.lastName,
      profileImage: ride.customer.profileImage,
    }
  });

  res.status(201).json({
    success: true,
    message: 'Ride requested successfully. Looking for nearby drivers...',
    data: { ride, fareBreakdown, promoApplied: !!appliedPromo }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rides/active
// FIX: appends surgeContext so frontend doesn't need a second /estimate call.
// ─────────────────────────────────────────────────────────────────────────────
exports.getActiveRide = async (req, res) => {
  const whereClause = req.user.role === 'DRIVER'
    ? { driverId: req.user.id }
    : { customerId: req.user.id };

  const ride = await prisma.ride.findFirst({
    where: { ...whereClause, status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
      driver: {
        select: {
          id: true, firstName: true, lastName: true, phone: true, profileImage: true,
          driverProfile: {
            select: {
              vehicleType: true, vehicleMake: true, vehicleModel: true,
              vehicleColor: true, vehiclePlate: true, rating: true,
              currentLat: true, currentLng: true,
            }
          }
        }
      }
    }
  });

  // Append live surge context — used by ActiveRideBanner + RideTracking screen
  const surgeContext = ride ? getSurgeMultiplier() : null;

  res.status(200).json({
    success: true,
    data: {
      ride,
      ...(surgeContext && {
        surgeMultiplier: surgeContext.multiplier,
        surgeLabel:      surgeContext.label,
      }),
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/rides/:id/accept
// CHANGE: wallet balance must be >= estimatedFare before driver can accept.
// This ensures cancellation fees can always be deducted and prevents fraud.
// ─────────────────────────────────────────────────────────────────────────────
exports.acceptRide = async (req, res) => {
  const { id } = req.params;

  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  if (!driverProfile?.isApproved) throw new AppError('Driver profile not approved', 403);
  if (!driverProfile.isOnline)    throw new AppError('Please go online to accept rides', 400);

  const activeRide = await prisma.ride.findFirst({
    where: { driverId: req.user.id, status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
  });
  if (activeRide) throw new AppError('You already have an active ride', 400);

  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride)                       throw new AppError('Ride not found', 404);
  if (ride.status !== 'REQUESTED') throw new AppError('Ride is no longer available', 400);

  // ── Wallet balance check ──────────────────────────────────────────────────
  // Driver must hold at least the estimated fare as a security deposit.
  // This guarantees the cancellation fee (₦200) and any platform fees
  // can always be deducted even if the driver cancels mid-trip.
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  const walletBalance   = wallet?.balance ?? 0;
  const requiredBalance = ride.estimatedFare;

  if (walletBalance < requiredBalance) {
    throw new AppError(
      `Insufficient wallet balance. You need at least ₦${requiredBalance.toLocaleString('en-NG')} to accept this ride. ` +
      `Your current balance is ₦${walletBalance.toLocaleString('en-NG')}. Please top up your wallet.`,
      402  // 402 Payment Required — frontend uses this code to navigate to wallet
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const updatedRide = await prisma.ride.update({
    where: { id },
    data:  { driverId: req.user.id, status: 'ACCEPTED', acceptedAt: new Date() },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      driver:   { select: { id: true, firstName: true, lastName: true, phone: true, driverProfile: true } }
    }
  });

  emitRideStatus(getIO(req), ride.customerId, id, 'ACCEPTED', { driver: updatedRide.driver });

  await notificationService.notify({
    userId:  ride.customerId,
    title:   'Driver Found! 🚗',
    message: `${req.user.firstName} ${req.user.lastName} accepted your ride and is on the way.`,
    type:    'ride_accepted',
    data: {
      rideId:       id,
      driverName:   `${req.user.firstName} ${req.user.lastName}`,
      vehiclePlate: driverProfile.vehiclePlate,
      vehicleColor: driverProfile.vehicleColor,
    }
  });

  res.status(200).json({ success: true, message: 'Ride accepted', data: { ride: updatedRide } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/rides/:id/arrived
// ─────────────────────────────────────────────────────────────────────────────
exports.arrivedAtPickup = async (req, res) => {
  const { id } = req.params;
  const ride   = await prisma.ride.findUnique({ where: { id } });
  if (!ride)                         throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status !== 'ACCEPTED')    throw new AppError('Cannot mark arrived at this status', 400);

  const updatedRide = await prisma.ride.update({ where: { id }, data: { status: 'ARRIVED', arrivedAt: new Date() } });
  emitRideStatus(getIO(req), ride.customerId, id, 'ARRIVED');

  await notificationService.notify({
    userId:  ride.customerId,
    title:   'Driver Arrived! 📍',
    message: 'Your driver has arrived at the pickup location.',
    type:    'ride_arrived',
    data:    { rideId: id }
  });

  res.status(200).json({ success: true, message: 'Arrived at pickup', data: { ride: updatedRide } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/rides/:id/start
// ─────────────────────────────────────────────────────────────────────────────
exports.startRide = async (req, res) => {
  const { id } = req.params;
  const ride   = await prisma.ride.findUnique({ where: { id } });
  if (!ride)                         throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (!['ACCEPTED', 'ARRIVED'].includes(ride.status))
    throw new AppError('Cannot start ride at this status', 400);

  const updatedRide = await prisma.ride.update({
    where: { id },
    data:  { status: 'IN_PROGRESS', startedAt: new Date() }
  });
  emitRideStatus(getIO(req), ride.customerId, id, 'IN_PROGRESS');

  await notificationService.notify({
    userId:  ride.customerId,
    title:   'Ride Started 🚀',
    message: 'Your ride has started. Enjoy the trip!',
    type:    'ride_started',
    data:    { rideId: id }
  });

  res.status(200).json({ success: true, message: 'Ride started', data: { ride: updatedRide } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/rides/:id/complete
// FIX: recovers driverFloorMultiplier from ride.notes (encoded by requestSpecificDriver).
// ─────────────────────────────────────────────────────────────────────────────
exports.completeRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  const { paymentMethod = 'CASH' } = req.body;

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: { driver: { select: { driverProfile: true } } }
  });
  if (!ride)                         throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status !== 'IN_PROGRESS') throw new AppError('Ride is not in progress', 400);

  const completedAt = new Date();

  // ── Recover floor multiplier from notes (zero-downtime, no schema change) ──
  const driverFloorMultiplier = decodeFloorMultiplier(ride.notes);

  // ── FINAL FARE using actual trip time + correct floor multiplier ────────────
  const finalFareBreakdown = calculateFinalFare({
    distanceKm:           ride.distance,
    startedAt:            ride.startedAt,
    completedAt,
    vehicleType:          ride.driver?.driverProfile?.vehicleType ?? 'CAR',
    requestedAt:          ride.requestedAt,
    driverFloorMultiplier,               // ← WAS ALWAYS 1.0 BEFORE THIS FIX
  });

  const finalFare      = finalFareBreakdown.finalFare;
  const platformFee    = finalFareBreakdown.platformRevenue.total;
  const driverEarnings = finalFareBreakdown.driverEarnings;

  const [updatedRide, payment] = await prisma.$transaction([
    prisma.ride.update({
      where: { id },
      data:  { status: 'COMPLETED', actualFare: finalFare, completedAt }
    }),
    prisma.payment.create({
      data: {
        userId:        ride.customerId,
        rideId:        id,
        amount:        finalFare,
        currency:      'NGN',
        method:        paymentMethod,
        status:        paymentMethod === 'WALLET' ? 'COMPLETED' : 'PENDING',
        transactionId: `RIDE-${id}-${Date.now()}`,
        platformFee,
        driverEarnings,
      }
    })
  ]);

  if (paymentMethod === 'WALLET') {
    const customerWallet = await prisma.wallet.findUnique({ where: { userId: ride.customerId } });
    if (!customerWallet || customerWallet.balance < finalFare)
      throw new AppError('Insufficient wallet balance', 400);

    await prisma.$transaction([
      prisma.wallet.update({ where: { userId: ride.customerId }, data: { balance: { decrement: finalFare } } }),
      prisma.wallet.update({ where: { userId: req.user.id },    data: { balance: { increment: driverEarnings } } }),
      prisma.walletTransaction.create({
        data: {
          walletId:    customerWallet.id,
          type:        'DEBIT',
          amount:      finalFare,
          description: `Ride payment - ${ride.pickupAddress} to ${ride.dropoffAddress}`,
          status:      'COMPLETED',
          reference:   `RIDE-${id}`,
        }
      })
    ]);
  }

  await prisma.driverProfile.update({ where: { userId: req.user.id }, data: { totalRides: { increment: 1 } } });
  emitRideStatus(getIO(req), ride.customerId, id, 'COMPLETED');

  const surgeNote   = finalFareBreakdown.surgeLabel ? ` (${finalFareBreakdown.surgeLabel} pricing applied)` : '';
  const trafficNote = finalFareBreakdown.actualMinutes > (ride.distance / 18 * 60 * 1.2)
    ? ' Traffic surcharge included.' : '';

  await notificationService.notify({
    userId:  ride.customerId,
    title:   'Ride Completed ✅',
    message: `Your ride is done. Total: ₦${finalFare.toLocaleString('en-NG')}${surgeNote}.${trafficNote} Please rate your driver!`,
    type:    'ride_completed',
    data:    { rideId: id, fare: finalFare, paymentMethod, fareBreakdown: finalFareBreakdown }
  });
  await notificationService.notify({
    userId:  req.user.id,
    title:   'Payment Received 💰',
    message: `Ride done. Your earnings: ₦${driverEarnings.toLocaleString('en-NG')} (after platform fees).`,
    type:    'payment_received',
    data:    { rideId: id, earnings: driverEarnings, platformFee }
  });

  res.status(200).json({
    success: true,
    message: 'Ride completed',
    data: { ride: updatedRide, payment, fareBreakdown: finalFareBreakdown }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/rides/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelRide = async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id && ride.driverId !== req.user.id)
    throw new AppError('Unauthorized', 403);
  if (['COMPLETED', 'CANCELLED'].includes(ride.status))
    throw new AppError('Cannot cancel this ride', 400);

  const cancelledByDriver = ride.driverId === req.user.id;
  let cancellationFee = 0;

  if (ride.status !== 'REQUESTED' && !cancelledByDriver) {
    cancellationFee = 200;
    await prisma.payment.create({
      data: {
        userId: ride.customerId, rideId: id, amount: cancellationFee,
        currency: 'NGN', method: 'WALLET', status: 'PENDING',
        transactionId: `CANCEL-${id}-${Date.now()}`, platformFee: 0, driverEarnings: 0
      }
    });
  }

  const updatedRide = await prisma.ride.update({
    where: { id },
    data:  { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
  });

  const io = getIO(req);
  if (io) {
    io.to(`ride:${id}`).emit('ride:cancelled',  { rideId: id, reason, cancelledBy: req.user.id });
    if (ride.customerId) io.to(`user:${ride.customerId}`).emit('ride:cancelled', { rideId: id, reason });
    if (ride.driverId)   io.to(`user:${ride.driverId}`).emit('ride:cancelled',   { rideId: id, reason });
  }

  const notifyId = cancelledByDriver ? ride.customerId : ride.driverId;
  if (notifyId) {
    await notificationService.notify({
      userId:  notifyId,
      title:   'Ride Cancelled',
      message: cancelledByDriver
        ? "Your driver cancelled. We're finding another driver for you."
        : `Your ride was cancelled. ${reason ? `Reason: ${reason}` : ''} ${cancellationFee ? `₦${cancellationFee} cancellation fee applies.` : ''}`,
      type:    'ride_cancelled',
      data:    { rideId: id, reason, cancelledBy: req.user.id, cancellationFee }
    });
  }

  res.status(200).json({ success: true, message: 'Ride cancelled', data: { ride: updatedRide, cancellationFee } });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rides/history
// ─────────────────────────────────────────────────────────────────────────────
exports.getRideHistory = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const whereClause = req.user.role === 'DRIVER'
    ? { driverId:   req.user.id, status: { in: ['COMPLETED', 'CANCELLED'] } }
    : req.user.role === 'CUSTOMER'
    ? { customerId: req.user.id, status: { in: ['COMPLETED', 'CANCELLED'] } }
    : { status: { in: ['COMPLETED', 'CANCELLED'] } };

  const [rides, total] = await Promise.all([
    prisma.ride.findMany({
      where: whereClause,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        driver:   { select: { firstName: true, lastName: true } },
        rating:   true,
        payment:  { select: { amount: true, method: true, status: true, platformFee: true, driverEarnings: true } }
      },
      orderBy: { requestedAt: 'desc' }, skip, take: parseInt(limit)
    }),
    prisma.ride.count({ where: whereClause })
  ]);

  res.status(200).json({
    success: true,
    data: {
      rides,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rides/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getRideById = async (req, res) => {
  const { id } = req.params;
  const ride   = await prisma.ride.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
      driver:   { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true, driverProfile: true } },
      payment:  true,
      rating:   true,
    }
  });
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id && ride.driverId !== req.user.id)
    throw new AppError('Unauthorized', 403);
  res.status(200).json({ success: true, data: { ride } });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rides/:id/rate
// ─────────────────────────────────────────────────────────────────────────────
exports.rateRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { id }              = req.params;
  const { rating, comment } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id }, include: { rating: true } });
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id) throw new AppError('Only customer can rate the ride', 403);
  if (ride.status !== 'COMPLETED')     throw new AppError('Can only rate completed rides', 400);
  if (ride.rating)                     throw new AppError('Ride already rated', 400);

  const newRating = await prisma.rating.create({ data: { userId: req.user.id, rideId: id, rating, comment } });

  const driverRatings = await prisma.rating.findMany({ where: { ride: { driverId: ride.driverId } } });
  const avgRating     = driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length;
  await prisma.driverProfile.update({ where: { userId: ride.driverId }, data: { rating: avgRating } });

  await notificationService.notify({
    userId:  ride.driverId,
    title:   `New Rating: ${'⭐'.repeat(rating)}`,
    message: `You received a ${rating}-star rating. ${comment ? `"${comment}"` : ''}`,
    type:    'rating_received',
    data:    { rideId: id, rating, comment }
  });

  res.status(201).json({ success: true, message: 'Rating submitted', data: { rating: newRating } });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rides/nearby-drivers
// ─────────────────────────────────────────────────────────────────────────────
exports.getNearbyDrivers = async (req, res) => {
  const { pickupLat, pickupLng, radiusKm = 10, vehicleType } = req.query;
  if (!pickupLat || !pickupLng) throw new AppError('Please provide pickup coordinates', 400);

  const lat    = parseFloat(pickupLat);
  const lng    = parseFloat(pickupLng);
  const radius = parseFloat(radiusKm);

  const drivers = await prisma.driverProfile.findMany({
    where: {
      isApproved: true, isOnline: true,
      currentLat: { not: null }, currentLng: { not: null },
      ...(vehicleType && { vehicleType: vehicleType.toUpperCase() }),
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, profileImage: true, phone: true } }
    }
  });

  const nearby = drivers
    .map(d => ({ ...d, distanceKm: parseFloat(calculateDistance(lat, lng, d.currentLat, d.currentLng).toFixed(2)) }))
    .filter(d => d.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 20);

  const formatted = nearby.map(d => {
    const fareEst = estimateFare(3, d.vehicleType ?? 'CAR');
    return {
      driverId:        d.user.id,
      profileId:       d.id,
      firstName:       d.user.firstName,
      lastName:        d.user.lastName,
      profileImage:    d.user.profileImage,
      vehicleType:     d.vehicleType,
      vehicleMake:     d.vehicleMake,
      vehicleModel:    d.vehicleModel,
      vehicleColor:    d.vehicleColor,
      vehiclePlate:    d.vehiclePlate,
      vehicleYear:     d.vehicleYear,
      rating:          parseFloat((d.rating || 0).toFixed(1)),
      totalRides:      d.totalRides,
      distanceKm:      d.distanceKm,
      etaMinutes:      Math.ceil(d.distanceKm / 0.5),
      currentLat:      d.currentLat,
      currentLng:      d.currentLng,
      surgeMultiplier: fareEst.surgeMultiplier,
      surgeLabel:      fareEst.surgeLabel,
      bookingFee:      fareEst.bookingFee,
    };
  });

  res.status(200).json({ success: true, data: { drivers: formatted, total: formatted.length } });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rides/request-driver
// FIX: encodes driverFloorMultiplier into ride.notes so completeRide can recover it.
// ─────────────────────────────────────────────────────────────────────────────
exports.requestSpecificDriver = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const {
    pickupAddress, pickupLat, pickupLng,
    dropoffAddress, dropoffLat, dropoffLng,
    driverId, paymentMethod, vehicleType, promoCode, notes,
    driverFloorPrice,
  } = req.body;

  // Auto-cancel stale REQUESTED rides
  const existingRide = await prisma.ride.findFirst({
    where: { customerId: req.user.id, status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
  });
  if (existingRide) {
    if (existingRide.status === 'REQUESTED') {
      await prisma.ride.update({
        where: { id: existingRide.id },
        data:  { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Superseded by new driver request' }
      });
    } else {
      throw new AppError(`You already have an active ride (${existingRide.status}). Complete or cancel it first.`, 400);
    }
  }

  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: driverId } });
  if (!driverProfile)            throw new AppError('Driver not found', 404);
  if (!driverProfile.isApproved) throw new AppError('Driver is not approved', 400);
  if (!driverProfile.isOnline)   throw new AppError('Driver is no longer online', 400);

  const driverActiveRide = await prisma.ride.findFirst({
    where: { driverId, status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
  });
  if (driverActiveRide) throw new AppError('Driver is currently on another ride', 400);

  const distance        = calculateDistance(
    parseFloat(pickupLat), parseFloat(pickupLng),
    parseFloat(dropoffLat), parseFloat(dropoffLng)
  );
  const usedVehicleType = vehicleType?.toUpperCase() ?? driverProfile.vehicleType ?? 'CAR';
  const fareBreakdown   = estimateFare(distance, usedVehicleType);
  let   finalFare       = fareBreakdown.estimatedFare;

  // ── Driver floor price ─────────────────────────────────────────────────────
  let driverFloorResult = null;
  if (driverFloorPrice && parseFloat(driverFloorPrice) > 0) {
    driverFloorResult = applyDriverFloor(parseFloat(driverFloorPrice), finalFare);
    finalFare         = driverFloorResult.adjustedFare;
    if (driverFloorResult.clamped) {
      console.log(`[requestSpecificDriver] Driver floor ₦${driverFloorPrice} clamped to max ₦${finalFare}`);
    }
  }

  // ── Promo ──────────────────────────────────────────────────────────────────
  if (promoCode) {
    const promo = await prisma.promoCode.findFirst({
      where: {
        code: promoCode.toUpperCase(), isActive: true,
        validFrom: { lte: new Date() }, validUntil: { gte: new Date() },
        applicableFor: { in: ['rides', 'both'] }
      }
    });
    if (promo) {
      const discount = promo.discountType === 'percentage'
        ? finalFare * (promo.discountValue / 100)
        : promo.discountValue;
      finalFare = Math.max(fareBreakdown.bookingFee + 100, finalFare - discount);
      finalFare = Math.round(finalFare / 50) * 50;
      await prisma.promoCode.update({ where: { id: promo.id }, data: { currentUses: { increment: 1 } } });
    }
  }

  const customer = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: { id: true, firstName: true, lastName: true, profileImage: true }
  });

  // ── Encode floor multiplier into notes so completeRide can recover it ──────
  // Format: TARGETED:<driverId>|FLOORX:<multiplier>[|<user notes>]
  const floorMultiplier = driverFloorResult?.multiplier ?? 1.0;
  let   rideNotes       = `TARGETED:${driverId}`;
  rideNotes = encodeFloorMultiplier(rideNotes, floorMultiplier);
  if (notes) rideNotes += `|${notes}`;

  const ride = await prisma.ride.create({
    data: {
      customerId:     req.user.id,
      pickupAddress,  pickupLat:  parseFloat(pickupLat),  pickupLng:  parseFloat(pickupLng),
      dropoffAddress, dropoffLat: parseFloat(dropoffLat), dropoffLng: parseFloat(dropoffLng),
      distance,
      estimatedFare:  finalFare,
      notes:          rideNotes,
      promoCode:      promoCode || null,
      status:         'REQUESTED',
    }
  });

  const io = getIO(req);
  if (io) {
    const payload = {
      rideId:             ride.id,
      pickupAddress:      ride.pickupAddress,
      dropoffAddress:     ride.dropoffAddress,
      estimatedFare:      ride.estimatedFare,
      bookingFee:         fareBreakdown.bookingFee,
      distance:           ride.distance,
      etaMinutes:         fareBreakdown.estimatedMinutes,
      surgeMultiplier:    fareBreakdown.surgeMultiplier,
      surgeLabel:         fareBreakdown.surgeLabel,
      driverFloorApplied: !!driverFloorResult,
      vehicleType:        usedVehicleType,
      paymentMethod:      paymentMethod || 'CASH',
      targeted:           true,
      customer: {
        firstName:    customer.firstName,
        lastName:     customer.lastName,
        profileImage: customer.profileImage,
      }
    };

    const room        = `user:${driverId}`;
    const roomSockets = await io.in(room).fetchSockets();
    console.log(`[requestSpecificDriver] ride=${ride.id} → ${room} (${roomSockets.length} socket(s))`);
    if (roomSockets.length === 0) {
      console.warn(`[requestSpecificDriver] ⚠️  Driver ${driverId} has no active socket`);
    }
    io.to(room).emit('ride:new_request', payload);
  } else {
    console.error('[requestSpecificDriver] ❌ io is null');
  }

  res.status(201).json({
    success: true,
    message: 'Request sent to driver. Waiting for response...',
    data:    { ride, fareBreakdown, driverFloorResult }
  });
};

module.exports = exports;