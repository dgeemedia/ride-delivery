// backend/src/controllers/partner.controller.js
const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notification.service');
const paymentService = require('../services/payment.service');

/**
 * @desc    Create or update delivery partner profile
 * @route   POST /api/partners/profile
 * @access  Private (DELIVERY_PARTNER)
 */
exports.createOrUpdateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { vehicleType, vehiclePlate, idImageUrl, vehicleImageUrl } = req.body;

  const existingProfile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });
  let profile;

  if (existingProfile) {
    profile = await prisma.deliveryPartnerProfile.update({
      where: { userId: req.user.id },
      data: {
        vehicleType,
        ...(vehiclePlate && { vehiclePlate }),
        ...(idImageUrl && { idImageUrl }),
        ...(vehicleImageUrl && { vehicleImageUrl }),
        ...(req.body.preferredFloorPrice !== undefined && {
          preferredFloorPrice: parseFloat(req.body.preferredFloorPrice) || null
        }),
      }
    });
  } else {
    if (!idImageUrl) throw new AppError('ID image is required for new profile', 400);

    profile = await prisma.deliveryPartnerProfile.create({
      data: {
        userId: req.user.id,
        vehicleType,
        vehiclePlate,
        idImageUrl,
        vehicleImageUrl,
        preferredFloorPrice: req.body.preferredFloorPrice
          ? parseFloat(req.body.preferredFloorPrice)
          : null,
      }
    });

    await notificationService.notify({
      userId: req.user.id,
      title: 'Profile Submitted for Review 🔍',
      message: 'Your delivery partner profile has been submitted. Our team will review and notify you within 24–48 hours.',
      type: 'profile_submitted',
      data: { profileId: profile.id }
    });
  }

  res.status(200).json({
    success: true,
    message: existingProfile ? 'Profile updated successfully' : 'Profile created. Awaiting admin approval.',
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
        select: { firstName: true, lastName: true, email: true, phone: true, profileImage: true }
      }
    }
  });

  if (!profile) throw new AppError('Delivery partner profile not found', 404);

  res.status(200).json({ success: true, data: { profile } });
};

/**
 * @desc    Update online/offline status
 * @route   PUT /api/partners/status
 * @access  Private (DELIVERY_PARTNER)
 */
