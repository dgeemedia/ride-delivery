// backend/src/controllers/delivery.controller.js
const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const { calculateDistance } = require('../utils/helpers');
const fareEngine = require('../utils/fareEngine');
const notificationService = require('../services/notification.service');
const { broadcastToPartners, emitToPartner } = require('../services/socket.service');
const shieldService = require('../services/shield.service');
const { logger } = require('../utils/logger');

exports.getFeeEstimate = async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng, packageWeight } = req.query;

  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    throw new AppError('Please provide pickup and dropoff coordinates', 400);
  }

  const distance = calculateDistance(
    parseFloat(pickupLat), parseFloat(pickupLng),
    parseFloat(dropoffLat), parseFloat(dropoffLng)
  );

  const feeResult         = await fareEngine.calculateDeliveryFee(distance, packageWeight ? parseFloat(packageWeight) : 0);
  const estimatedDuration = Math.ceil(distance / 0.4);

  res.status(200).json({
    success: true,
    data: {
      distance:          distance.toFixed(2),
      estimatedFee:      feeResult.estimatedFee.toFixed(2),
      baseFee:           feeResult.baseFee,
      distanceCharge:    feeResult.distanceCharge,
      weightCharge:      feeResult.weightCharge,
      estimatedDuration,
      currency:          'NGN',
    }
  });
};

exports.requestDelivery = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const {
    pickupAddress, pickupLat, pickupLng, pickupContact,
    dropoffAddress, dropoffLat, dropoffLng, dropoffContact,
    packageDescription, packageWeight, packageValue, notes, promoCode,
    partnerId: selectedPartnerId,
  } = req.body;

  const activeDelivery = await prisma.delivery.findFirst({
    where: { customerId: req.user.id, status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } }
  });
  if (activeDelivery) throw new AppError('You already have an active delivery', 400);

  const distance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);

  const feeResult    = await fareEngine.calculateDeliveryFee(distance, packageWeight || 0);
  let   estimatedFee = feeResult.estimatedFee;

  let appliedPromo = null;
  if (promoCode) {
    appliedPromo = await prisma.promoCode.findFirst({
      where: {
        code: promoCode.toUpperCase(), isActive: true,
        validFrom: { lte: new Date() }, validUntil: { gte: new Date() },
        applicableFor: { in: ['deliveries', 'both'] }
      }
    });
    if (appliedPromo) {
      if (appliedPromo.discountType === 'percentage') {
        estimatedFee = estimatedFee * (1 - appliedPromo.discountValue / 100);
      } else {
        estimatedFee = Math.max(0, estimatedFee - appliedPromo.discountValue);
      }
      estimatedFee = Math.round(estimatedFee / 50) * 50;
      await prisma.promoCode.update({ where: { id: appliedPromo.id }, data: { currentUses: { increment: 1 } } });
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
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } }
    }
  });

  const io = notificationService._io;
  const deliveryPayload = {
    deliveryId:         delivery.id,
    pickupAddress:      delivery.pickupAddress,
    pickupContact:      delivery.pickupContact,
    dropoffAddress:     delivery.dropoffAddress,
    dropoffContact:     delivery.dropoffContact,
    estimatedFee:       delivery.estimatedFee,
    distance:           delivery.distance,
    etaMinutes:         Math.ceil(delivery.distance / 0.4),
    packageDescription: delivery.packageDescription,
    packageWeight:      delivery.packageWeight,
    customer: {
      firstName:    delivery.customer.firstName,
      profileImage: delivery.customer.profileImage,
    },
  };

  if (selectedPartnerId) {
    emitToPartner(io, selectedPartnerId, 'delivery:incoming_request', deliveryPayload);
    logger.info(`[Delivery] Request ${delivery.id} sent to partner ${selectedPartnerId}`);
  } else {
    broadcastToPartners(io, 'delivery:incoming_request', deliveryPayload);
  }

  try {
    const autoShield = await shieldService.shouldAutoShield(req.user.id);
    if (autoShield.should && autoShield.beneficiary) {
      const result = await shieldService.createSession({
        userId:           req.user.id,
        deliveryId:       delivery.id,
        beneficiaryName:  autoShield.beneficiary.name,
        beneficiaryPhone: autoShield.beneficiary.phone,
        beneficiaryEmail: autoShield.beneficiary.email,
        autoTriggered:    true,
      });
      await notificationService.notify({
        userId:  req.user.id,
        title:   '🛡️ SHIELD Auto-Activated',
        message: `It's after 9 PM. ${autoShield.beneficiary.name} has been notified to watch over your delivery.`,
        type:    'shield_auto_activated',
        data:    { viewUrl: result.viewUrl },
      });
    }
  } catch (shieldErr) {
    console.error('[SHIELD] Auto-SHIELD delivery error:', shieldErr.message);
  }

  res.status(201).json({
    success: true,
    message: 'Delivery requested successfully. Looking for nearby delivery partners...',
    data: { delivery, feeBreakdown: feeResult, promoApplied: !!appliedPromo }
  });
};

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

  const wallet          = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  const walletBalance   = wallet?.balance ?? 0;
  const requiredBalance = delivery.estimatedFee;

  if (walletBalance < requiredBalance) {
    throw new AppError(
      `Insufficient wallet balance. You need at least ₦${requiredBalance.toLocaleString('en-NG')} to accept this delivery. ` +
      `Your current balance is ₦${walletBalance.toLocaleString('en-NG')}. Please top up your wallet.`,
      402
    );
  }

  const updatedDelivery = await prisma.delivery.update({
    where: { id },
    data: { partnerId: req.user.id, status: 'ASSIGNED', assignedAt: new Date() },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      partner:  { select: { id: true, firstName: true, lastName: true, phone: true, deliveryProfile: true } }
    }
  });

  await notificationService.notify({
    userId:  delivery.customerId,
    title:   'Delivery Partner Found! 🛵',
    message: `${req.user.firstName} ${req.user.lastName} will pick up your package shortly.`,
    type:    notificationService.TYPES.DELIVERY_ASSIGNED,
    data: {
      deliveryId:   id,
      partnerName:  `${req.user.firstName} ${req.user.lastName}`,
      vehicleType:  partnerProfile.vehicleType,
      vehiclePlate: partnerProfile.vehiclePlate
    }
  });

  res.status(200).json({ success: true, message: 'Delivery accepted successfully', data: { delivery: updatedDelivery } });
};

