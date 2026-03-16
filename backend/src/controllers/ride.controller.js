// backend/src/controllers/ride.controller.js
// PASTE THIS FILE ENTIRELY — replaces the previous version
const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { calculateDistance, calculateFare } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const { broadcastToDrivers, emitToUser } = require('../services/socket.service');

const getIO = (req) => req.app.get('io');

const emitRideStatus = (io, customerId, rideId, status, extra = {}) => {
  const payload = { rideId, status, ...extra };
  if (io) {
    io.to(`user:${customerId}`).emit('ride:status:update', payload);
    io.to(`ride:${rideId}`).emit('ride:status:update', payload);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

exports.getFareEstimate = async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.query;
  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng)
    throw new AppError('Please provide pickup and dropoff coordinates', 400);

  const distance = calculateDistance(
    parseFloat(pickupLat), parseFloat(pickupLng),
    parseFloat(dropoffLat), parseFloat(dropoffLng)
  );
  const estimatedFare     = calculateFare(distance);
  const estimatedDuration = Math.ceil(distance / 0.5);
  res.status(200).json({
    success: true,
    data: { distance: distance.toFixed(2), estimatedFare: estimatedFare.toFixed(2), estimatedDuration, currency: 'NGN' }
  });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.requestRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, notes, promoCode } = req.body;

  const activeRide = await prisma.ride.findFirst({
    where: { customerId: req.user.id, status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
  });
  if (activeRide) throw new AppError('You already have an active ride', 400);

  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  let estimatedFare = calculateFare(distance);

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
      estimatedFare = appliedPromo.discountType === 'percentage'
        ? estimatedFare * (1 - appliedPromo.discountValue / 100)
        : Math.max(0, estimatedFare - appliedPromo.discountValue);
      await prisma.promoCode.update({ where: { id: appliedPromo.id }, data: { currentUses: { increment: 1 } } });
    }
  }

  const ride = await prisma.ride.create({
    data: {
      customerId: req.user.id,
      pickupAddress, pickupLat, pickupLng,
      dropoffAddress, dropoffLat, dropoffLng,
      distance, estimatedFare,
      notes, promoCode: appliedPromo?.code || null,
      status: 'REQUESTED'
    },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } }
    }
  });

  broadcastToDrivers(getIO(req), 'ride:new_request', {
    rideId:        ride.id,
    pickupAddress: ride.pickupAddress,
    dropoffAddress:ride.dropoffAddress,
    estimatedFare: ride.estimatedFare,
    distance:      ride.distance,
    etaMinutes:    Math.ceil((ride.distance || 3) / 0.5),
    paymentMethod: 'CASH',
    customer: {
      firstName:    ride.customer.firstName,
      lastName:     ride.customer.lastName,
      profileImage: ride.customer.profileImage,
    }
  });

  res.status(201).json({
    success: true,
    message: 'Ride requested successfully. Looking for nearby drivers...',
    data: { ride, promoApplied: !!appliedPromo }
  });
};

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
            select: { vehicleType: true, vehicleMake: true, vehicleModel: true, vehicleColor: true, vehiclePlate: true, rating: true, currentLat: true, currentLng: true }
          }
        }
      }
    }
  });

  res.status(200).json({ success: true, data: { ride } });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.acceptRide = async (req, res) => {
  const { id } = req.params;

  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  if (!driverProfile || !driverProfile.isApproved) throw new AppError('Driver profile not approved', 403);
  if (!driverProfile.isOnline) throw new AppError('Please go online to accept rides', 400);

  const activeRide = await prisma.ride.findFirst({
    where: { driverId: req.user.id, status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
  });
  if (activeRide) throw new AppError('You already have an active ride', 400);

  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.status !== 'REQUESTED') throw new AppError('Ride is no longer available', 400);

  const updatedRide = await prisma.ride.update({
    where: { id },
    data: { driverId: req.user.id, status: 'ACCEPTED', acceptedAt: new Date() },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      driver:   { select: { id: true, firstName: true, lastName: true, phone: true, driverProfile: true } }
    }
  });

  emitRideStatus(getIO(req), ride.customerId, id, 'ACCEPTED', { driver: updatedRide.driver });

  await notificationService.notify({
    userId:  ride.customerId,
    title:   'Driver Found! 🚗',
    message: `${req.user.firstName} ${req.user.lastName} has accepted your ride and is on the way.`,
    type:    'ride_accepted',
    data: {
      rideId:      id,
      driverName:  `${req.user.firstName} ${req.user.lastName}`,
      vehiclePlate: driverProfile.vehiclePlate,
      vehicleColor: driverProfile.vehicleColor,
    }
  });

  res.status(200).json({ success: true, message: 'Ride accepted successfully', data: { ride: updatedRide } });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.arrivedAtPickup = async (req, res) => {
  const { id } = req.params;
  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride)                         throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status !== 'ACCEPTED')    throw new AppError('Cannot mark arrived at this status', 400);

  const updatedRide = await prisma.ride.update({ where: { id }, data: { status: 'ARRIVED', arrivedAt: new Date() } });
  emitRideStatus(getIO(req), ride.customerId, id, 'ARRIVED');

  await notificationService.notify({
    userId: ride.customerId, title: 'Driver Arrived! 📍',
    message: 'Your driver has arrived at the pickup location.',
    type: 'ride_arrived', data: { rideId: id }
  });

  res.status(200).json({ success: true, message: 'Arrived at pickup', data: { ride: updatedRide } });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.startRide = async (req, res) => {
  const { id } = req.params;
  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride)                         throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status !== 'ACCEPTED' && ride.status !== 'ARRIVED')
    throw new AppError('Cannot start ride at this status', 400);

  const updatedRide = await prisma.ride.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
  emitRideStatus(getIO(req), ride.customerId, id, 'IN_PROGRESS');

  await notificationService.notify({
    userId: ride.customerId, title: 'Ride Started 🚀',
    message: 'Your ride has started. Enjoy the trip!',
    type: 'ride_started', data: { rideId: id }
  });

  res.status(200).json({ success: true, message: 'Ride started', data: { ride: updatedRide } });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.completeRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  const { actualFare, paymentMethod = 'CASH' } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride)                         throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status !== 'IN_PROGRESS') throw new AppError('Ride is not in progress', 400);

  const finalFare      = actualFare || ride.estimatedFare;
  const platformFee    = finalFare * 0.20;
  const driverEarnings = finalFare - platformFee;

  const [updatedRide, payment] = await prisma.$transaction([
    prisma.ride.update({ where: { id }, data: { status: 'COMPLETED', actualFare: finalFare, completedAt: new Date() } }),
    prisma.payment.create({
      data: {
        userId: ride.customerId, rideId: id, amount: finalFare,
        currency: 'NGN', method: paymentMethod,
        status: paymentMethod === 'WALLET' ? 'COMPLETED' : 'PENDING',
        transactionId: `RIDE-${id}-${Date.now()}`, platformFee, driverEarnings
      }
    })
  ]);

  if (paymentMethod === 'WALLET') {
    const customerWallet = await prisma.wallet.findUnique({ where: { userId: ride.customerId } });
    if (!customerWallet || customerWallet.balance < finalFare) throw new AppError('Insufficient wallet balance', 400);
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId: ride.customerId }, data: { balance: { decrement: finalFare } } }),
      prisma.wallet.update({ where: { userId: req.user.id },    data: { balance: { increment: driverEarnings } } }),
      prisma.walletTransaction.create({
        data: {
          walletId: customerWallet.id, type: 'DEBIT', amount: finalFare,
          description: `Ride payment - ${ride.pickupAddress} to ${ride.dropoffAddress}`,
          status: 'COMPLETED', reference: `RIDE-${id}`
        }
      })
    ]);
  }

  await prisma.driverProfile.update({ where: { userId: req.user.id }, data: { totalRides: { increment: 1 } } });
  emitRideStatus(getIO(req), ride.customerId, id, 'COMPLETED');

  await notificationService.notify({
    userId: ride.customerId, title: 'Ride Completed ✅',
    message: `Your ride has been completed. Total fare: ₦${finalFare.toFixed(2)}. Please rate your driver!`,
    type: 'ride_completed', data: { rideId: id, fare: finalFare, paymentMethod }
  });
  await notificationService.notify({
    userId: req.user.id, title: 'Payment Received 💰',
    message: `Ride completed. Earnings: ₦${driverEarnings.toFixed(2)} (after 20% platform fee).`,
    type: 'payment_received', data: { rideId: id, earnings: driverEarnings, platformFee }
  });

  res.status(200).json({ success: true, message: 'Ride completed successfully', data: { ride: updatedRide, payment } });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.cancelRide = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id && ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status === 'COMPLETED' || ride.status === 'CANCELLED') throw new AppError('Cannot cancel this ride', 400);

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
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
  });

  const io = getIO(req);
  if (io) {
    io.to(`ride:${id}`).emit('ride:cancelled', { rideId: id, reason, cancelledBy: req.user.id });
    if (ride.customerId) io.to(`user:${ride.customerId}`).emit('ride:cancelled', { rideId: id, reason });
    if (ride.driverId)   io.to(`user:${ride.driverId}`).emit('ride:cancelled',   { rideId: id, reason });
  }

  const notifyUserId = cancelledByDriver ? ride.customerId : ride.driverId;
  if (notifyUserId) {
    await notificationService.notify({
      userId: notifyUserId,
      title:  'Ride Cancelled',
      message: cancelledByDriver
        ? "Your driver cancelled the ride. We're looking for another driver for you."
        : `Your ride was cancelled. ${reason ? `Reason: ${reason}` : ''}`,
      type: 'ride_cancelled',
      data: { rideId: id, reason, cancelledBy: req.user.id, cancellationFee }
    });
  }

  res.status(200).json({ success: true, message: 'Ride cancelled', data: { ride: updatedRide, cancellationFee } });
};

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
        payment:  { select: { amount: true, method: true, status: true } }
      },
      orderBy: { requestedAt: 'desc' }, skip, take: parseInt(limit)
    }),
    prisma.ride.count({ where: whereClause })
  ]);

  res.status(200).json({
    success: true,
    data: { rides, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } }
  });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.getRideById = async (req, res) => {
  const { id } = req.params;
  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
      driver:   { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true, driverProfile: true } },
      payment:  true,
      rating:   true
    }
  });
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id && ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  res.status(200).json({ success: true, data: { ride } });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.rateRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  const { rating, comment } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id }, include: { rating: true } });
  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id) throw new AppError('Only customer can rate the ride', 403);
  if (ride.status !== 'COMPLETED')     throw new AppError('Can only rate completed rides', 400);
  if (ride.rating)                     throw new AppError('Ride already rated', 400);

  const newRating = await prisma.rating.create({ data: { userId: req.user.id, rideId: id, rating, comment } });

  const driverRatings = await prisma.rating.findMany({ where: { ride: { driverId: ride.driverId } } });
  const avgRating = driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length;
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

