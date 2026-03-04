const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { calculateDistance, calculateDeliveryFee } = require('../utils/helpers');

const prisma = new PrismaClient();

/**
 * @desc    Get delivery fee estimate
 * @route   GET /api/deliveries/estimate
 * @access  Private
 */
exports.getFeeEstimate = async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, packageWeight } = req.query;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    throw new AppError('Please provide pickup and dropoff coordinates', 400);
  }

  const distance = calculateDistance(
    parseFloat(pickupLat),
    parseFloat(pickupLng),
    parseFloat(dropoffLat),
    parseFloat(dropoffLng)
  );

  const estimatedFee = calculateDeliveryFee(distance, packageWeight ? parseFloat(packageWeight) : 0);
  const estimatedDuration = Math.ceil(distance / 0.4); // Assume 24 km/h average for deliveries

  res.status(200).json({
    success: true,
    data: {
      distance: distance.toFixed(2),
      estimatedFee: estimatedFee.toFixed(2),
      estimatedDuration, // in minutes
      currency: 'USD'
    }
  });
};

/**
 * @desc    Request a new delivery
 * @route   POST /api/deliveries/request
 * @access  Private (CUSTOMER)
 */
exports.requestDelivery = async (req, res) => {
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
    pickupContact,
    dropoffAddress,
    dropoffLat,
    dropoffLng,
    dropoffContact,
    packageDescription,
    packageWeight,
    packageValue,
    notes
  } = req.body;

  // Check if user has an active delivery
  const activeDelivery = await prisma.delivery.findFirst({
    where: {
      customerId: req.user.id,
      status: {
        in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT']
      }
    }
  });

  if (activeDelivery) {
    throw new AppError('You already have an active delivery', 400);
  }

  // Calculate distance and fee
  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const estimatedFee = calculateDeliveryFee(distance, packageWeight || 0);

  // Create delivery
  const delivery = await prisma.delivery.create({
    data: {
      customerId: req.user.id,
      pickupAddress,
      pickupLat,
      pickupLng,
      pickupContact,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      dropoffContact,
      packageDescription,
      packageWeight,
      packageValue,
      distance,
      estimatedFee,
      notes,
      status: 'PENDING'
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

  // FUTURE: Notify nearby available delivery partners via Socket.io
  // const nearbyPartners = await findNearbyPartners(pickupLat, pickupLng, 5);
  // notifyPartners(nearbyPartners, delivery);

  res.status(201).json({
    success: true,
    message: 'Delivery requested successfully. Looking for nearby delivery partners...',
    data: { delivery }
  });
};

/**
 * @desc    Get user's active delivery
 * @route   GET /api/deliveries/active
 * @access  Private
 */
exports.getActiveDelivery = async (req, res) => {
  const whereClause = req.user.role === 'DELIVERY_PARTNER'
    ? { partnerId: req.user.id }
    : { customerId: req.user.id };

  const delivery = await prisma.delivery.findFirst({
    where: {
      ...whereClause,
      status: {
        in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT']
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
      partner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
          deliveryProfile: {
            select: {
              vehicleType: true,
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
    data: { delivery }
  });
};

/**
 * @desc    Accept delivery (Delivery Partner)
 * @route   PUT /api/deliveries/:id/accept
 * @access  Private (DELIVERY_PARTNER)
 */
exports.acceptDelivery = async (req, res) => {
  const { id } = req.params;

  // Check if partner has active profile
  const partnerProfile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id }
  });

  if (!partnerProfile || !partnerProfile.isApproved) {
    throw new AppError('Delivery partner profile not approved', 403);
  }

  if (!partnerProfile.isOnline) {
    throw new AppError('Please go online to accept deliveries', 400);
  }

  // Check if partner has another active delivery
  const activeDelivery = await prisma.delivery.findFirst({
    where: {
      partnerId: req.user.id,
      status: {
        in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT']
      }
    }
  });

  if (activeDelivery) {
    throw new AppError('You already have an active delivery', 400);
  }

  // Find and update delivery
  const delivery = await prisma.delivery.findUnique({
    where: { id }
  });

  if (!delivery) {
    throw new AppError('Delivery not found', 404);
  }

  if (delivery.status !== 'PENDING') {
    throw new AppError('Delivery is no longer available', 400);
  }

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: {
      partnerId: req.user.id,
      status: 'ASSIGNED',
      assignedAt: new Date()
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
      partner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          deliveryProfile: true
        }
      }
    }
  });

  // FUTURE: Notify customer via push notification
  // sendPushNotification(delivery.customerId, 'Delivery partner assigned!');

  res.status(200).json({
    success: true,
    message: 'Delivery accepted successfully',
    data: { delivery: updatedDelivery }
  });
};

/**
 * @desc    Mark package as picked up
 * @route   PUT /api/deliveries/:id/pickup
 * @access  Private (DELIVERY_PARTNER)
 */
exports.pickupDelivery = async (req, res) => {
  const { id } = req.params;

  const delivery = await prisma.delivery.findUnique({
    where: { id }
  });

  if (!delivery) {
    throw new AppError('Delivery not found', 404);
  }

  if (delivery.partnerId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  if (delivery.status !== 'ASSIGNED') {
    throw new AppError('Cannot pickup at this status', 400);
  }

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: {
      status: 'PICKED_UP',
      pickedUpAt: new Date()
    }
  });

  res.status(200).json({
    success: true,
    message: 'Package picked up',
    data: { delivery: updatedDelivery }
  });
};

