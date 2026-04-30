// backend/src/controllers/partner.controller.js
const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notification.service');
const paymentService = require('../services/payment.service');

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
        ...(vehicleType    && { vehicleType }),
        ...(vehiclePlate   && { vehiclePlate }),
        ...(idImageUrl      && { idImageUrl }),
        ...(vehicleImageUrl && { vehicleImageUrl }),
        ...(req.body.preferredFloorPrice !== undefined && {
          preferredFloorPrice: parseFloat(req.body.preferredFloorPrice) || null,
        }),
      },
    });
  } else {
    // ✅ FIX: ID image is NOT required at registration — it's uploaded separately
    // in PartnerDocumentsScreen. Only vehicle type is needed to create the profile.
    profile = await prisma.deliveryPartnerProfile.create({
      data: {
        userId: req.user.id,
        vehicleType,
        ...(vehiclePlate    && { vehiclePlate }),
        ...(idImageUrl      && { idImageUrl }),
        ...(vehicleImageUrl && { vehicleImageUrl }),
        ...(req.body.preferredFloorPrice !== undefined && {
          preferredFloorPrice: parseFloat(req.body.preferredFloorPrice) || null,
        }),
      },
    });

    await notificationService.notify({
      userId:  req.user.id,
      title:   'Profile Submitted for Review 🔍',
      message: 'Your courier profile has been submitted. Upload your ID so our team can complete the review within 24–48 hours.',
      type:    'profile_submitted',
      data:    { profileId: profile.id },
    });
  }

  res.status(200).json({
    success: true,
    message: existingProfile ? 'Profile updated successfully' : 'Profile created. Please upload your documents.',
    data:    { profile },
  });
};

exports.getProfile = async (req, res) => {
  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where:   { userId: req.user.id },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true, profileImage: true } },
    },
  });
  if (!profile) throw new AppError('Delivery partner profile not found', 404);
  res.status(200).json({ success: true, data: { profile } });
};

exports.updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { isOnline, currentLat, currentLng } = req.body;

  const profile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile)            throw new AppError('Delivery partner profile not found', 404);
  if (!profile.isApproved) throw new AppError('Partner profile not approved yet', 403);

  if (!isOnline) {
    const activeDelivery = await prisma.delivery.findFirst({
      where: { partnerId: req.user.id, status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
    });
    if (activeDelivery) throw new AppError('Cannot go offline with an active delivery', 400);
  }

  const updatedProfile = await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: {
      isOnline,
      ...(currentLat !== undefined && { currentLat }),
      ...(currentLng !== undefined && { currentLng }),
    },
  });

  res.status(200).json({
    success: true,
    message: `Partner is now ${isOnline ? 'online' : 'offline'}`,
    data:    { profile: updatedProfile },
  });
};

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
      status:    'DELIVERED',
      ...(Object.keys(dateFilter).length > 0 && { deliveredAt: dateFilter }),
    },
    include: {
      payment: { select: { amount: true, method: true, driverEarnings: true, platformFee: true } },
    },
    orderBy: { deliveredAt: 'desc' },
  });

  // ── FIX: use stored driverEarnings / platformFee instead of re-deriving ──
  let totalGross       = 0;
  let totalNetEarnings = 0;
  let totalPlatformFee = 0;

  for (const d of deliveries) {
    totalGross       += d.actualFee ?? 0;
    totalNetEarnings += d.payment?.driverEarnings ?? 0;
    totalPlatformFee += d.payment?.platformFee    ?? 0;
  }

  const wallet = await prisma.wallet.findUnique({
    where:  { userId: req.user.id },
    select: { balance: true },
  });

  res.status(200).json({
    success: true,
    data: {
      totalEarnings:      totalGross.toFixed(2),
      netEarnings:        totalNetEarnings.toFixed(2),
      platformFee:        totalPlatformFee.toFixed(2),
      walletBalance:      wallet?.balance?.toFixed(2) || '0.00',
      totalDeliveries:    deliveries.length,
      averagePerDelivery: deliveries.length > 0
        ? (totalNetEarnings / deliveries.length).toFixed(2)
        : '0.00',
      currency: 'NGN',
      period,
      deliveries: deliveries.map(d => ({
        id:                 d.id,
        deliveredAt:        d.deliveredAt,
        grossFee:           d.actualFee,
        partnerEarnings:    d.payment?.driverEarnings,
        platformFee:        d.payment?.platformFee,
        paymentMethod:      d.payment?.method,
        pickupAddress:      d.pickupAddress,
        dropoffAddress:     d.dropoffAddress,
        packageDescription: d.packageDescription,
      })),
    },
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
    prisma.delivery.count({ where: { partnerId: req.user.id, status: 'DELIVERED'  } }),
    prisma.delivery.count({ where: { partnerId: req.user.id, status: 'CANCELLED'  } }),
    prisma.delivery.count({ where: { partnerId: req.user.id } }),
  ]);

  const ratings = await prisma.rating.findMany({ where: { delivery: { partnerId: req.user.id } } });

  res.status(200).json({
    success: true,
    data: {
      totalDeliveries:     profile.totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      rating:              profile.rating.toFixed(2),
      totalRatings:        ratings.length,
      completionRate:      totalDeliveries > 0 ? ((completedDeliveries / totalDeliveries) * 100).toFixed(2) : '0.00',
      cancellationRate:    totalDeliveries > 0 ? ((cancelledDeliveries / totalDeliveries) * 100).toFixed(2) : '0.00',
      isOnline:            profile.isOnline,
      isApproved:          profile.isApproved,
      vehicleInfo:         { type: profile.vehicleType, plate: profile.vehiclePlate },
    },
  });
};

