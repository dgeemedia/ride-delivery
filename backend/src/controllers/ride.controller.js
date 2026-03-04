const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { calculateDistance, calculateFare } = require('../utils/helpers');

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
    parseFloat(pickupLat),
    parseFloat(pickupLng),
    parseFloat(dropoffLat),
    parseFloat(dropoffLng)
  );

  const estimatedFare = calculateFare(distance);
  const estimatedDuration = Math.ceil(distance / 0.5); // Assume 30 km/h average

  res.status(200).json({
    success: true,
    data: {
      distance: distance.toFixed(2),
      estimatedFare: estimatedFare.toFixed(2),
      estimatedDuration, // in minutes
      currency: 'USD'
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
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const {
    pickupAddress,
    pickupLat,
    pickupLng,
    dropoffAddress,
    dropoffLat,
    dropoffLng,
    notes
  } = req.body;

  // Check if user has an active ride
  const activeRide = await prisma.ride.findFirst({
    where: {
      customerId: req.user.id,
      status: {
        in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS']
      }
    }
  });

  if (activeRide) {
    throw new AppError('You already have an active ride', 400);
  }

  // Calculate distance and fare
  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const estimatedFare = calculateFare(distance);

  // Create ride
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
      status: 'REQUESTED'
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true
        }
      }
    }
  });

  // FUTURE: Notify nearby available drivers via Socket.io
  // const nearbyDrivers = await findNearbyDrivers(pickupLat, pickupLng, 5); // 5km radius
  // notifyDrivers(nearbyDrivers, ride);

  res.status(201).json({
    success: true,
    message: 'Ride requested successfully. Looking for nearby drivers...',
    data: { ride }
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
      status: {
        in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS']
      }
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true
        }
      },
      driver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
          driverProfile: {
            select: {
              vehicleType: true,
              vehicleMake: true,
              vehicleModel: true,
              vehicleColor: true,
              vehiclePlate: true,
              rating: true
            }
          }
        }
      }
    }
  });

  res.status(200).json({
    success: true,
    data: { ride }
  });
};

/**
 * @desc    Accept ride (Driver)
 * @route   PUT /api/rides/:id/accept
 * @access  Private (DRIVER)
 */
exports.acceptRide = async (req, res) => {
  const { id } = req.params;

  // Check if driver has active profile
  const driverProfile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!driverProfile || !driverProfile.isApproved) {
    throw new AppError('Driver profile not approved', 403);
  }

  if (!driverProfile.isOnline) {
    throw new AppError('Please go online to accept rides', 400);
  }

  // Check if driver has another active ride
  const activeRide = await prisma.ride.findFirst({
    where: {
      driverId: req.user.id,
      status: {
        in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS']
      }
    }
  });

  if (activeRide) {
    throw new AppError('You already have an active ride', 400);
  }

  // Find and update ride
  const ride = await prisma.ride.findUnique({
    where: { id }
  });

  if (!ride) {
    throw new AppError('Ride not found', 404);
  }

  if (ride.status !== 'REQUESTED') {
    throw new AppError('Ride is no longer available', 400);
  }

  const updatedRide = await prisma.ride.update({
    where: { id },
    data: {
      driverId: req.user.id,
      status: 'ACCEPTED',
      acceptedAt: new Date()
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      driver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          driverProfile: true
        }
      }
    }
  });

  // FUTURE: Notify customer via push notification
  // sendPushNotification(ride.customerId, 'Driver accepted your ride!');

  res.status(200).json({
    success: true,
    message: 'Ride accepted successfully',
    data: { ride: updatedRide }
  });
};

/**
 * @desc    Start ride
 * @route   PUT /api/rides/:id/start
 * @access  Private (DRIVER)
 */
