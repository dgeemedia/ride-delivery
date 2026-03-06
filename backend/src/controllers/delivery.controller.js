const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { calculateDistance, calculateDeliveryFee } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const { broadcastToPartners } = require('../services/socket.service');

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
    parseFloat(pickupLat), parseFloat(pickupLng),
    parseFloat(dropoffLat), parseFloat(dropoffLng)
  );

  const estimatedFee = calculateDeliveryFee(distance, packageWeight ? parseFloat(packageWeight) : 0);
  const estimatedDuration = Math.ceil(distance / 0.4);

  res.status(200).json({
    success: true,
    data: {
      distance: distance.toFixed(2),
      estimatedFee: estimatedFee.toFixed(2),
      estimatedDuration,
      currency: 'NGN'
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
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const {
    pickupAddress, pickupLat, pickupLng, pickupContact,
    dropoffAddress, dropoffLat, dropoffLng, dropoffContact,
    packageDescription, packageWeight, packageValue, notes, promoCode
  } = req.body;

  const activeDelivery = await prisma.delivery.findFirst({
    where: {
      customerId: req.user.id,
      status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
    }
  });

  if (activeDelivery) throw new AppError('You already have an active delivery', 400);

  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  let estimatedFee = calculateDeliveryFee(distance, packageWeight || 0);

  // Apply promo code if provided
  let appliedPromo = null;
  if (promoCode) {
    appliedPromo = await prisma.promoCode.findFirst({
      where: {
        code: promoCode.toUpperCase(),
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
        applicableFor: { in: ['deliveries', 'both'] }
      }
    });

    if (appliedPromo) {
      if (appliedPromo.discountType === 'percentage') {
        estimatedFee = estimatedFee * (1 - appliedPromo.discountValue / 100);
      } else {
        estimatedFee = Math.max(0, estimatedFee - appliedPromo.discountValue);
      }
      await prisma.promoCode.update({
        where: { id: appliedPromo.id },
        data: { currentUses: { increment: 1 } }
      });
    }
  }

  const delivery = await prisma.delivery.create({
    data: {
      customerId: req.user.id,
      pickupAddress, pickupLat, pickupLng, pickupContact,
      dropoffAddress, dropoffLat, dropoffLng, dropoffContact,
      packageDescription, packageWeight, packageValue,
      distance, estimatedFee, notes,
      promoCode: appliedPromo?.code || null,
      status: 'PENDING'
    },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true }
      }
    }
  });

  // Notify all online delivery partners about new delivery
  broadcastToPartners(notificationService._io, 'delivery:new_request', {
    deliveryId: delivery.id,
    pickupAddress: delivery.pickupAddress,
    dropoffAddress: delivery.dropoffAddress,
    estimatedFee: delivery.estimatedFee,
    distance: delivery.distance,
    packageDescription: delivery.packageDescription,
    customer: {
      firstName: delivery.customer.firstName,
      profileImage: delivery.customer.profileImage
    }
  });

  res.status(201).json({
    success: true,
    message: 'Delivery requested successfully. Looking for nearby delivery partners...',
    data: { delivery, promoApplied: !!appliedPromo }
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
    where: { ...whereClause, status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
      partner: {
        select: {
          id: true, firstName: true, lastName: true, phone: true, profileImage: true,
          deliveryProfile: { select: { vehicleType: true, vehiclePlate: true, rating: true, currentLat: true, currentLng: true } }
        }
      }
    }
  });

  res.status(200).json({ success: true, data: { delivery } });
};

/**
 * @desc    Accept delivery (Delivery Partner)
 * @route   PUT /api/deliveries/:id/accept
 * @access  Private (DELIVERY_PARTNER)
 */
