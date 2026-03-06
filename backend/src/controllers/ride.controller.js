const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { calculateDistance, calculateFare } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const { broadcastToDrivers } = require('../services/socket.service');

const prisma = new PrismaClient();

/**
 * @desc    Get fare estimate
 * @route   GET /api/rides/estimate
 * @access  Private
 */
exports.getFareEstimate = async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.query;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    throw new AppError('Please provide pickup and dropoff coordinates', 400);
  }

  const distance = calculateDistance(
    parseFloat(pickupLat), parseFloat(pickupLng),
    parseFloat(dropoffLat), parseFloat(dropoffLng)
  );

  const estimatedFare = calculateFare(distance);
  const estimatedDuration = Math.ceil(distance / 0.5);

  res.status(200).json({
    success: true,
    data: {
      distance: distance.toFixed(2),
      estimatedFare: estimatedFare.toFixed(2),
      estimatedDuration,
      currency: 'NGN'
    }
  });
};

/**
 * @desc    Request a new ride
 * @route   POST /api/rides/request
 * @access  Private (CUSTOMER)
 */
exports.requestRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, notes, promoCode } = req.body;

  const activeRide = await prisma.ride.findFirst({
    where: {
      customerId: req.user.id,
      status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] }
    }
  });

  if (activeRide) throw new AppError('You already have an active ride', 400);

  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  let estimatedFare = calculateFare(distance);

  // Apply promo code if provided
  let appliedPromo = null;
  if (promoCode) {
    appliedPromo = await prisma.promoCode.findFirst({
      where: {
        code: promoCode.toUpperCase(),
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
        applicableFor: { in: ['rides', 'both'] }
      }
    });

    if (appliedPromo) {
      if (appliedPromo.discountType === 'percentage') {
        estimatedFare = estimatedFare * (1 - appliedPromo.discountValue / 100);
      } else {
        estimatedFare = Math.max(0, estimatedFare - appliedPromo.discountValue);
      }

      await prisma.promoCode.update({
        where: { id: appliedPromo.id },
        data: { currentUses: { increment: 1 } }
      });
    }
  }

  const ride = await prisma.ride.create({
    data: {
      customerId: req.user.id,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      distance,
      estimatedFare,
      notes,
      promoCode: appliedPromo?.code || null,
      status: 'REQUESTED'
    },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true }
      }
    }
  });

  // Notify all online drivers about new ride request
  broadcastToDrivers(notificationService._io, 'ride:new_request', {
    rideId: ride.id,
    pickupAddress: ride.pickupAddress,
    dropoffAddress: ride.dropoffAddress,
    estimatedFare: ride.estimatedFare,
    distance: ride.distance,
    customer: {
      firstName: ride.customer.firstName,
      lastName: ride.customer.lastName,
      profileImage: ride.customer.profileImage
    }
  });

  res.status(201).json({
    success: true,
    message: 'Ride requested successfully. Looking for nearby drivers...',
    data: { ride, promoApplied: !!appliedPromo }
  });
};

/**
 * @desc    Get user's active ride
 * @route   GET /api/rides/active
 * @access  Private
 */
exports.getActiveRide = async (req, res) => {
  const whereClause = req.user.role === 'DRIVER'
    ? { driverId: req.user.id }
    : { customerId: req.user.id };

  const ride = await prisma.ride.findFirst({
    where: {
      ...whereClause,
      status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] }
    },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true }
      },
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

/**
 * @desc    Accept ride (Driver)
 * @route   PUT /api/rides/:id/accept
 * @access  Private (DRIVER)
 */
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
      driver: { select: { id: true, firstName: true, lastName: true, phone: true, driverProfile: true } }
    }
  });

  // Notify customer
  await notificationService.notify({
    userId: ride.customerId,
    title: 'Driver Found! 🚗',
    message: `${req.user.firstName} ${req.user.lastName} has accepted your ride and is on the way.`,
    type: notificationService.TYPES.RIDE_ACCEPTED,
    data: {
      rideId: id,
      driverName: `${req.user.firstName} ${req.user.lastName}`,
      vehicleType: driverProfile.vehicleType,
      vehiclePlate: driverProfile.vehiclePlate,
      vehicleColor: driverProfile.vehicleColor
    }
  });

  res.status(200).json({ success: true, message: 'Ride accepted successfully', data: { ride: updatedRide } });
};

