// backend/src/controllers/partner.controller.js
'use strict';

const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notification.service');
const paymentService = require('../services/payment.service');

console.log('[PARTNER-CTRL] Prisma partner controller loaded');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/partners/profile — create or update vehicle info
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrUpdateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { vehicleType, vehiclePlate, idImageUrl, vehicleImageUrl } = req.body;

  const existingProfile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id },
  });

  let profile;

  if (existingProfile) {
    profile = await prisma.deliveryPartnerProfile.update({
      where: { userId: req.user.id },
      data: {
        ...(vehicleType    !== undefined && { vehicleType }),
        ...(vehiclePlate   !== undefined && { vehiclePlate }),
        ...(idImageUrl     !== undefined && { idImageUrl }),
        ...(vehicleImageUrl !== undefined && { vehicleImageUrl }),
        ...(req.body.preferredFloorPrice !== undefined && {
          preferredFloorPrice: parseFloat(req.body.preferredFloorPrice) || null,
        }),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { profile },
    });
  }

  // New profile — only vehicleType is required at registration
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

  // Notify the partner
  await notificationService.notify({
    userId:  req.user.id,
    title:   'Application Submitted 🔍',
    message: 'Your courier application is under review. Upload your ID to speed up approval.',
    type:    'profile_submitted',
    data:    { profileId: profile.id },
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
        title:   'New Courier Application 🛵',
        message: `${req.user.firstName} ${req.user.lastName} has submitted a courier application and is awaiting approval.`,
        type:    'partner_pending_review',
        data:    {
          partnerUserId:    req.user.id,
          partnerProfileId: profile.id,
          hasDocuments:     !!(idImageUrl || vehicleImageUrl),
        },
      })
    )
  );

  res.status(201).json({
    success: true,
    message: 'Application submitted. Upload your documents to help speed up review.',
    data:    { profile },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/partners/profile
// ─────────────────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where:   { userId: req.user.id },
    include: {
      user: {
        select: {
          firstName: true, lastName: true, email: true,
          phone: true, profileImage: true,
        },
      },
    },
  });
  if (!profile) throw new AppError('Delivery partner profile not found', 404);
  res.status(200).json({ success: true, data: { profile } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/partners/status — go online / offline
// ─────────────────────────────────────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { isOnline, currentLat, currentLng } = req.body;

  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!profile)           throw new AppError('Delivery partner profile not found.', 404);
  if (profile.isRejected) throw new AppError(
    'Your application was not approved. Please contact support.',
    403
  );
  if (!profile.isApproved) throw new AppError(
    'Your profile is still under review. You will be notified once approved.',
    403
  );

  if (!isOnline) {
    const activeDelivery = await prisma.delivery.findFirst({
      where: {
        partnerId: req.user.id,
        status:    { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
      },
    });
    if (activeDelivery) {
      throw new AppError('Cannot go offline with an active delivery in progress.', 400);
    }
  }

  const updatedProfile = await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data: {
      isOnline:   Boolean(isOnline),
      currentLat: currentLat ?? null,
      currentLng: currentLng ?? null,
    },
  });

  res.status(200).json({
    success: true,
    message: `You are now ${isOnline ? 'online' : 'offline'}.`,
    data:    { profile: updatedProfile },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/partners/earnings
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/partners/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id },
  });
  if (!profile) throw new AppError('Partner profile not found', 404);

  const [completedDeliveries, cancelledDeliveries, totalDeliveries] = await Promise.all([
    prisma.delivery.count({ where: { partnerId: req.user.id, status: 'DELIVERED'  } }),
    prisma.delivery.count({ where: { partnerId: req.user.id, status: 'CANCELLED'  } }),
    prisma.delivery.count({ where: { partnerId: req.user.id } }),
  ]);

  const ratings = await prisma.rating.findMany({
    where: { delivery: { partnerId: req.user.id } },
  });

  res.status(200).json({
    success: true,
    data: {
      totalDeliveries:     profile.totalDeliveries,
      completedDeliveries,
      cancelledDeliveries,
      rating:              profile.rating.toFixed(2),
      totalRatings:        ratings.length,
      completionRate:      totalDeliveries > 0
        ? ((completedDeliveries / totalDeliveries) * 100).toFixed(2) : '0.00',
      cancellationRate:    totalDeliveries > 0
        ? ((cancelledDeliveries / totalDeliveries) * 100).toFixed(2) : '0.00',
      isOnline:    profile.isOnline,
      isApproved:  profile.isApproved,
      isRejected:  profile.isRejected,
      vehicleInfo: { type: profile.vehicleType, plate: profile.vehiclePlate },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/partners/nearby-requests
// ─────────────────────────────────────────────────────────────────────────────
exports.getNearbyRequests = async (req, res) => {
  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id },
  });
  if (!profile)               throw new AppError('Partner profile not found', 404);
  if (!profile.isOnline)      throw new AppError('You must be online to see requests', 400);
  if (!profile.currentLat || !profile.currentLng)
    throw new AppError('Current location not set', 400);

  const pendingDeliveries = await prisma.delivery.findMany({
    where:   { status: 'PENDING' },
    include: {
      customer: { select: { firstName: true, lastName: true, profileImage: true } },
    },
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/partners/documents — upload / refresh document URLs
// ─────────────────────────────────────────────────────────────────────────────
exports.uploadDocuments = async (req, res) => {
  const { idImageUrl, vehicleImageUrl } = req.body;

  const hasAnyDocument = [idImageUrl, vehicleImageUrl].some(
    v => v !== undefined && v !== null && String(v).trim() !== ''
  );
  if (!hasAnyDocument) {
    throw new AppError('At least one document URL is required.', 400);
  }

  const profile = await prisma.deliveryPartnerProfile.findUnique({
    where: { userId: req.user.id },
  });
  if (!profile) throw new AppError('Partner profile not found.', 404);

  const updateData = { documentsUploadedAt: new Date() };

  if (idImageUrl      && String(idImageUrl).trim())
    updateData.idImageUrl      = String(idImageUrl).trim();
  if (vehicleImageUrl && String(vehicleImageUrl).trim())
    updateData.vehicleImageUrl = String(vehicleImageUrl).trim();

  const updatedProfile = await prisma.deliveryPartnerProfile.update({
    where: { userId: req.user.id },
    data:  updateData,
  });

  // Notify the partner
  await notificationService.notify({
    userId:  req.user.id,
    title:   'Documents Uploaded ✅',
    message: 'Your documents have been received. Our team will review them shortly.',
    type:    'documents_uploaded',
    data:    { profileId: profile.id },
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
        title:   'Courier Documents Uploaded 📄',
        message: `${req.user.firstName} ${req.user.lastName} has uploaded their documents. You can now review and approve their application.`,
        type:    'partner_documents_uploaded',
        data:    {
          partnerUserId:    req.user.id,
          partnerProfileId: profile.id,
        },
      })
    )
  );

  res.status(200).json({
    success: true,
    message: 'Documents uploaded. An admin will review your application.',
    data:    { profile: updatedProfile },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/partners/payout/request
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

  const accountVerify = await paymentService
    .paystackVerifyAccount(accountNumber, bankCode)
    .catch(() => null);
  if (!accountVerify)
    throw new AppError('Unable to verify bank account. Please check details.', 400);

  const resolvedAccountName = accountName || accountVerify.account_name;
  const reference           = `WD-${Date.now()}-${req.user.id.slice(0, 6)}`;

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

  await notificationService.notify({
    userId:  req.user.id,
    title:   'Withdrawal Requested 🏦',
    message: `₦${amount.toLocaleString('en-NG')} withdrawal to ${resolvedAccountName} is pending admin review.`,
    type:    notificationService.TYPES.WALLET_WITHDRAWAL,
    data:    { amount, accountNumber: `****${accountNumber.slice(-4)}`, bankCode, reference },
  });

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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/partners/payout/history
// ─────────────────────────────────────────────────────────────────────────────
exports.getPayoutHistory = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip  = (page - 1) * limit;
  const where = { userId: req.user.id, ...(status && { status }) };

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    parseInt(skip, 10),
      take:    parseInt(limit, 10),
    }),
    prisma.payout.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      payouts,
      pagination: { total, page: parseInt(page, 10), pages: Math.ceil(total / limit) },
    },
  });
};

module.exports = exports;