exports.getNearbyDrivers = async (req, res) => {
  const { pickupLat, pickupLng, radiusKm = 10 } = req.query;
  if (!pickupLat || !pickupLng) throw new AppError('Please provide pickup coordinates', 400);

  const lat    = parseFloat(pickupLat);
  const lng    = parseFloat(pickupLng);
  const radius = parseFloat(radiusKm);

  const drivers = await prisma.driverProfile.findMany({
    where: { isApproved: true, isOnline: true, currentLat: { not: null }, currentLng: { not: null } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, profileImage: true, phone: true } }
    }
  });

  const nearby = drivers
    .map(d => ({ ...d, distanceKm: parseFloat(calculateDistance(lat, lng, d.currentLat, d.currentLng).toFixed(2)) }))
    .filter(d => d.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 20);

  const formatted = nearby.map(d => ({
    driverId:    d.user.id,
    profileId:   d.id,
    firstName:   d.user.firstName,
    lastName:    d.user.lastName,
    profileImage:d.user.profileImage,
    vehicleType: d.vehicleType,
    vehicleMake: d.vehicleMake,
    vehicleModel:d.vehicleModel,
    vehicleColor:d.vehicleColor,
    vehiclePlate:d.vehiclePlate,
    vehicleYear: d.vehicleYear,
    rating:      parseFloat((d.rating || 0).toFixed(1)),
    totalRides:  d.totalRides,
    distanceKm:  d.distanceKm,
    etaMinutes:  Math.ceil(d.distanceKm / 0.5),
    currentLat:  d.currentLat,   // required for map pins
    currentLng:  d.currentLng,   // required for map pins
  }));

  res.status(200).json({ success: true, data: { drivers: formatted, total: formatted.length } });
};