exports.pickupDelivery = async (req, res) => {
  const { id } = req.params;
  const delivery = await prisma.delivery.findUnique({ where: { id } });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.partnerId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (delivery.status !== 'ASSIGNED') throw new AppError('Cannot pickup at this status', 400);

  const updatedDelivery = await prisma.delivery.update({ where: { id }, data: { status: 'PICKED_UP', pickedUpAt: new Date() } });

  await notificationService.notify({
    userId:  delivery.customerId,
    title:   'Package Picked Up 📦',
    message: 'Your package has been picked up and is heading to the destination.',
    type:    notificationService.TYPES.DELIVERY_PICKED_UP,
    data:    { deliveryId: id }
  });

  res.status(200).json({ success: true, message: 'Package picked up', data: { delivery: updatedDelivery } });
};

exports.startTransit = async (req, res) => {
  const { id } = req.params;
  const delivery = await prisma.delivery.findUnique({ where: { id } });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.partnerId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (delivery.status !== 'PICKED_UP') throw new AppError('Package must be picked up first', 400);

  const updatedDelivery = await prisma.delivery.update({ where: { id }, data: { status: 'IN_TRANSIT' } });

  await notificationService.notify({
    userId:  delivery.customerId,
    title:   'Package In Transit 🚚',
    message: 'Your package is on the way to the delivery address!',
    type:    notificationService.TYPES.DELIVERY_IN_TRANSIT,
    data:    { deliveryId: id }
  });

  res.status(200).json({ success: true, message: 'Delivery in transit', data: { delivery: updatedDelivery } });
};

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

  const settings        = await fareEngine.getSettings();
  const commissionRate  = settings.delivery.platformCommission;
  const finalFee        = actualFee || delivery.estimatedFee;
  const platformFee     = Math.round(finalFee * commissionRate);
  const partnerEarnings = finalFee - platformFee;

  const [updatedDelivery, payment] = await prisma.$transaction([
    prisma.delivery.update({
      where: { id },
      data: { status: 'DELIVERED', actualFee: finalFee, recipientName, deliveryImageUrl, deliveredAt: new Date() }
    }),
    prisma.payment.create({
      data: {
        userId:         delivery.customerId,
        deliveryId:     id,
        amount:         finalFee,
        currency:       'NGN',
        method:         paymentMethod,
        status:         paymentMethod === 'WALLET' ? 'COMPLETED' : 'PENDING',
        transactionId:  `DEL-${id}-${Date.now()}`,
        platformFee,
        driverEarnings: partnerEarnings
      }
    })
  ]);

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
          walletId:    customerWallet.id,
          type:        'DEBIT',
          amount:      finalFee,
          description: `Delivery payment - ${delivery.pickupAddress} to ${delivery.dropoffAddress}`,
          status:      'COMPLETED',
          reference:   `DEL-${id}`
        }
      })
    ]);
  }

  await prisma.deliveryPartnerProfile.update({ where: { userId: req.user.id }, data: { totalDeliveries: { increment: 1 } } });

  await shieldService.closeSessionsForDelivery(id).catch(() => {});

  await notificationService.notify({
    userId:  delivery.customerId,
    title:   'Package Delivered! ✅',
    message: `Your package has been delivered to ${recipientName || 'the recipient'}. Total: ₦${finalFee.toFixed(2)}. Please rate your delivery partner!`,
    type:    notificationService.TYPES.DELIVERY_COMPLETED,
    data:    { deliveryId: id, fee: finalFee, deliveryImageUrl }
  });
  await notificationService.notify({
    userId:  req.user.id,
    title:   'Delivery Completed 💰',
    message: `Package delivered. Earnings: ₦${partnerEarnings.toFixed(2)} (after ${Math.round(commissionRate * 100)}% platform fee).`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { deliveryId: id, earnings: partnerEarnings, platformFee }
  });

  res.status(200).json({ success: true, message: 'Delivery completed successfully', data: { delivery: updatedDelivery, payment } });
};

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
    data:  { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
  });

  await shieldService.closeSessionsForDelivery(id).catch(() => {});

  const notifyUserId = cancelledByPartner ? delivery.customerId : delivery.partnerId;
  if (notifyUserId) {
    await notificationService.notify({
      userId:  notifyUserId,
      title:   'Delivery Cancelled',
      message: cancelledByPartner
        ? "Your delivery partner cancelled. We're finding another partner for you."
        : `Your delivery was cancelled. ${reason ? `Reason: ${reason}` : ''}`,
      type:    notificationService.TYPES.DELIVERY_CANCELLED,
      data:    { deliveryId: id, reason }
    });
  }

  res.status(200).json({ success: true, message: 'Delivery cancelled', data: { delivery: updatedDelivery } });
};