/**
 * @desc    Start transit (heading to dropoff)
 * @route   PUT /api/deliveries/:id/transit
 * @access  Private (DELIVERY_PARTNER)
 */
exports.startTransit = async (req, res) => {
  const { id } = req.params;

  const delivery = await prisma.delivery.findUnique({
    where: { id }
  });

  if (!delivery) {
    throw new AppError('Delivery not found', 404);
  }

  if (delivery.partnerId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  if (delivery.status !== 'PICKED_UP') {
    throw new AppError('Package must be picked up first', 400);
  }

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: {
      status: 'IN_TRANSIT'
    }
  });

  res.status(200).json({
    success: true,
    message: 'Delivery in transit',
    data: { delivery: updatedDelivery }
  });
};

/**
 * @desc    Complete delivery
 * @route   PUT /api/deliveries/:id/complete
 * @access  Private (DELIVERY_PARTNER)
 */
exports.completeDelivery = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { actualFee, recipientName, deliveryImageUrl } = req.body;

  const delivery = await prisma.delivery.findUnique({
    where: { id }
  });

  if (!delivery) {
    throw new AppError('Delivery not found', 404);
  }

  if (delivery.partnerId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  if (delivery.status !== 'IN_TRANSIT') {
    throw new AppError('Delivery is not in transit', 400);
  }

  // Update delivery and create payment record
  const [updatedDelivery, payment] = await prisma.$transaction([
    prisma.delivery.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        actualFee: actualFee || delivery.estimatedFee,
        recipientName,
        deliveryImageUrl,
        deliveredAt: new Date()
      }
    }),
    prisma.payment.create({
      data: {
        userId: delivery.customerId,
        deliveryId: id,
        amount: actualFee || delivery.estimatedFee,
        method: 'CASH', // Default, can be updated
        status: 'PENDING'
      }
    })
  ]);

  // Update partner stats
  await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: {
      totalDeliveries: {
        increment: 1
      }
    }
  });

  res.status(200).json({
    success: true,
    message: 'Delivery completed successfully',
    data: { delivery: updatedDelivery, payment }
  });
};

/**
 * @desc    Cancel delivery
 * @route   PUT /api/deliveries/:id/cancel
 * @access  Private
 */
exports.cancelDelivery = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const delivery = await prisma.delivery.findUnique({
    where: { id }
  });

  if (!delivery) {
    throw new AppError('Delivery not found', 404);
  }

  if (delivery.customerId !== req.user.id && delivery.partnerId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  if (delivery.status === 'DELIVERED' || delivery.status === 'CANCELLED') {
    throw new AppError('Cannot cancel this delivery', 400);
  }

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason
    }
  });

  res.status(200).json({
    success: true,
    message: 'Delivery cancelled',
    data: { delivery: updatedDelivery }
  });
};

/**
 * @desc    Get delivery history
 * @route   GET /api/deliveries/history
 * @access  Private
 */
exports.getDeliveryHistory = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const whereClause = req.user.role === 'DELIVERY_PARTNER'
    ? { partnerId: req.user.id }
    : { customerId: req.user.id };

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where: {
        ...whereClause,
        status: {
          in: ['DELIVERED', 'CANCELLED']
        }
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        partner: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        rating: true
      },
      orderBy: {
        deliveredAt: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    }),
    prisma.delivery.count({
      where: {
        ...whereClause,
        status: {
          in: ['DELIVERED', 'CANCELLED']
        }
      }
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      deliveries,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    }
  });
};

/**
 * @desc    Get delivery by ID
 * @route   GET /api/deliveries/:id
 * @access  Private
 */
exports.getDeliveryById = async (req, res) => {
  const { id } = req.params;

  const delivery = await prisma.delivery.findUnique({
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
      partner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          profileImage: true,
          deliveryProfile: true
        }
      },
      payment: true,
      rating: true
    }
  });

  if (!delivery) {
    throw new AppError('Delivery not found', 404);
  }

  if (delivery.customerId !== req.user.id && delivery.partnerId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  res.status(200).json({
    success: true,
    data: { delivery }
  });
};

/**
 * @desc    Rate delivery
 * @route   POST /api/deliveries/:id/rate
 * @access  Private
 */
exports.rateDelivery = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { rating, comment } = req.body;

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { rating: true }
  });

  if (!delivery) {
    throw new AppError('Delivery not found', 404);
  }

  if (delivery.customerId !== req.user.id) {
    throw new AppError('Only customer can rate the delivery', 403);
  }

  if (delivery.status !== 'DELIVERED') {
    throw new AppError('Can only rate completed deliveries', 400);
  }

  if (delivery.rating) {
    throw new AppError('Delivery already rated', 400);
  }

  const newRating = await prisma.rating.create({
    data: {
      userId: req.user.id,
      deliveryId: id,
      rating,
      comment
    }
  });

  // Update partner's average rating
  const partnerRatings = await prisma.rating.findMany({
    where: {
      delivery: {
        partnerId: delivery.partnerId
      }
    }
  });

  const avgRating = partnerRatings.reduce((sum, r) => sum + r.rating, 0) / partnerRatings.length;

  await prisma.deliveryPartnerProfile.update({
    where: { userId: delivery.partnerId },
    data: { rating: avgRating }
  });

  res.status(201).json({
    success: true,
    message: 'Rating submitted successfully',
    data: { rating: newRating }
  });
};

module.exports = exports;