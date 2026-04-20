// backend/src/controllers/driver.controller.js
//
// FIXES applied:
//   1. requestPayout — now creates a PENDING Payout record (admin-approval flow)
//      instead of initiating a Paystack transfer directly.  The live bank
//      transfer is triggered only when an admin approves via
//      PUT /api/wallet/admin/payouts/:id/approve.
//   2. getEarnings — (already fixed in prior patch) sums payment.driverEarnings
//      directly instead of re-deriving from actualFare * 0.80.

const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notification.service');
const paymentService = require('../services/payment.service');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drivers/profile
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrUpdateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const {
    licenseNumber, vehicleType, vehicleMake, vehicleModel,
    vehicleYear, vehicleColor, vehiclePlate,
    licenseImageUrl, vehicleRegUrl, insuranceUrl,
  } = req.body;

  const existingProfile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  let profile;

  if (existingProfile) {
    profile = await prisma.driverProfile.update({
      where: { userId: req.user.id },
      data: {
        licenseNumber, vehicleType, vehicleMake, vehicleModel,
        vehicleYear, vehicleColor, vehiclePlate,
        ...(licenseImageUrl && { licenseImageUrl }),
        ...(vehicleRegUrl   && { vehicleRegUrl }),
        ...(insuranceUrl    && { insuranceUrl }),
      },
    });
  } else {
    if (!licenseImageUrl || !vehicleRegUrl || !insuranceUrl)
      throw new AppError('Document images are required for new profile', 400);

    profile = await prisma.driverProfile.create({
      data: {
        userId: req.user.id,
        licenseNumber, vehicleType, vehicleMake, vehicleModel,
        vehicleYear, vehicleColor, vehiclePlate,
        licenseImageUrl, vehicleRegUrl, insuranceUrl,
      },
    });

    await notificationService.notify({
      userId:  req.user.id,
      title:   'Profile Submitted for Review 🔍',
      message: 'Your driver profile has been submitted. Our team will review your documents and notify you within 24–48 hours.',
      type:    'profile_submitted',
      data:    { profileId: profile.id },
    });
  }

  res.status(200).json({
    success: true,
    message: existingProfile ? 'Profile updated successfully' : 'Profile created. Awaiting admin approval.',
    data:    { profile },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/profile
// ─────────────────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({
    where:   { userId: req.user.id },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true, profileImage: true } },
    },
  });
  if (!profile) throw new AppError('Driver profile not found', 404);
  res.status(200).json({ success: true, data: { profile } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/drivers/status
// ─────────────────────────────────────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { isOnline, currentLat, currentLng } = req.body;

  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile)            throw new AppError('Driver profile not found', 404);
  if (!profile.isApproved) throw new AppError('Driver profile not approved yet', 403);

  if (!isOnline) {
    const activeRide = await prisma.ride.findFirst({
      where: { driverId: req.user.id, status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } },
    });
    if (activeRide) throw new AppError('Cannot go offline with an active ride', 400);
  }

  const updatedProfile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      isOnline,
      ...(currentLat !== undefined && { currentLat }),
      ...(currentLng !== undefined && { currentLng }),
    },
  });

  res.status(200).json({
    success: true,
    message: `Driver is now ${isOnline ? 'online' : 'offline'}`,
    data:    { profile: updatedProfile },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/earnings
//
// Sums payment.driverEarnings directly — the value stored correctly at ride
// completion by the fare engine — instead of re-deriving from actualFare * 0.80.
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

  const rides = await prisma.ride.findMany({
    where: {
      driverId: req.user.id,
      status:   'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
    },
    include: {
      payment: { select: { amount: true, method: true, driverEarnings: true, platformFee: true } },
    },
    orderBy: { completedAt: 'desc' },
  });

  let totalGross       = 0;
  let totalNetEarnings = 0;
  let totalPlatformFee = 0;

  for (const r of rides) {
    totalGross       += r.actualFare           ?? 0;
    totalNetEarnings += r.payment?.driverEarnings ?? 0;
    totalPlatformFee += r.payment?.platformFee    ?? 0;
  }

  const wallet = await prisma.wallet.findUnique({
    where:  { userId: req.user.id },
    select: { balance: true },
  });

  res.status(200).json({
    success: true,
    data: {
      totalEarnings:  totalGross.toFixed(2),
      netEarnings:    totalNetEarnings.toFixed(2),
      platformFee:    totalPlatformFee.toFixed(2),
      walletBalance:  wallet?.balance?.toFixed(2) || '0.00',
      totalRides:     rides.length,
      averagePerRide: rides.length > 0 ? (totalNetEarnings / rides.length).toFixed(2) : '0.00',
      currency:       'NGN',
      period,
      rides: rides.map(r => ({
        id:             r.id,
        completedAt:    r.completedAt,
        grossFare:      r.actualFare,
        driverEarnings: r.payment?.driverEarnings,
        platformFee:    r.payment?.platformFee,
        paymentMethod:  r.payment?.method,
        pickupAddress:  r.pickupAddress,
        dropoffAddress: r.dropoffAddress,
      })),
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) throw new AppError('Driver profile not found', 404);

  const [completedRides, cancelledRides, totalRides] = await Promise.all([
    prisma.ride.count({ where: { driverId: req.user.id, status: 'COMPLETED' } }),
    prisma.ride.count({ where: { driverId: req.user.id, status: 'CANCELLED' } }),
    prisma.ride.count({ where: { driverId: req.user.id } }),
  ]);

  const ratings = await prisma.rating.findMany({ where: { ride: { driverId: req.user.id } } });

  res.status(200).json({
    success: true,
    data: {
      totalRides:       profile.totalRides,
      completedRides,
      cancelledRides,
      rating:           profile.rating.toFixed(2),
      totalRatings:     ratings.length,
      acceptanceRate:   totalRides > 0 ? ((completedRides / totalRides) * 100).toFixed(2) : '0.00',
      cancellationRate: totalRides > 0 ? ((cancelledRides / totalRides) * 100).toFixed(2) : '0.00',
      isOnline:         profile.isOnline,
      isApproved:       profile.isApproved,
      vehicleInfo: {
        type:  profile.vehicleType,
        make:  profile.vehicleMake,
        model: profile.vehicleModel,
        year:  profile.vehicleYear,
        plate: profile.vehiclePlate,
        color: profile.vehicleColor,
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/nearby-requests
// ─────────────────────────────────────────────────────────────────────────────
exports.getNearbyRequests = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile)                              throw new AppError('Driver profile not found', 404);
  if (!profile.isOnline)                     throw new AppError('You must be online to see requests', 400);
  if (!profile.currentLat || !profile.currentLng) throw new AppError('Current location not set', 400);

  const requestedRides = await prisma.ride.findMany({
    where:   { status: 'REQUESTED' },
    include: {
      customer: { select: { firstName: true, lastName: true, profileImage: true, phone: true } },
    },
    take:    10,
    orderBy: { requestedAt: 'desc' },
  });

  res.status(200).json({
    success: true,
    data: {
      requests:       requestedRides,
      driverLocation: { lat: profile.currentLat, lng: profile.currentLng },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drivers/documents
// ─────────────────────────────────────────────────────────────────────────────
exports.uploadDocuments = async (req, res) => {
  const { licenseImageUrl, vehicleRegUrl, insuranceUrl } = req.body;
  if (!licenseImageUrl && !vehicleRegUrl && !insuranceUrl)
    throw new AppError('At least one document is required', 400);

  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile) throw new AppError('Driver profile not found', 404);

  const updatedProfile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      ...(licenseImageUrl && { licenseImageUrl }),
      ...(vehicleRegUrl   && { vehicleRegUrl }),
      ...(insuranceUrl    && { insuranceUrl }),
    },
  });

  res.status(200).json({ success: true, message: 'Documents uploaded successfully', data: { profile: updatedProfile } });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drivers/payout/request
//
// FIX: The original immediately called paystackCreateTransferRecipient and
// paystackInitiateTransfer, bypassing admin approval entirely.
//
// New flow:
//   1. Validate amount (min ₦1,000) and wallet balance.
//   2. Verify bank account via Paystack (read-only — no money movement).
//   3. Deduct balance atomically and create PENDING WalletTransaction + Payout.
//   4. Notify driver + all admins.
//
// The actual Paystack bank transfer fires when an admin approves via
// PUT /api/wallet/admin/payouts/:id/approve.
// ─────────────────────────────────────────────────────────────────────────────
exports.requestPayout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount, accountNumber, bankCode, accountName } = req.body;

  if (amount < 1000) throw new AppError('Minimum payout amount is ₦1,000', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet)               throw new AppError('Wallet not found', 404);
  if (wallet.balance < amount) throw new AppError('Insufficient wallet balance', 400);

  // Verify account (read-only — identifies the account name before we proceed)
  const accountVerify = await paymentService.paystackVerifyAccount(accountNumber, bankCode).catch(() => null);
  if (!accountVerify) throw new AppError('Unable to verify bank account. Please check details.', 400);

  const resolvedAccountName = accountName || accountVerify.account_name;
  const reference           = `WD-${Date.now()}-${req.user.id.slice(0, 6)}`;

  // Atomic: hold funds + create PENDING records
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

  // Notify driver
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
        message: `${req.user.firstName} ${req.user.lastName} (Driver) → ${resolvedAccountName}: ₦${amount.toLocaleString('en-NG')}`,
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
// GET /api/drivers/payout/history
// ─────────────────────────────────────────────────────────────────────────────
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