/**
 * @desc    Driver marks arrived at pickup
 * @route   PUT /api/rides/:id/arrived
 * @access  Private (DRIVER)
 */
exports.arrivedAtPickup = async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findUnique({ where: { id } });

  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status !== 'ACCEPTED') throw new AppError('Cannot mark arrived at this status', 400);

  const updatedRide = await prisma.ride.update({
    where: { id },
    data: { status: 'ARRIVED', arrivedAt: new Date() }
  });

  await notificationService.notify({
    userId: ride.customerId,
    title: 'Driver Arrived! 📍',
    message: 'Your driver has arrived at the pickup location.',
    type: notificationService.TYPES.RIDE_ARRIVED,
    data: { rideId: id }
  });

  res.status(200).json({ success: true, message: 'Arrived at pickup', data: { ride: updatedRide } });
};

/**
 * @desc    Start ride
 * @route   PUT /api/rides/:id/start
 * @access  Private (DRIVER)
 */
exports.startRide = async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findUnique({ where: { id } });

  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status !== 'ACCEPTED' && ride.status !== 'ARRIVED') {
    throw new AppError('Cannot start ride at this status', 400);
  }

  const updatedRide = await prisma.ride.update({
    where: { id },
    data: { status: 'IN_PROGRESS', startedAt: new Date() }
  });

  await notificationService.notify({
    userId: ride.customerId,
    title: 'Ride Started 🚀',
    message: 'Your ride has started. Enjoy the trip!',
    type: notificationService.TYPES.RIDE_STARTED,
    data: { rideId: id }
  });

  res.status(200).json({ success: true, message: 'Ride started', data: { ride: updatedRide } });
};

/**
 * @desc    Complete ride
 * @route   PUT /api/rides/:id/complete
 * @access  Private (DRIVER)
 */
exports.completeRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { id } = req.params;
  const { actualFare, paymentMethod = 'CASH' } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id } });

  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.driverId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (ride.status !== 'IN_PROGRESS') throw new AppError('Ride is not in progress', 400);

  const finalFare = actualFare || ride.estimatedFare;
  const platformFee = finalFare * 0.20;
  const driverEarnings = finalFare - platformFee;

  const [updatedRide, payment] = await prisma.$transaction([
    prisma.ride.update({
      where: { id },
      data: { status: 'COMPLETED', actualFare: finalFare, completedAt: new Date() }
    }),
    prisma.payment.create({
      data: {
        userId: ride.customerId,
        rideId: id,
        amount: finalFare,
        currency: 'NGN',
        method: paymentMethod,
        status: paymentMethod === 'WALLET' ? 'COMPLETED' : 'PENDING',
        transactionId: `RIDE-${id}-${Date.now()}`,
        platformFee,
        driverEarnings
      }
    })
  ]);

  // If wallet payment, deduct from customer wallet
  if (paymentMethod === 'WALLET') {
    const customerWallet = await prisma.wallet.findUnique({ where: { userId: ride.customerId } });
    if (!customerWallet || customerWallet.balance < finalFare) {
      throw new AppError('Insufficient wallet balance', 400);
    }
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId: ride.customerId }, data: { balance: { decrement: finalFare } } }),
      prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { increment: driverEarnings } } }),
      prisma.walletTransaction.create({
        data: {
          walletId: customerWallet.id,
          type: 'DEBIT',
          amount: finalFare,
          description: `Ride payment - ${ride.pickupAddress} to ${ride.dropoffAddress}`,
          status: 'COMPLETED',
          reference: `RIDE-${id}`
        }
      })
    ]);
  }

  await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: { totalRides: { increment: 1 } }
  });

  // Notify customer
  await notificationService.notify({
    userId: ride.customerId,
    title: 'Ride Completed ✅',
    message: `Your ride has been completed. Total fare: ₦${finalFare.toFixed(2)}. Please rate your driver!`,
    type: notificationService.TYPES.RIDE_COMPLETED,
    data: { rideId: id, fare: finalFare, paymentMethod }
  });

  // Notify driver
  await notificationService.notify({
    userId: req.user.id,
    title: 'Payment Received 💰',
    message: `Ride completed. Earnings: ₦${driverEarnings.toFixed(2)} (after 20% platform fee).`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { rideId: id, earnings: driverEarnings, platformFee }
  });

  res.status(200).json({
    success: true,
    message: 'Ride completed successfully',
    data: { ride: updatedRide, payment }
  });
};