/**
 * @desc    Get nearby delivery requests
 * @route   GET /api/partners/nearby-requests
 * @access  Private (DELIVERY_PARTNER)
 */
exports.getNearbyRequests = async (req, res) => {
  const profile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile)               throw new AppError('Partner profile not found', 404);
  if (!profile.isOnline)      throw new AppError('You must be online to see requests', 400);
  if (!profile.currentLat || !profile.currentLng)
    throw new AppError('Current location not set', 400);

  const pendingDeliveries = await prisma.delivery.findMany({
    where:   { status: 'PENDING' },
    include: { customer: { select: { firstName: true, lastName: true, profileImage: true } } },
    take:    10,
    orderBy: { requestedAt: 'desc' },
  });

  res.status(200).json({
    success: true,
    data: {
      requests:        pendingDeliveries,
      partnerLocation: { lat: profile.currentLat, lng: profile.currentLng },
    },
  });
};

/**
 * @desc    Upload partner documents
 * @route   POST /api/partners/documents
 * @access  Private (DELIVERY_PARTNER)
 */
exports.uploadDocuments = async (req, res) => {
  const { idImageUrl, vehicleImageUrl } = req.body;
  if (!idImageUrl && !vehicleImageUrl) throw new AppError('At least one document is required', 400);

  const profile = await prisma.deliveryPartnerProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) throw new AppError('Partner profile not found', 404);

  const updatedProfile = await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: {
      ...(idImageUrl      && { idImageUrl }),
      ...(vehicleImageUrl && { vehicleImageUrl }),
    },
  });

  res.status(200).json({ success: true, message: 'Documents uploaded successfully', data: { profile: updatedProfile } });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/partners/payout/request
//
// FIX: The original immediately created a Paystack transfer recipient and
// initiated a live bank transfer, bypassing admin approval entirely.
//
// The new flow mirrors wallet.controller.js exports.withdraw():
//   1. Validate amount and balance.
//   2. Verify bank account via Paystack (read-only, no money movement).
//   3. Deduct balance atomically.
//   4. Create PENDING WalletTransaction + PENDING Payout record.
//   5. Notify user and all admins.
//
// Admin then approves via PUT /api/wallet/admin/payouts/:id/approve which
// triggers the actual Paystack transfer.
// ─────────────────────────────────────────────────────────────────────────────
exports.requestPayout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount, accountNumber, bankCode, accountName } = req.body;

  if (amount < 1000) throw new AppError('Minimum payout amount is ₦1,000', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet)               throw new AppError('Wallet not found', 404);
  if (wallet.balance < amount) throw new AppError('Insufficient wallet balance', 400);

  // Verify account details (read-only Paystack call — no transfer initiated)
  const accountVerify = await paymentService.paystackVerifyAccount(accountNumber, bankCode).catch(() => null);
  if (!accountVerify) throw new AppError('Unable to verify bank account. Please check details.', 400);

  const resolvedAccountName = accountName || accountVerify.account_name;
  const reference           = `WD-${Date.now()}-${req.user.id.slice(0, 6)}`;

  // Atomic: deduct balance + create PENDING records
  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: req.user.id },
      data:  { balance: { decrement: amount } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'WITHDRAWAL',
        amount,
        description: `Withdrawal request to ${resolvedAccountName} — ${accountNumber} (${bankCode})`,
        status:      'PENDING',
        reference,
      },
    }),
    prisma.payout.create({
      data: {
        userId:        req.user.id,
        amount,
        accountNumber,
        bankCode,
        accountName:   resolvedAccountName,
        status:        'PENDING',
        reference,
      },
    }),
  ]);

  // Notify partner
  await notificationService.notify({
    userId:  req.user.id,
    title:   'Withdrawal Requested 🏦',
    message: `₦${amount.toLocaleString('en-NG')} withdrawal to ${resolvedAccountName} is pending admin review.`,
    type:    notificationService.TYPES.WALLET_WITHDRAWAL,
    data:    { amount, accountNumber: `****${accountNumber.slice(-4)}`, bankCode, reference },
  });

  // Notify all admins
  const admins = await prisma.user.findMany({
    where:  { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });
  await Promise.allSettled(
    admins.map(a =>
      notificationService.notify({
        userId:  a.id,
        title:   'New Withdrawal Request 💸',
        message: `${req.user.firstName} ${req.user.lastName} (Partner) → ${resolvedAccountName}: ₦${amount.toLocaleString('en-NG')}`,
        type:    'withdrawal_pending',
        data:    { reference, userId: req.user.id, amount },
      })
    )
  );

  res.status(200).json({
    success: true,
    message: 'Withdrawal request submitted. Our team will process it within 1–2 business days.',
    data:    { reference, amount },
  });
};

/**
 * @desc    Get payout history
 * @route   GET /api/partners/payout/history
 * @access  Private (DELIVERY_PARTNER)
 */
exports.getPayoutHistory = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip  = (page - 1) * limit;
  const where = { userId: req.user.id, ...(status && { status }) };

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({ where, orderBy: { createdAt: 'desc' }, skip: parseInt(skip), take: parseInt(limit) }),
    prisma.payout.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: { payouts, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } },
  });
};

module.exports = exports;