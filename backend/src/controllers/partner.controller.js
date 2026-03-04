const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

/**
 * @desc    Create or update delivery partner profile
 * @route   POST /api/partners/profile
 * @access  Private (DELIVERY_PARTNER)
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
    vehicleType,
    vehiclePlate,
    idImageUrl,
    vehicleImageUrl
  } = req.body;

  // Check if profile already exists
  const existingProfile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id }
  });

  let profile;

  if (existingProfile) {
    // Update existing profile
    profile = await prisma.deliveryPartnerProfile.update({
      where: { userId: req.user.id },
      data: {
        vehicleType,
        ...(vehiclePlate && { vehiclePlate }),
        ...(idImageUrl && { idImageUrl }),
        ...(vehicleImageUrl && { vehicleImageUrl })
      }
    });
  } else {
    // Create new profile
    if (!idImageUrl) {
      throw new AppError('ID image is required for new profile', 400);
    }

    profile = await prisma.deliveryPartnerProfile.create({
      data: {
        userId: req.user.id,
        vehicleType,
        vehiclePlate,
        idImageUrl,
        vehicleImageUrl
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
 * @desc    Get delivery partner profile
 * @route   GET /api/partners/profile
 * @access  Private (DELIVERY_PARTNER)
 */
exports.getProfile = async (req, res) => {
  const profile = await prisma.deliveryPartnerProfile.findUnique({
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
    throw new AppError('Delivery partner profile not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { profile }
  });
};

/**
 * @desc    Update online/offline status
 * @route   PUT /api/partners/status
 * @access  Private (DELIVERY_PARTNER)
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

  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!profile) {
    throw new AppError('Delivery partner profile not found', 404);
  }

  if (!profile.isApproved) {
    throw new AppError('Partner profile not approved yet', 403);
  }

  // Check for active delivery if trying to go offline
  if (!isOnline) {
    const activeDelivery = await prisma.delivery.findFirst({
      where: {
        partnerId: req.user.id,
        status: {
          in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT']
        }
      }
    });

    if (activeDelivery) {
      throw new AppError('Cannot go offline with an active delivery', 400);
    }
  }

  const updatedProfile = await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: {
      isOnline,
      ...(currentLat && { currentLat }),
      ...(currentLng && { currentLng })
    }
  });

  res.status(200).json({
    success: true,
    message: `Partner is now ${isOnline ? 'online' : 'offline'}`,
    data: { profile: updatedProfile }
  });
};

/**
 * @desc    Get partner earnings
 * @route   GET /api/partners/earnings
 * @access  Private (DELIVERY_PARTNER)
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

  const deliveries = await prisma.delivery.findMany({
    where: {
      partnerId: req.user.id,
      status: 'DELIVERED',
      ...(Object.keys(dateFilter).length > 0 && {
        deliveredAt: dateFilter
      })
    },
    include: {
      payment: true
    },
    orderBy: {
      deliveredAt: 'desc'
    }
  });

  const totalEarnings = deliveries.reduce((sum, delivery) => sum + (delivery.actualFee || 0), 0);
  const totalDeliveries = deliveries.length;
  
  // Calculate platform fee (example: 15%)
  const platformFeePercentage = 0.15;
  const platformFee = totalEarnings * platformFeePercentage;
  const netEarnings = totalEarnings - platformFee;

  res.status(200).json({
    success: true,
    data: {
      totalEarnings: totalEarnings.toFixed(2),
      platformFee: platformFee.toFixed(2),
      netEarnings: netEarnings.toFixed(2),
      totalDeliveries,
      averagePerDelivery: totalDeliveries > 0 ? (totalEarnings / totalDeliveries).toFixed(2) : 0,
      period,
      deliveries: deliveries.map(delivery => ({
        id: delivery.id,
        deliveredAt: delivery.deliveredAt,
        fee: delivery.actualFee,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        packageDescription: delivery.packageDescription
      }))
    }
  });
};

/**
 * @desc    Get partner statistics
 * @route   GET /api/partners/stats
 * @access  Private (DELIVERY_PARTNER)
 */
exports.getStats = async (req, res) => {
  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!profile) {
    throw new AppError('Partner profile not found', 404);
  }

  // Get delivery statistics
  const [completedDeliveries, cancelledDeliveries, totalDeliveries] = await Promise.all([
    prisma.delivery.count({
      where: {
        partnerId: req.user.id,
        status: 'DELIVERED'
      }
    }),
    prisma.delivery.count({
      where: {
        partnerId: req.user.id,
        status: 'CANCELLED'
      }
    }),
    prisma.delivery.count({
      where: {
        partnerId: req.user.id
      }
    })
  ]);

  // Get ratings
  const ratings = await prisma.rating.findMany({
    where: {
      delivery: {
        partnerId: req.user.id
      }
    }
  });

  const completionRate = totalDeliveries > 0 ? ((completedDeliveries / totalDeliveries) * 100).toFixed(2) : 0;
  const cancellationRate = totalDeliveries > 0 ? ((cancelledDeliveries / totalDeliveries) * 100).toFixed(2) : 0;

  res.status(200).json({
    success: true,
    data: {
      totalDeliveries: profile.totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      rating: profile.rating.toFixed(2),
      totalRatings: ratings.length,
      completionRate,
      cancellationRate,
      isOnline: profile.isOnline,
      isApproved: profile.isApproved,
      vehicleInfo: {
        type: profile.vehicleType,
        plate: profile.vehiclePlate
      }
    }
  });
};

/**
 * @desc    Get nearby delivery requests
 * @route   GET /api/partners/nearby-requests
 * @access  Private (DELIVERY_PARTNER)
 */
exports.getNearbyRequests = async (req, res) => {
  const { radius = 5 } = req.query;

  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!profile) {
    throw new AppError('Partner profile not found', 404);
  }

  if (!profile.isOnline) {
    throw new AppError('You must be online to see requests', 400);
  }

  if (!profile.currentLat || !profile.currentLng) {
    throw new AppError('Current location not set', 400);
  }

  // Get all pending deliveries
  const pendingDeliveries = await prisma.delivery.findMany({
    where: {
      status: 'PENDING'
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

  res.status(200).json({
    success: true,
    data: {
      requests: pendingDeliveries,
      partnerLocation: {
        lat: profile.currentLat,
        lng: profile.currentLng
      }
    }
  });
};

/**
 * @desc    Upload partner documents
 * @route   POST /api/partners/documents
 * @access  Private (DELIVERY_PARTNER)
 */
exports.uploadDocuments = async (req, res) => {
  const { idImageUrl, vehicleImageUrl } = req.body;

  if (!idImageUrl && !vehicleImageUrl) {
    throw new AppError('At least one document is required', 400);
  }

  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!profile) {
    throw new AppError('Partner profile not found', 404);
  }

  const updatedProfile = await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: {
      ...(idImageUrl && { idImageUrl }),
      ...(vehicleImageUrl && { vehicleImageUrl })
    }
  });

  res.status(200).json({
    success: true,
    message: 'Documents uploaded successfully',
    data: { profile: updatedProfile }
  });
};

module.exports = exports;