exports.updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { isOnline, currentLat, currentLng } = req.body;

  const profile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) throw new AppError('Delivery partner profile not found', 404);
  if (!profile.isApproved) throw new AppError('Partner profile not approved yet', 403);

  if (!isOnline) {
    const activeDelivery = await prisma.delivery.findFirst({
      where: { partnerId: req.user.id, status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } }
    });
    if (activeDelivery) throw new AppError('Cannot go offline with an active delivery', 400);
  }

  const updatedProfile = await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: {
      isOnline,
      ...(currentLat !== undefined && { currentLat }),
      ...(currentLng !== undefined && { currentLng })
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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    dateFilter = { gte: today };
  } else if (period === 'week') {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    dateFilter = { gte: weekAgo };
  } else if (period === 'month') {
    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateFilter = { gte: monthAgo };
  } else if (startDate && endDate) {
    dateFilter = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const deliveries = await prisma.delivery.findMany({
    where: {
      partnerId: req.user.id,
      status: 'DELIVERED',
      ...(Object.keys(dateFilter).length > 0 && { deliveredAt: dateFilter })
    },
    include: { payment: { select: { amount: true, method: true, driverEarnings: true } } },
    orderBy: { deliveredAt: 'desc' }
  });

  const totalEarnings = deliveries.reduce((sum, d) => sum + (d.actualFee || 0), 0);
  const platformFee = totalEarnings * 0.15;
  const netEarnings = totalEarnings - platformFee;

  const wallet = await prisma.wallet.findUnique({
    where: { userId: req.user.id },
    select: { balance: true }
  });

  res.status(200).json({
    success: true,
    data: {
      totalEarnings: totalEarnings.toFixed(2),
      platformFee: platformFee.toFixed(2),
      netEarnings: netEarnings.toFixed(2),
      walletBalance: wallet?.balance?.toFixed(2) || '0.00',
      totalDeliveries: deliveries.length,
      averagePerDelivery: deliveries.length > 0 ? (totalEarnings / deliveries.length).toFixed(2) : '0.00',
      currency: 'NGN',
      period,
      deliveries: deliveries.map(d => ({
        id: d.id,
        deliveredAt: d.deliveredAt,
        fee: d.actualFee,
        partnerEarnings: d.payment?.driverEarnings,
        pickupAddress: d.pickupAddress,
        dropoffAddress: d.dropoffAddress,
        packageDescription: d.packageDescription
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
  const profile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) throw new AppError('Partner profile not found', 404);

  const [completedDeliveries, cancelledDeliveries, totalDeliveries] = await Promise.all([
    prisma.delivery.count({ where: { partnerId: req.user.id, status: 'DELIVERED' } }),
    prisma.delivery.count({ where: { partnerId: req.user.id, status: 'CANCELLED' } }),
    prisma.delivery.count({ where: { partnerId: req.user.id } })
  ]);

  const ratings = await prisma.rating.findMany({ where: { delivery: { partnerId: req.user.id } } });

  res.status(200).json({
    success: true,
    data: {
      totalDeliveries: profile.totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      rating: profile.rating.toFixed(2),
      totalRatings: ratings.length,
      completionRate: totalDeliveries > 0 ? ((completedDeliveries / totalDeliveries) * 100).toFixed(2) : '0.00',
      cancellationRate: totalDeliveries > 0 ? ((cancelledDeliveries / totalDeliveries) * 100).toFixed(2) : '0.00',
      isOnline: profile.isOnline,
      isApproved: profile.isApproved,
      vehicleInfo: { type: profile.vehicleType, plate: profile.vehiclePlate }
    }
  });
};

/**
 * @desc    Get nearby delivery requests
 * @route   GET /api/partners/nearby-requests
 * @access  Private (DELIVERY_PARTNER)
 */
exports.getNearbyRequests = async (req, res) => {
  const profile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) throw new AppError('Partner profile not found', 404);
  if (!profile.isOnline) throw new AppError('You must be online to see requests', 400);
  if (!profile.currentLat || !profile.currentLng) throw new AppError('Current location not set', 400);

  const pendingDeliveries = await prisma.delivery.findMany({
    where: { status: 'PENDING' },
    include: {
      customer: { select: { firstName: true, lastName: true, profileImage: true } }
    },
    take: 10,
    orderBy: { requestedAt: 'desc' }
  });

  res.status(200).json({
    success: true,
    data: {
      requests: pendingDeliveries,
      partnerLocation: { lat: profile.currentLat, lng: profile.currentLng }
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

  const profile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) throw new AppError('Partner profile not found', 404);

  const updatedProfile = await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: {
      ...(idImageUrl && { idImageUrl }),
      ...(vehicleImageUrl && { vehicleImageUrl })
    }
  });

  res.status(200).json({ success: true, message: 'Documents uploaded successfully', data: { profile: updatedProfile } });
};

// ─────────────────────────────────────────────
// PAYOUT SYSTEM
// ─────────────────────────────────────────────

/**
 * @desc    Request a payout to bank account
 * @route   POST /api/partners/payout/request
 * @access  Private (DELIVERY_PARTNER)
 */
exports.requestPayout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount, accountNumber, bankCode, accountName } = req.body;

  if (amount < 1000) throw new AppError('Minimum payout amount is ₦1,000', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet || wallet.balance < amount) {
    throw new AppError('Insufficient wallet balance for payout', 400);
  }

  const accountVerify = await paymentService.paystackVerifyAccount(accountNumber, bankCode).catch(() => null);
  if (!accountVerify) throw new AppError('Unable to verify bank account. Please check details.', 400);

  const recipient = await paymentService.paystackCreateTransferRecipient({
    accountNumber,
    bankCode,
    name: accountName || accountVerify.account_name
  });

  const transfer = await paymentService.paystackInitiateTransfer({
    amount: amount * 100,
    recipient: recipient.recipient_code,
    reason: `Partner payout - ${req.user.firstName} ${req.user.lastName}`
  });

  const reference = transfer.transfer_code || `PAYOUT-${Date.now()}`;

  const [updatedWallet, payout] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { decrement: amount } } }),
    prisma.payout.create({
      data: {
        userId: req.user.id,
        amount,
        currency: 'NGN',
        status: 'PENDING',
        accountNumber,
        bankCode,
        accountName: accountName || accountVerify.account_name,
        reference,
        recipientCode: recipient.recipient_code
      }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'WITHDRAWAL',
        amount,
        description: `Payout to ${accountNumber} (${bankCode})`,
        status: 'PENDING',
        reference
      }
    })
  ]);

  await notificationService.notify({
    userId: req.user.id,
    title: 'Payout Initiated 🏦',
    message: `₦${amount.toFixed(2)} payout to your bank is being processed. Reference: ${reference}`,
    type: notificationService.TYPES.WALLET_WITHDRAWAL,
    data: { amount, reference, accountNumber: `****${accountNumber.slice(-4)}` }
  });

  res.status(200).json({
    success: true,
    message: 'Payout initiated. Funds will arrive within 1–2 business days.',
    data: { payout, walletBalance: updatedWallet.balance, reference }
  });
};

/**
 * @desc    Get payout history
 * @route   GET /api/partners/payout/history
 * @access  Private (DELIVERY_PARTNER)
 */
exports.getPayoutHistory = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const where = { userId: req.user.id, ...(status && { status }) };

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({ where, orderBy: { createdAt: 'desc' }, skip: parseInt(skip), take: parseInt(limit) }),
    prisma.payout.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { payouts, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

module.exports = exports;