exports.acceptDelivery = async (req, res) => {
  const { id } = req.params;

  const partnerProfile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });

  if (!partnerProfile || !partnerProfile.isApproved) throw new AppError('Delivery partner profile not approved', 403);
  if (!partnerProfile.isOnline) throw new AppError('Please go online to accept deliveries', 400);

  const activeDelivery = await prisma.delivery.findFirst({
    where: { partnerId: req.user.id, status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } }
  });

  if (activeDelivery) throw new AppError('You already have an active delivery', 400);

  const delivery = await prisma.delivery.findUnique({ where: { id } });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.status !== 'PENDING') throw new AppError('Delivery is no longer available', 400);

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: { partnerId: req.user.id, status: 'ASSIGNED', assignedAt: new Date() },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      partner: { select: { id: true, firstName: true, lastName: true, phone: true, deliveryProfile: true } }
    }
  });

  // Notify customer
  await notificationService.notify({
    userId: delivery.customerId,
    title: 'Delivery Partner Found! 🛵',
    message: `${req.user.firstName} ${req.user.lastName} will pick up your package shortly.`,
    type: notificationService.TYPES.DELIVERY_ASSIGNED,
    data: {
      deliveryId: id,
      partnerName: `${req.user.firstName} ${req.user.lastName}`,
      vehicleType: partnerProfile.vehicleType,
      vehiclePlate: partnerProfile.vehiclePlate
    }
  });

  res.status(200).json({ success: true, message: 'Delivery accepted successfully', data: { delivery: updatedDelivery } });
};

/**
 * @desc    Mark package as picked up
 * @route   PUT /api/deliveries/:id/pickup
 * @access  Private (DELIVERY_PARTNER)
 */
exports.pickupDelivery = async (req, res) => {
  const { id } = req.params;

  const delivery = await prisma.delivery.findUnique({ where: { id } });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.partnerId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (delivery.status !== 'ASSIGNED') throw new AppError('Cannot pickup at this status', 400);

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: { status: 'PICKED_UP', pickedUpAt: new Date() }
  });

  await notificationService.notify({
    userId: delivery.customerId,
    title: 'Package Picked Up 📦',
    message: 'Your package has been picked up and is heading to the destination.',
    type: notificationService.TYPES.DELIVERY_PICKED_UP,
    data: { deliveryId: id }
  });

  res.status(200).json({ success: true, message: 'Package picked up', data: { delivery: updatedDelivery } });
};

/**
 * @desc    Start transit (heading to dropoff)
 * @route   PUT /api/deliveries/:id/transit
 * @access  Private (DELIVERY_PARTNER)
 */
exports.startTransit = async (req, res) => {
  const { id } = req.params;

  const delivery = await prisma.delivery.findUnique({ where: { id } });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.partnerId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (delivery.status !== 'PICKED_UP') throw new AppError('Package must be picked up first', 400);

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: { status: 'IN_TRANSIT' }
  });

  await notificationService.notify({
    userId: delivery.customerId,
    title: 'Package In Transit 🚚',
    message: 'Your package is on the way to the delivery address!',
    type: notificationService.TYPES.DELIVERY_IN_TRANSIT,
    data: { deliveryId: id }
  });

  res.status(200).json({ success: true, message: 'Delivery in transit', data: { delivery: updatedDelivery } });
};

/**
 * @desc    Complete delivery
 * @route   PUT /api/deliveries/:id/complete
 * @access  Private (DELIVERY_PARTNER)
 */