// ─────────────────────────────────────────────────────────────────────────────

exports.requestSpecificDriver = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const {
    pickupAddress, pickupLat, pickupLng,
    dropoffAddress, dropoffLat, dropoffLng,
    driverId, estimatedFare, paymentMethod, carType, promoCode, notes
  } = req.body;

  // ── FIX: Auto-cancel any stale REQUESTED rides instead of throwing ─────────
  // A REQUESTED ride means no driver has accepted yet — safe to cancel silently.
  // ACCEPTED/ARRIVED/IN_PROGRESS means a real active ride exists → still throw.
  const existingRide = await prisma.ride.findFirst({
    where: { customerId: req.user.id, status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
  });

  if (existingRide) {
    if (existingRide.status === 'REQUESTED') {
      // Stale unaccepted request — cancel it silently so this new one can proceed
      console.log(`[requestSpecificDriver] Auto-cancelling stale REQUESTED ride ${existingRide.id} for customer ${req.user.id}`);
      await prisma.ride.update({
        where: { id: existingRide.id },
        data: {
          status:             'CANCELLED',
          cancelledAt:        new Date(),
          cancellationReason: 'Superseded by new driver request',
        }
      });
    } else {
      // Genuinely active ride — cannot book another
      throw new AppError(
        `You already have an active ride (${existingRide.status}). Complete or cancel it first.`,
        400
      );
    }
  }

  // ── Driver availability checks ─────────────────────────────────────────────
  const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: driverId } });
  if (!driverProfile)            throw new AppError('Driver not found', 404);
  if (!driverProfile.isApproved) throw new AppError('Driver is not approved', 400);
  if (!driverProfile.isOnline)   throw new AppError('Driver is no longer online', 400);

  // Check driver doesn't already have an active ride
  const driverActiveRide = await prisma.ride.findFirst({
    where: { driverId, status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
  });
  if (driverActiveRide) throw new AppError('Driver is currently on another ride', 400);

  // ── Fare ───────────────────────────────────────────────────────────────────
  const distance  = calculateDistance(
    parseFloat(pickupLat), parseFloat(pickupLng),
    parseFloat(dropoffLat), parseFloat(dropoffLng)
  );
  let finalFare = estimatedFare ? parseFloat(estimatedFare) : calculateFare(distance);

  if (promoCode) {
    const promo = await prisma.promoCode.findFirst({
      where: {
        code: promoCode.toUpperCase(), isActive: true,
        validFrom: { lte: new Date() }, validUntil: { gte: new Date() },
        applicableFor: { in: ['rides', 'both'] }
      }
    });
    if (promo) {
      finalFare = promo.discountType === 'percentage'
        ? finalFare * (1 - promo.discountValue / 100)
        : Math.max(0, finalFare - promo.discountValue);
      await prisma.promoCode.update({ where: { id: promo.id }, data: { currentUses: { increment: 1 } } });
    }
  }

  // ── Fetch customer for the socket payload ──────────────────────────────────
  const customer = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: { id: true, firstName: true, lastName: true, profileImage: true }
  });

  // ── Create the ride ────────────────────────────────────────────────────────
  const ride = await prisma.ride.create({
    data: {
      customerId:     req.user.id,
      pickupAddress,  pickupLat:  parseFloat(pickupLat),  pickupLng:  parseFloat(pickupLng),
      dropoffAddress, dropoffLat: parseFloat(dropoffLat), dropoffLng: parseFloat(dropoffLng),
      distance,
      estimatedFare:  finalFare,
      notes:          `TARGETED:${driverId}${notes ? '|' + notes : ''}`,
      promoCode:      promoCode || null,
      status:         'REQUESTED',
    }
  });

  // ── Emit to the specific driver ────────────────────────────────────────────
  const io = getIO(req);
  if (io) {
    const payload = {
      rideId:        ride.id,
      pickupAddress: ride.pickupAddress,
      dropoffAddress:ride.dropoffAddress,
      estimatedFare: ride.estimatedFare,
      distance:      ride.distance,
      etaMinutes:    Math.ceil((ride.distance || 3) / 0.5),
      carType:       carType       || null,
      paymentMethod: paymentMethod || 'CASH',
      targeted:      true,
      customer: {
        firstName:    customer.firstName,
        lastName:     customer.lastName,
        profileImage: customer.profileImage,
      }
    };

    const room       = `user:${driverId}`;
    const roomSockets = await io.in(room).fetchSockets();

    console.log(`[requestSpecificDriver] ride=${ride.id} → emitting ride:new_request to ${room} (${roomSockets.length} socket(s) in room)`);

    if (roomSockets.length === 0) {
      console.warn(`[requestSpecificDriver] ⚠️  Driver ${driverId} has NO active socket in room ${room}. Event will not be received.`);
      // Still emit — driver may reconnect and poll for missed requests
    }

    io.to(room).emit('ride:new_request', payload);
    console.log(`[requestSpecificDriver] ✅ Emitted ride:new_request to ${room}`);

  } else {
    console.error('[requestSpecificDriver] ❌ io is null — socket server not attached to Express app!');
  }

  res.status(201).json({
    success: true,
    message: 'Request sent to driver. Waiting for response...',
    data: { ride }
  });
};

module.exports = exports;