exports.startRide = async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findUnique({
    where: { id }
  });

  if (!ride) {
    throw new AppError('Ride not found', 404);
  }

  if (ride.driverId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  if (ride.status !== 'ACCEPTED' && ride.status !== 'ARRIVED') {
    throw new AppError('Cannot start ride at this status', 400);
  }

  const updatedRide = await prisma.ride.update({
    where: { id },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date()
    }
  });

  res.status(200).json({
    success: true,
    message: 'Ride started',
    data: { ride: updatedRide }
  });
};

/**
 * @desc    Complete ride
 * @route   PUT /api/rides/:id/complete
 * @access  Private (DRIVER)
 */
exports.completeRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { actualFare } = req.body;

  const ride = await prisma.ride.findUnique({
    where: { id }
  });

  if (!ride) {
    throw new AppError('Ride not found', 404);
  }

  if (ride.driverId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  if (ride.status !== 'IN_PROGRESS') {
    throw new AppError('Ride is not in progress', 400);
  }

  // Update ride and create payment record
  const [updatedRide, payment] = await prisma.$transaction([
    prisma.ride.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualFare,
        completedAt: new Date()
      }
    }),
    prisma.payment.create({
      data: {
        userId: ride.customerId,
        rideId: id,
        amount: actualFare,
        method: 'CASH', // Default, can be updated
        status: 'PENDING'
      }
    })
  ]);

  // Update driver stats
  await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      totalRides: {
        increment: 1
      }
    }
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

  const ride = await prisma.ride.findUnique({
    where: { id }
  });

  if (!ride) {
    throw new AppError('Ride not found', 404);
  }

  if (ride.customerId !== req.user.id && ride.driverId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  if (ride.status === 'COMPLETED' || ride.status === 'CANCELLED') {
    throw new AppError('Cannot cancel this ride', 400);
  }

  const updatedRide = await prisma.ride.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason
    }
  });

  // FUTURE: Apply cancellation fee if ride was in progress
  // if (ride.status === 'IN_PROGRESS') {
  //   await createCancellationCharge(ride);
  // }

  res.status(200).json({
    success: true,
    message: 'Ride cancelled',
    data: { ride: updatedRide }
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
      where: {
        ...whereClause,
        status: {
          in: ['COMPLETED', 'CANCELLED']
        }
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        driver: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        rating: true
      },
      orderBy: {
        completedAt: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    }),
    prisma.ride.count({
      where: {
        ...whereClause,
        status: {
          in: ['COMPLETED', 'CANCELLED']
        }
      }
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      rides,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    }
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
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true
        }
      },
      driver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
          driverProfile: true
        }
      },
      payment: true,
      rating: true
    }
  });

  if (!ride) {
    throw new AppError('Ride not found', 404);
  }

  if (ride.customerId !== req.user.id && ride.driverId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  res.status(200).json({
    success: true,
    data: { ride }
  });
};

/**
 * @desc    Rate ride
 * @route   POST /api/rides/:id/rate
 * @access  Private
 */
exports.rateRide = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { rating, comment } = req.body;

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: { rating: true }
  });

  if (!ride) {
    throw new AppError('Ride not found', 404);
  }

  if (ride.customerId !== req.user.id) {
    throw new AppError('Only customer can rate the ride', 403);
  }

  if (ride.status !== 'COMPLETED') {
    throw new AppError('Can only rate completed rides', 400);
  }

  if (ride.rating) {
    throw new AppError('Ride already rated', 400);
  }

  const newRating = await prisma.rating.create({
    data: {
      userId: req.user.id,
      rideId: id,
      rating,
      comment
    }
  });

  // Update driver's average rating
  const driverRatings = await prisma.rating.findMany({
    where: {
      ride: {
        driverId: ride.driverId
      }
    }
  });

  const avgRating = driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length;

  await prisma.driverProfile.update({
    where: { userId: ride.driverId },
    data: { rating: avgRating }
  });

  res.status(201).json({
    success: true,
    message: 'Rating submitted successfully',
    data: { rating: newRating }
  });
};

module.exports = exports;