exports.getDeliveryHistory = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const whereClause = req.user.role === 'DELIVERY_PARTNER'
    ? { partnerId: req.user.id }
    : { customerId: req.user.id };

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where:   { ...whereClause, status: { in: ['DELIVERED', 'CANCELLED'] } },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        partner:  { select: { firstName: true, lastName: true } },
        rating:   true,
        payment:  { select: { amount: true, method: true, status: true, driverEarnings: true } }
      },
      orderBy: { deliveredAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(limit)
    }),
    prisma.delivery.count({ where: { ...whereClause, status: { in: ['DELIVERED', 'CANCELLED'] } } })
  ]);

  res.status(200).json({
    success: true,
    data: { deliveries, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

exports.getDeliveryById = async (req, res) => {
  const { id } = req.params;

  const delivery = await prisma.delivery.findUnique({
    where:   { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
      partner:  { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true, deliveryProfile: true } },
      payment:  true,
      rating:   true
    }
  });

  if (!delivery) throw new AppError('Delivery not found', 404);
  if (delivery.customerId !== req.user.id && delivery.partnerId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  res.status(200).json({ success: true, data: { delivery } });
};

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

  const newRating = await prisma.rating.create({ data: { userId: req.user.id, deliveryId: id, rating, comment } });

  // Recalculate partner's average rating from all their delivery ratings
  const partnerRatings = await prisma.rating.findMany({ where: { delivery: { partnerId: delivery.partnerId } } });
  const avgRating      = partnerRatings.reduce((sum, r) => sum + r.rating, 0) / partnerRatings.length;

  await prisma.deliveryPartnerProfile.update({ where: { userId: delivery.partnerId }, data: { rating: avgRating } });

  await notificationService.notify({
    userId:  delivery.partnerId,
    title:   `New Rating: ${'⭐'.repeat(rating)}`,
    message: `You received a ${rating}-star rating for your delivery. ${comment ? `"${comment}"` : ''}`,
    type:    'rating_received',
    data:    { deliveryId: id, rating, comment }
  });

  res.status(201).json({ success: true, message: 'Rating submitted successfully', data: { rating: newRating } });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/deliveries/nearby-partners
//
// FIX: Previously sorted purely by distanceKm, ignoring the rating stored on
// every DeliveryPartnerProfile. This made ratings cosmetic only — they were
// shown but never influenced who the customer saw first.
//
// New ranking uses the same weighted blend as getNearbyDrivers:
//   score = (normalised_rating × 0.65) − (normalised_distance × 0.35)
//
// New partners (rating = 0) get a neutral 3.0 so they aren't buried.
// ─────────────────────────────────────────────────────────────────────────────
exports.getNearbyPartners = async (req, res) => {
  const { pickupLat, pickupLng, radiusKm = 15 } = req.query;
  if (!pickupLat || !pickupLng) throw new AppError('Please provide pickup coordinates', 400);

  const lat    = parseFloat(pickupLat);
  const lng    = parseFloat(pickupLng);
  const radius = parseFloat(radiusKm);

  const partners = await prisma.deliveryPartnerProfile.findMany({
    where: { isApproved: true, isOnline: true, currentLat: { not: null }, currentLng: { not: null } },
    include: { user: { select: { id: true, firstName: true, lastName: true, profileImage: true, phone: true } } }
  });

  const nearby = partners
    .map(p => ({
      ...p,
      distanceKm: parseFloat(calculateDistance(lat, lng, p.currentLat, p.currentLng).toFixed(2)),
    }))
    .filter(p => p.distanceKm <= radius)
    // FIX: rank by rating+distance blend instead of distance-only
    .sort((a, b) => {
      // New partners with 0 ratings get a neutral 3.0 to avoid burying them
      const ratingA = (a.rating > 0 ? a.rating : 3.0) / 5;
      const ratingB = (b.rating > 0 ? b.rating : 3.0) / 5;
      const distA   = a.distanceKm / radius;
      const distB   = b.distanceKm / radius;
      // Higher score = shown first
      const scoreA  = ratingA * 0.65 - distA * 0.35;
      const scoreB  = ratingB * 0.65 - distB * 0.35;
      return scoreB - scoreA;
    })
    .slice(0, 20)
    .map(p => ({
      partnerId:           p.user.id,
      firstName:           p.user.firstName,
      lastName:            p.user.lastName,
      profileImage:        p.user.profileImage,
      vehicleType:         p.vehicleType,
      vehiclePlate:        p.vehiclePlate,
      rating:              parseFloat((p.rating || 0).toFixed(1)),
      totalDeliveries:     p.totalDeliveries,
      distanceKm:          p.distanceKm,
      etaMinutes:          Math.ceil(p.distanceKm / 0.4),
      currentLat:          p.currentLat,
      currentLng:          p.currentLng,
      preferredFloorPrice: p.preferredFloorPrice ?? 0,
    }));

  res.status(200).json({ success: true, data: { partners: nearby, total: nearby.length } });
};

module.exports = exports;