exports.completeDelivery = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { id } = req.params;
  const { actualFee, recipientName, deliveryImageUrl, paymentMethod = 'CASH' } = req.body;

  const delivery = await prisma.delivery.findUnique({ where: { id } });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.partnerId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (delivery.status !== 'IN_TRANSIT') throw new AppError('Delivery is not in transit', 400);

  const finalFee = actualFee || delivery.estimatedFee;
  const platformFee = finalFee * 0.15;
  const partnerEarnings = finalFee - platformFee;

  const [updatedDelivery, payment] = await prisma.$transaction([
    prisma.delivery.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        actualFee: finalFee,
        recipientName,
        deliveryImageUrl,
        deliveredAt: new Date()
      }
    }),
    prisma.payment.create({
      data: {
        userId: delivery.customerId,
        deliveryId: id,
        amount: finalFee,
        currency: 'NGN',
        method: paymentMethod,
        status: paymentMethod === 'WALLET' ? 'COMPLETED' : 'PENDING',
        transactionId: `DEL-${id}-${Date.now()}`,
        platformFee,
        driverEarnings: partnerEarnings
      }
    })
  ]);

  // Handle wallet payment
  if (paymentMethod === 'WALLET') {
    const customerWallet = await prisma.wallet.findUnique({ where: { userId: delivery.customerId } });
    if (!customerWallet || customerWallet.balance < finalFee) {
      throw new AppError('Insufficient wallet balance', 400);
    }
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId: delivery.customerId }, data: { balance: { decrement: finalFee } } }),
      prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { increment: partnerEarnings } } }),
      prisma.walletTransaction.create({
        data: {
          walletId: customerWallet.id,
          type: 'DEBIT',
          amount: finalFee,
          description: `Delivery payment - ${delivery.pickupAddress} to ${delivery.dropoffAddress}`,
          status: 'COMPLETED',
          reference: `DEL-${id}`
        }
      })
    ]);
  }

  await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: { totalDeliveries: { increment: 1 } }
  });

  await notificationService.notify({
    userId: delivery.customerId,
    title: 'Package Delivered! ✅',
    message: `Your package has been delivered to ${recipientName || 'the recipient'}. Total: ₦${finalFee.toFixed(2)}. Please rate your delivery partner!`,
    type: notificationService.TYPES.DELIVERY_COMPLETED,
    data: { deliveryId: id, fee: finalFee, deliveryImageUrl }
  });

  await notificationService.notify({
    userId: req.user.id,
    title: 'Delivery Completed 💰',
    message: `Package delivered. Earnings: ₦${partnerEarnings.toFixed(2)} (after 15% platform fee).`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { deliveryId: id, earnings: partnerEarnings, platformFee }
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

  const delivery = await prisma.delivery.findUnique({ where: { id } });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.customerId !== req.user.id && delivery.partnerId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }
  if (delivery.status === 'DELIVERED' || delivery.status === 'CANCELLED') {
    throw new AppError('Cannot cancel this delivery', 400);
  }

  const cancelledByPartner = delivery.partnerId === req.user.id;

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
  });

  const notifyUserId = cancelledByPartner ? delivery.customerId : delivery.partnerId;
  if (notifyUserId) {
    await notificationService.notify({
      userId: notifyUserId,
      title: 'Delivery Cancelled',
      message: cancelledByPartner
        ? 'Your delivery partner cancelled. We\'re finding another partner for you.'
        : `Your delivery was cancelled. ${reason ? `Reason: ${reason}` : ''}`,
      type: notificationService.TYPES.DELIVERY_CANCELLED,
      data: { deliveryId: id, reason }
    });
  }

  res.status(200).json({ success: true, message: 'Delivery cancelled', data: { delivery: updatedDelivery } });
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
      where: { ...whereClause, status: { in: ['DELIVERED', 'CANCELLED'] } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        partner: { select: { firstName: true, lastName: true } },
        rating: true,
        payment: { select: { amount: true, method: true, status: true } }
      },
      orderBy: { deliveredAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    }),
    prisma.delivery.count({
      where: { ...whereClause, status: { in: ['DELIVERED', 'CANCELLED'] } }
    })
  ]);

  res.status(200).json({
    success: true,
    data: { deliveries, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
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
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
      partner: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true, deliveryProfile: true } },
      payment: true,
      rating: true
    }
  });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.customerId !== req.user.id && delivery.partnerId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  res.status(200).json({ success: true, data: { delivery } });
};

/**
 * @desc    Rate delivery
 * @route   POST /api/deliveries/:id/rate
 * @access  Private
 */
exports.rateDelivery = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { id } = req.params;
  const { rating, comment } = req.body;

  const delivery = await prisma.delivery.findUnique({ where: { id }, include: { rating: true } });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.customerId !== req.user.id) throw new AppError('Only customer can rate the delivery', 403);
  if (delivery.status !== 'DELIVERED') throw new AppError('Can only rate completed deliveries', 400);
  if (delivery.rating) throw new AppError('Delivery already rated', 400);

  const newRating = await prisma.rating.create({
    data: { userId: req.user.id, deliveryId: id, rating, comment }
  });

  const partnerRatings = await prisma.rating.findMany({
    where: { delivery: { partnerId: delivery.partnerId } }
  });

  const avgRating = partnerRatings.reduce((sum, r) => sum + r.rating, 0) / partnerRatings.length;

  await prisma.deliveryPartnerProfile.update({
    where: { userId: delivery.partnerId },
    data: { rating: avgRating }
  });

  await notificationService.notify({
    userId: delivery.partnerId,
    title: `New Rating: ${'⭐'.repeat(rating)}`,
    message: `You received a ${rating}-star rating for your delivery. ${comment ? `"${comment}"` : ''}`,
    type: 'rating_received',
    data: { deliveryId: id, rating, comment }
  });

  res.status(201).json({ success: true, message: 'Rating submitted successfully', data: { rating: newRating } });
};

module.exports = exports;