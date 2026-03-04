const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

/**
 * @desc    Create or update driver profile
 * @route   POST /api/drivers/profile
 * @access  Private (DRIVER)
 */
exports.createOrUpdateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const {
    licenseNumber,
    vehicleType,
    vehicleMake,
    vehicleModel,
    vehicleYear,
    vehicleColor,
    vehiclePlate,
    licenseImageUrl,
    vehicleRegUrl,
    insuranceUrl
  } = req.body;

  // Check if profile already exists
  const existingProfile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id }
  });

  let profile;

  if (existingProfile) {
    // Update existing profile
    profile = await prisma.driverProfile.update({
      where: { userId: req.user.id },
      data: {
        licenseNumber,
        vehicleType,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleColor,
        vehiclePlate,
        ...(licenseImageUrl && { licenseImageUrl }),
        ...(vehicleRegUrl && { vehicleRegUrl }),
        ...(insuranceUrl && { insuranceUrl })
      }
    });
  } else {
    // Create new profile
    if (!licenseImageUrl || !vehicleRegUrl || !insuranceUrl) {
      throw new AppError('Document images are required for new profile', 400);
    }

    profile = await prisma.driverProfile.create({
      data: {
        userId: req.user.id,
        licenseNumber,
        vehicleType,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleColor,
        vehiclePlate,
        licenseImageUrl,
        vehicleRegUrl,
        insuranceUrl
      }
    });
  }

  res.status(200).json({
    success: true,
    message: existingProfile ? 'Profile updated successfully' : 'Profile created successfully',
    data: { profile }
  });
};

/**
 * @desc    Get driver profile
 * @route   GET /api/drivers/profile
 * @access  Private (DRIVER)
 */
exports.getProfile = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          profileImage: true
        }
      }
    }
  });

  if (!profile) {
    throw new AppError('Driver profile not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { profile }
  });
};

/**
 * @desc    Update online/offline status
 * @route   PUT /api/drivers/status
 * @access  Private (DRIVER)
 */
exports.updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { isOnline, currentLat, currentLng } = req.body;

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!profile) {
    throw new AppError('Driver profile not found', 404);
  }

  if (!profile.isApproved) {
    throw new AppError('Driver profile not approved yet', 403);
  }

  // Check for active ride if trying to go offline
  if (!isOnline) {
    const activeRide = await prisma.ride.findFirst({
      where: {
        driverId: req.user.id,
        status: {
          in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS']
        }
      }
    });

    if (activeRide) {
      throw new AppError('Cannot go offline with an active ride', 400);
    }
  }

  const updatedProfile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      isOnline,
      ...(currentLat && { currentLat }),
      ...(currentLng && { currentLng })
    }
  });

  res.status(200).json({
    success: true,
    message: `Driver is now ${isOnline ? 'online' : 'offline'}`,
    data: { profile: updatedProfile }
  });
};

/**
 * @desc    Get driver earnings
 * @route   GET /api/drivers/earnings
 * @access  Private (DRIVER)
 */
exports.getEarnings = async (req, res) => {
  const { startDate, endDate, period = 'all' } = req.query;

  let dateFilter = {};

  if (period === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateFilter = { gte: today };
  } else if (period === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    dateFilter = { gte: weekAgo };
  } else if (period === 'month') {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateFilter = { gte: monthAgo };
  } else if (startDate && endDate) {
    dateFilter = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const rides = await prisma.ride.findMany({
    where: {
      driverId: req.user.id,
      status: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 && {
        completedAt: dateFilter
      })
    },
    include: {
      payment: true
    },
    orderBy: {
      completedAt: 'desc'
    }
  });

  const totalEarnings = rides.reduce((sum, ride) => sum + (ride.actualFare || 0), 0);
  const totalRides = rides.length;
  
  // Calculate platform fee (example: 20%)
  const platformFeePercentage = 0.20;
  const platformFee = totalEarnings * platformFeePercentage;
  const netEarnings = totalEarnings - platformFee;

  res.status(200).json({
    success: true,
    data: {
      totalEarnings: totalEarnings.toFixed(2),
      platformFee: platformFee.toFixed(2),
      netEarnings: netEarnings.toFixed(2),
      totalRides,
      averagePerRide: totalRides > 0 ? (totalEarnings / totalRides).toFixed(2) : 0,
      period,
      rides: rides.map(ride => ({
        id: ride.id,
        completedAt: ride.completedAt,
        fare: ride.actualFare,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress
      }))
    }
  });
};