/**
 * @desc    Cancel ride
 * @route   PUT /api/rides/:id/cancel
 * @access  Private
 */
exports.cancelRide = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id } });

  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id && ride.driverId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }
  if (ride.status === 'COMPLETED' || ride.status === 'CANCELLED') {
    throw new AppError('Cannot cancel this ride', 400);
  }

  const cancelledByDriver = ride.driverId === req.user.id;

  // Apply cancellation fee if ride was already accepted and customer is cancelling
  let cancellationFee = 0;
  if (ride.status !== 'REQUESTED' && !cancelledByDriver) {
    cancellationFee = 200; // ₦200 cancellation fee

    await prisma.payment.create({
      data: {
        userId: ride.customerId,
        rideId: id,
        amount: cancellationFee,
        currency: 'NGN',
        method: 'WALLET',
        status: 'PENDING',
        transactionId: `CANCEL-${id}-${Date.now()}`,
        platformFee: 0,
        driverEarnings: 0
      }
    });
  }

  const updatedRide = await prisma.ride.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
  });

  // Notify the other party
  const notifyUserId = cancelledByDriver ? ride.customerId : ride.driverId;
  if (notifyUserId) {
    await notificationService.notify({
      userId: notifyUserId,
      title: 'Ride Cancelled',
      message: cancelledByDriver
        ? 'Your driver cancelled the ride. We\'re looking for another driver for you.'
        : `Your ride was cancelled by the customer. ${reason ? `Reason: ${reason}` : ''}`,
      type: notificationService.TYPES.RIDE_CANCELLED,
      data: { rideId: id, reason, cancelledBy: req.user.id, cancellationFee }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Ride cancelled',
    data: { ride: updatedRide, cancellationFee }
  });
};

/**
 * @desc    Get ride history
 * @route   GET /api/rides/history
 * @access  Private
 */
exports.getRideHistory = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const whereClause = req.user.role === 'DRIVER'
    ? { driverId: req.user.id }
    : { customerId: req.user.id };

  const [rides, total] = await Promise.all([
    prisma.ride.findMany({
      where: { ...whereClause, status: { in: ['COMPLETED', 'CANCELLED'] } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        driver: { select: { firstName: true, lastName: true } },
        rating: true,
        payment: { select: { amount: true, method: true, status: true } }
      },
      orderBy: { completedAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    }),
    prisma.ride.count({ where: { ...whereClause, status: { in: ['COMPLETED', 'CANCELLED'] } } })
  ]);

  res.status(200).json({
    success: true,
    data: { rides, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

/**
 * @desc    Get ride by ID
 * @route   GET /api/rides/:id
 * @access  Private
 */
exports.getRideById = async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
      driver: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true, driverProfile: true } },
      payment: true,
      rating: true
    }
  });

  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id && ride.driverId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  res.status(200).json({ success: true, data: { ride } });
};

/**
 * @desc    Rate ride
 * @route   POST /api/rides/:id/rate
 * @access  Private
 */
exports.rateRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { id } = req.params;
  const { rating, comment } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id }, include: { rating: true } });

  if (!ride) throw new AppError('Ride not found', 404);
  if (ride.customerId !== req.user.id) throw new AppError('Only customer can rate the ride', 403);
  if (ride.status !== 'COMPLETED') throw new AppError('Can only rate completed rides', 400);
  if (ride.rating) throw new AppError('Ride already rated', 400);

  const newRating = await prisma.rating.create({
    data: { userId: req.user.id, rideId: id, rating, comment }
  });

  // Recalculate driver average rating
  const driverRatings = await prisma.rating.findMany({
    where: { ride: { driverId: ride.driverId } }
  });

  const avgRating = driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length;

  await prisma.driverProfile.update({
    where: { userId: ride.driverId },
    data: { rating: avgRating }
  });

  // Notify driver
  await notificationService.notify({
    userId: ride.driverId,
    title: `New Rating: ${'⭐'.repeat(rating)}`,
    message: `You received a ${rating}-star rating. ${comment ? `"${comment}"` : ''}`,
    type: 'rating_received',
    data: { rideId: id, rating, comment }
  });

  res.status(201).json({ success: true, message: 'Rating submitted', data: { rating: newRating } });
};

module.exports = exports;