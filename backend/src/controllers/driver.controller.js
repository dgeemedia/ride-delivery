// backend/src/controllers/driver.controller.js
//
// KEY FIX vs original:
//   getEarnings — was recalculating net earnings as (actualFare * 0.80) which is
//   wrong because the fareEngine applies the 20% commission on (fare - bookingFee),
//   not on the full fare.  We now sum payment.driverEarnings directly — the value
//   that was already calculated correctly at ride completion and stored on the
//   Payment record.

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
    licenseImageUrl, vehicleRegUrl, insuranceUrl
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
      }
    });
  } else {
    if (!licenseImageUrl || !vehicleRegUrl || !insuranceUrl)
      throw new AppError('Document images are required for new profile', 400);

    profile = await prisma.driverProfile.create({
      data: {
        userId: req.user.id,
        licenseNumber, vehicleType, vehicleMake, vehicleModel,
        vehicleYear, vehicleColor, vehiclePlate,
        licenseImageUrl, vehicleRegUrl, insuranceUrl
      }
    });

    await notificationService.notify({
      userId:  req.user.id,
      title:   'Profile Submitted for Review 🔍',
      message: 'Your driver profile has been submitted. Our team will review your documents and notify you within 24–48 hours.',
      type:    'profile_submitted',
      data:    { profileId: profile.id }
    });
  }

  res.status(200).json({
    success: true,
    message: existingProfile ? 'Profile updated successfully' : 'Profile created. Awaiting admin approval.',
    data:    { profile }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/profile
// ─────────────────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true, profileImage: true } }
    }
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
      where: { driverId: req.user.id, status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } }
    });
    if (activeRide) throw new AppError('Cannot go offline with an active ride', 400);
  }

  const updatedProfile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      isOnline,
      ...(currentLat !== undefined && { currentLat }),
      ...(currentLng !== undefined && { currentLng }),
    }
  });

  res.status(200).json({
    success: true,
    message: `Driver is now ${isOnline ? 'online' : 'offline'}`,
    data:    { profile: updatedProfile }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/earnings
//
// FIX: The original calculated:
//   platformFee = totalEarnings * 0.20   ← WRONG
//   netEarnings = totalEarnings - platformFee
//
// The fareEngine actually deducts the bookingFee first, then takes 20%:
//   commission = (fare - bookingFee) * 0.20
//   driverEarnings = fare - bookingFee - commission
//
// So the correct approach is to SUM the driverEarnings field already stored
// on the Payment record (set correctly at completeRide time).
// ─────────────────────────────────────────────────────────────────────────────
exports.getEarnings = async (req, res) => {
  const { startDate, endDate, period = 'all' } = req.query;

  let dateFilter = {};
  if (period === 'today') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    dateFilter  = { gte: today };
  } else if (period === 'week') {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    dateFilter    = { gte: weekAgo };
  } else if (period === 'month') {
    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateFilter     = { gte: monthAgo };
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
      payment: { select: { amount: true, method: true, driverEarnings: true, platformFee: true } }
    },
    orderBy: { completedAt: 'desc' }
  });

  // ── Correct aggregation — use stored driverEarnings, not a re-derived value ──
  let totalGross       = 0;   // sum of actualFare
  let totalNetEarnings = 0;   // sum of payment.driverEarnings (already fare-engine-correct)
  let totalPlatformFee = 0;   // sum of payment.platformFee

  for (const r of rides) {
    totalGross       += r.actualFare  ?? 0;
    totalNetEarnings += r.payment?.driverEarnings ?? 0;
    totalPlatformFee += r.payment?.platformFee    ?? 0;
  }

  const wallet = await prisma.wallet.findUnique({
    where:  { userId: req.user.id },
    select: { balance: true }
  });

  res.status(200).json({
    success: true,
    data: {
      // Gross (total charged to customers)
      totalEarnings:  totalGross.toFixed(2),
      // Net (what the driver actually keeps after platform cut)
      netEarnings:    totalNetEarnings.toFixed(2),
      platformFee:    totalPlatformFee.toFixed(2),
      walletBalance:  wallet?.balance?.toFixed(2) || '0.00',
      totalRides:     rides.length,
      averagePerRide: rides.length > 0
        ? (totalNetEarnings / rides.length).toFixed(2)
        : '0.00',
      currency: 'NGN',
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
      }))
    }
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
      }
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/nearby-requests
// ─────────────────────────────────────────────────────────────────────────────
exports.getNearbyRequests = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
  if (!profile)              throw new AppError('Driver profile not found', 404);
  if (!profile.isOnline)     throw new AppError('You must be online to see requests', 400);
  if (!profile.currentLat || !profile.currentLng)
    throw new AppError('Current location not set', 400);

  const requestedRides = await prisma.ride.findMany({
    where: { status: 'REQUESTED' },
    include: {
      customer: { select: { firstName: true, lastName: true, profileImage: true, phone: true } }
    },
    take:    10,
    orderBy: { requestedAt: 'desc' }
  });

  res.status(200).json({
    success: true,
    data: {
      requests:       requestedRides,
      driverLocation: { lat: profile.currentLat, lng: profile.currentLng }
    }
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
    }
  });

  res.status(200).json({ success: true, message: 'Documents uploaded successfully', data: { profile: updatedProfile } });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drivers/payout/request
// ─────────────────────────────────────────────────────────────────────────────
exports.requestPayout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount, accountNumber, bankCode, accountName } = req.body;
  if (amount < 1000) throw new AppError('Minimum payout amount is ₦1,000', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet || wallet.balance < amount)
    throw new AppError('Insufficient wallet balance for payout', 400);

  const accountVerify = await paymentService.paystackVerifyAccount(accountNumber, bankCode).catch(() => null);
  if (!accountVerify) throw new AppError('Unable to verify bank account. Please check details.', 400);

  const recipient = await paymentService.paystackCreateTransferRecipient({
    accountNumber,
    bankCode,
    name: accountName || accountVerify.account_name
  });

  const transfer = await paymentService.paystackInitiateTransfer({
    amount:    amount * 100,
    recipient: recipient.recipient_code,
    reason:    `Driver payout - ${req.user.firstName} ${req.user.lastName}`
  });

  const reference = transfer.transfer_code || `PAYOUT-${Date.now()}`;

  const [updatedWallet, payout] = await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: req.user.id },
      data:  { balance: { decrement: amount } }
    }),
    prisma.payout.create({
      data: {
        userId: req.user.id, amount, currency: 'NGN', status: 'PENDING',
        accountNumber, bankCode,
        accountName:    accountName || accountVerify.account_name,
        reference,
        recipientCode:  recipient.recipient_code,
      }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'WITHDRAWAL',
        amount,
        description: `Payout to ${accountNumber} (${bankCode})`,
        status:      'PENDING',
        reference,
      }
    })
  ]);

  await notificationService.notify({
    userId:  req.user.id,
    title:   'Payout Initiated 🏦',
    message: `₦${amount.toLocaleString('en-NG')} payout to your bank account is being processed. Reference: ${reference}`,
    type:    'wallet_withdrawal',
    data:    { amount, reference, accountNumber: `****${accountNumber.slice(-4)}` }
  });

  res.status(200).json({
    success: true,
    message: 'Payout initiated. Funds will arrive within 1–2 business days.',
    data:    { payout, walletBalance: updatedWallet.balance, reference }
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
    prisma.payout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(limit),
    }),
    prisma.payout.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { payouts, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

module.exports = exports;