/**
 * @desc    Get driver statistics
 * @route   GET /api/drivers/stats
 * @access  Private (DRIVER)
 */
exports.getStats = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!profile) {
    throw new AppError('Driver profile not found', 404);
  }

  // Get ride statistics
  const [completedRides, cancelledRides, totalRides] = await Promise.all([
    prisma.ride.count({
      where: {
        driverId: req.user.id,
        status: 'COMPLETED'
      }
    }),
    prisma.ride.count({
      where: {
        driverId: req.user.id,
        status: 'CANCELLED'
      }
    }),
    prisma.ride.count({
      where: {
        driverId: req.user.id
      }
    })
  ]);

  // Get ratings
  const ratings = await prisma.rating.findMany({
    where: {
      ride: {
        driverId: req.user.id
      }
    }
  });

  const acceptanceRate = totalRides > 0 ? ((completedRides / totalRides) * 100).toFixed(2) : 0;
  const cancellationRate = totalRides > 0 ? ((cancelledRides / totalRides) * 100).toFixed(2) : 0;

  res.status(200).json({
    success: true,
    data: {
      totalRides: profile.totalRides,
      completedRides,
      cancelledRides,
      rating: profile.rating.toFixed(2),
      totalRatings: ratings.length,
      acceptanceRate,
      cancellationRate,
      isOnline: profile.isOnline,
      isApproved: profile.isApproved,
      vehicleInfo: {
        type: profile.vehicleType,
        make: profile.vehicleMake,
        model: profile.vehicleModel,
        year: profile.vehicleYear,
        plate: profile.vehiclePlate
      }
    }
  });
};

/**
 * @desc    Get nearby ride requests
 * @route   GET /api/drivers/nearby-requests
 * @access  Private (DRIVER)
 */
exports.getNearbyRequests = async (req, res) => {
  const { radius = 5 } = req.query; // Default 5km radius

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!profile) {
    throw new AppError('Driver profile not found', 404);
  }

  if (!profile.isOnline) {
    throw new AppError('You must be online to see requests', 400);
  }

  if (!profile.currentLat || !profile.currentLng) {
    throw new AppError('Current location not set', 400);
  }

  // Get all requested rides (simple version - in production, use spatial queries)
  const requestedRides = await prisma.ride.findMany({
    where: {
      status: 'REQUESTED'
    },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          profileImage: true
        }
      }
    },
    take: 10,
    orderBy: {
      requestedAt: 'desc'
    }
  });

  // FUTURE: Filter by actual distance using spatial queries
  // For now, returning all requested rides

  res.status(200).json({
    success: true,
    data: {
      requests: requestedRides,
      driverLocation: {
        lat: profile.currentLat,
        lng: profile.currentLng
      }
    }
  });
};

/**
 * @desc    Upload driver documents
 * @route   POST /api/drivers/documents
 * @access  Private (DRIVER)
 */
exports.uploadDocuments = async (req, res) => {
  const { licenseImageUrl, vehicleRegUrl, insuranceUrl } = req.body;

  if (!licenseImageUrl && !vehicleRegUrl && !insuranceUrl) {
    throw new AppError('At least one document is required', 400);
  }

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!profile) {
    throw new AppError('Driver profile not found', 404);
  }

  const updatedProfile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      ...(licenseImageUrl && { licenseImageUrl }),
      ...(vehicleRegUrl && { vehicleRegUrl }),
      ...(insuranceUrl && { insuranceUrl })
    }
  });

  res.status(200).json({
    success: true,
    message: 'Documents uploaded successfully',
    data: { profile: updatedProfile }
  });
};

module.exports = exports;