// backend/src/controllers/driver.controller.js

const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notification.service');
const paymentService = require('../services/payment.service');

console.log('[DRIVER-CTRL] Prisma driver controller loaded');

// ─────────────────────────────────────────────────────────────────────────────
//  All uploadable document fields mapped to their Prisma field name
//  and a human-readable label for notifications.
// ─────────────────────────────────────────────────────────────────────────────
const DRIVER_DOC_FIELDS = [
  // ── Personal KYC ──────────────────────────────────────────
  { field: 'applicantPhotoUrl',        label: 'Applicant Photo'            },
  { field: 'govtIdUrl',                label: 'Government ID'              },
  { field: 'proofOfAddressUrl',        label: 'Proof of Address'           },

  // ── Licence & registration (pre-existing) ─────────────────
  { field: 'licenseImageUrl',          label: "Driver's Licence"           },
  { field: 'vehicleRegUrl',            label: 'Vehicle Registration'       },
  { field: 'insuranceUrl',             label: 'Insurance Certificate'      },

  // ── Vehicle condition docs ─────────────────────────────────
  { field: 'roadWorthinessUrl',        label: 'Road Worthiness Cert'       },
  { field: 'vehicleInspectionUrl',     label: 'Vehicle Inspection Report'  },
  { field: 'hackneyCertUrl',           label: 'Hackney / Commercial Permit'},
  { field: 'vehiclePhotoExteriorUrl',  label: 'Vehicle Photo (Exterior)'   },
  { field: 'vehiclePhotoInteriorUrl',  label: 'Vehicle Photo (Interior)'   },

  // ── Motorcycle / Bike specific ─────────────────────────────
  { field: 'riderCardUrl',             label: "Rider's / Operator Card"    },
  { field: 'helmetPhotoUrl',           label: 'Helmet Photo'               },
  { field: 'dispatchPermitUrl',        label: 'Dispatch / Courier Permit'  },
  { field: 'guarantorLetterUrl',       label: 'Guarantor Letter'           },
  { field: 'guarantorIdUrl',           label: "Guarantor's ID"             },
];

const DRIVER_DOC_FIELD_NAMES = DRIVER_DOC_FIELDS.map((d) => d.field);

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function toOptionalTrimmedString(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function buildProfileData(body) {
  const data = {};

  if (body.licenseNumber !== undefined)
    data.licenseNumber = String(body.licenseNumber).trim().toUpperCase();

  if (body.vehicleType !== undefined) data.vehicleType = body.vehicleType;
  if (body.vehicleMake !== undefined) data.vehicleMake = String(body.vehicleMake).trim();
  if (body.vehicleModel !== undefined) data.vehicleModel = String(body.vehicleModel).trim();
  if (body.vehicleYear !== undefined) data.vehicleYear = parseInt(body.vehicleYear, 10);
  if (body.vehicleColor !== undefined) data.vehicleColor = String(body.vehicleColor).trim();

  if (body.vehiclePlate !== undefined)
    data.vehiclePlate = String(body.vehiclePlate).trim().toUpperCase();

  // Vehicle metadata
  if (body.numberOfSeats !== undefined)
    data.numberOfSeats = parseInt(body.numberOfSeats, 10) || null;

  if (body.vehicleSubType !== undefined)
    data.vehicleSubType = toOptionalTrimmedString(body.vehicleSubType);

  if (body.payloadCapacityKg !== undefined)
    data.payloadCapacityKg = parseFloat(body.payloadCapacityKg) || null;

  // Legacy document URL fields (kept for backward compat)
  if (body.licenseImageUrl !== undefined)
    data.licenseImageUrl = toOptionalTrimmedString(body.licenseImageUrl);
  if (body.vehicleRegUrl !== undefined)
    data.vehicleRegUrl = toOptionalTrimmedString(body.vehicleRegUrl);
  if (body.insuranceUrl !== undefined)
    data.insuranceUrl = toOptionalTrimmedString(body.insuranceUrl);

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drivers/profile — create or update vehicle / license info
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrUpdateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const profileData = buildProfileData(req.body);

  const existingProfile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
  });

  let profile;

  if (existingProfile) {
    profile = await prisma.driverProfile.update({
      where: { userId: req.user.id },
      data: profileData,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { profile },
    });
  }

  profile = await prisma.driverProfile.create({
    data: {
      userId: req.user.id,
      licenseNumber: profileData.licenseNumber,
      vehicleType: profileData.vehicleType,
      vehicleMake: profileData.vehicleMake,
      vehicleModel: profileData.vehicleModel,
      vehicleYear: profileData.vehicleYear,
      vehicleColor: profileData.vehicleColor,
      vehiclePlate: profileData.vehiclePlate,
      numberOfSeats: profileData.numberOfSeats ?? null,
      vehicleSubType: profileData.vehicleSubType ?? null,
      payloadCapacityKg: profileData.payloadCapacityKg ?? null,
      licenseImageUrl: profileData.licenseImageUrl ?? null,
      vehicleRegUrl: profileData.vehicleRegUrl ?? null,
      insuranceUrl: profileData.insuranceUrl ?? null,
    },
  });

  await notificationService.notify({
    userId: req.user.id,
    title: 'Application Submitted 🔍',
    message:
      'Your driver application is under review. Upload your documents to speed up approval.',
    type: 'profile_submitted',
    data: { profileId: profile.id },
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });

  await Promise.allSettled(
    admins.map((a) =>
      notificationService.notify({
        userId: a.id,
        title: 'New Driver Application 🚗',
        message: `${req.user.firstName} ${req.user.lastName} has submitted a driver application and is awaiting approval.`,
        type: 'driver_pending_review',
        data: {
          driverUserId: req.user.id,
          driverProfileId: profile.id,
        },
      })
    )
  );

  res.status(201).json({
    success: true,
    message:
      'Application submitted. Our team will review it — upload your documents to help speed things up.',
    data: { profile },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/profile
// ─────────────────────────────────────────────────────────────────────────────
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
          profileImage: true,
        },
      },
    },
  });

  if (!profile) throw new AppError('Driver profile not found', 404);

  res.status(200).json({ success: true, data: { profile } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/drivers/status — go online / offline
// ─────────────────────────────────────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { isOnline, currentLat, currentLng } = req.body;

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!profile) throw new AppError('Driver profile not found.', 404);
  if (profile.isRejected)
    throw new AppError('Your application was not approved. Please contact support.', 403);
  if (!profile.isApproved)
    throw new AppError(
      'Your profile is still under review. You will be notified once approved.',
      403
    );

  if (!isOnline) {
    const activeRide = await prisma.ride.findFirst({
      where: {
        driverId: req.user.id,
        status: { in: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] },
      },
    });
    if (activeRide)
      throw new AppError('Cannot go offline with an active ride in progress.', 400);
  }

  const updatedProfile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: {
      isOnline: Boolean(isOnline),
      currentLat: currentLat ?? null,
      currentLng: currentLng ?? null,
    },
  });

  res.status(200).json({
    success: true,
    message: `You are now ${isOnline ? 'online' : 'offline'}.`,
    data: { profile: updatedProfile },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/earnings
// ─────────────────────────────────────────────────────────────────────────────
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
    dateFilter = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const rides = await prisma.ride.findMany({
    where: {
      driverId: req.user.id,
      status: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 && { completedAt: dateFilter }),
    },
    include: {
      payment: {
        select: { amount: true, method: true, driverEarnings: true, platformFee: true },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  let totalGross = 0;
  let totalNetEarnings = 0;
  let totalPlatformFee = 0;

  for (const r of rides) {
    totalGross += r.actualFare ?? 0;
    totalNetEarnings += r.payment?.driverEarnings ?? 0;
    totalPlatformFee += r.payment?.platformFee ?? 0;
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: req.user.id },
    select: { balance: true },
  });

  res.status(200).json({
    success: true,
    data: {
      totalEarnings: totalGross.toFixed(2),
      netEarnings: totalNetEarnings.toFixed(2),
      platformFee: totalPlatformFee.toFixed(2),
      walletBalance: wallet?.balance?.toFixed(2) || '0.00',
      totalRides: rides.length,
      averagePerRide:
        rides.length > 0 ? (totalNetEarnings / rides.length).toFixed(2) : '0.00',
      currency: 'NGN',
      period,
      rides: rides.map((r) => ({
        id: r.id,
        completedAt: r.completedAt,
        grossFare: r.actualFare,
        driverEarnings: r.payment?.driverEarnings,
        platformFee: r.payment?.platformFee,
        paymentMethod: r.payment?.method,
        pickupAddress: r.pickupAddress,
        dropoffAddress: r.dropoffAddress,
      })),
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/stats
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
  });
  if (!profile) throw new AppError('Driver profile not found', 404);

  const [completedRides, cancelledRides, totalRides] = await Promise.all([
    prisma.ride.count({ where: { driverId: req.user.id, status: 'COMPLETED' } }),
    prisma.ride.count({ where: { driverId: req.user.id, status: 'CANCELLED' } }),
    prisma.ride.count({ where: { driverId: req.user.id } }),
  ]);

  const ratings = await prisma.rating.findMany({
    where: { ride: { driverId: req.user.id } },
  });

  res.status(200).json({
    success: true,
    data: {
      totalRides: profile.totalRides,
      completedRides,
      cancelledRides,
      rating: profile.rating.toFixed(2),
      totalRatings: ratings.length,
      acceptanceRate:
        totalRides > 0 ? ((completedRides / totalRides) * 100).toFixed(2) : '0.00',
      cancellationRate:
        totalRides > 0 ? ((cancelledRides / totalRides) * 100).toFixed(2) : '0.00',
      isOnline: profile.isOnline,
      isApproved: profile.isApproved,
      vehicleInfo: {
        type: profile.vehicleType,
        make: profile.vehicleMake,
        model: profile.vehicleModel,
        year: profile.vehicleYear,
        plate: profile.vehiclePlate,
        color: profile.vehicleColor,
        numberOfSeats: profile.numberOfSeats,
        subType: profile.vehicleSubType,
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/nearby-requests
// ─────────────────────────────────────────────────────────────────────────────
exports.getNearbyRequests = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!profile) throw new AppError('Driver profile not found', 404);
  if (!profile.isOnline) throw new AppError('You must be online to see requests', 400);
  if (profile.currentLat == null || profile.currentLng == null)
    throw new AppError('Current location not set', 400);

  const requestedRides = await prisma.ride.findMany({
    where: { status: 'REQUESTED' },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          profileImage: true,
          phone: true,
        },
      },
    },
    take: 10,
    orderBy: { requestedAt: 'desc' },
  });

  res.status(200).json({
    success: true,
    data: {
      requests: requestedRides,
      driverLocation: { lat: profile.currentLat, lng: profile.currentLng },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drivers/documents — upload / refresh document URLs
// ─────────────────────────────────────────────────────────────────────────────
exports.uploadDocuments = async (req, res) => {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId: req.user.id },
  });
  if (!profile) throw new AppError('Driver profile not found.', 404);

  // Build update payload from any recognised document field
  const updateData = { documentsUploadedAt: new Date() };

  for (const { field } of DRIVER_DOC_FIELDS) {
    const val = req.body[field];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      updateData[field] = String(val).trim();
    }
  }

  // Must have uploaded at least one actual document URL
  const uploadedCount = Object.keys(updateData).filter((k) => k !== 'documentsUploadedAt').length;
  if (uploadedCount === 0)
    throw new AppError('At least one document URL is required.', 400);

  const updatedProfile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data: updateData,
  });

  // Figure out which docs were uploaded for the notification message
  const uploadedLabels = DRIVER_DOC_FIELDS
    .filter(({ field }) => updateData[field])
    .map(({ label }) => label)
    .join(', ');

  await notificationService.notify({
    userId: req.user.id,
    title: 'Documents Uploaded ✅',
    message: `Received: ${uploadedLabels}. Our team will review them shortly.`,
    type: 'documents_uploaded',
    data: { profileId: profile.id },
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });

  await Promise.allSettled(
    admins.map((a) =>
      notificationService.notify({
        userId: a.id,
        title: 'Driver Documents Uploaded 📄',
        message: `${req.user.firstName} ${req.user.lastName} uploaded: ${uploadedLabels}.`,
        type: 'driver_documents_uploaded',
        data: {
          driverUserId: req.user.id,
          driverProfileId: profile.id,
          documents: Object.keys(updateData).filter((k) => k !== 'documentsUploadedAt'),
        },
      })
    )
  );

  res.status(200).json({
    success: true,
    message: 'Documents uploaded. An admin will review your application.',
    data: { profile: updatedProfile },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/drivers/payout/request
// ─────────────────────────────────────────────────────────────────────────────
exports.requestPayout = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { amount, accountNumber, bankCode, accountName } = req.body;

  if (amount < 1000) throw new AppError('Minimum payout amount is ₦1,000', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet) throw new AppError('Wallet not found', 404);
  if (wallet.balance < amount) throw new AppError('Insufficient wallet balance', 400);

  const accountVerify = await paymentService
    .paystackVerifyAccount(accountNumber, bankCode)
    .catch(() => null);
  if (!accountVerify)
    throw new AppError('Unable to verify bank account. Please check details.', 400);

  const resolvedAccountName = accountName || accountVerify.account_name;
  const reference = `WD-${Date.now()}-${req.user.id.slice(0, 6)}`;

  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: req.user.id },
      data: { balance: { decrement: amount } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'WITHDRAWAL',
        amount,
        description: `Withdrawal request to ${resolvedAccountName} — ${accountNumber} (${bankCode})`,
        status: 'PENDING',
        reference,
      },
    }),
    prisma.payout.create({
      data: {
        userId: req.user.id,
        amount,
        accountNumber,
        bankCode,
        accountName: resolvedAccountName,
        status: 'PENDING',
        reference,
      },
    }),
  ]);

  await notificationService.notify({
    userId: req.user.id,
    title: 'Withdrawal Requested 🏦',
    message: `₦${amount.toLocaleString('en-NG')} withdrawal to ${resolvedAccountName} is pending admin review.`,
    type: notificationService.TYPES.WALLET_WITHDRAWAL,
    data: {
      amount,
      accountNumber: `****${accountNumber.slice(-4)}`,
      bankCode,
      reference,
    },
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });

  await Promise.allSettled(
    admins.map((a) =>
      notificationService.notify({
        userId: a.id,
        title: 'New Withdrawal Request 💸',
        message: `${req.user.firstName} ${req.user.lastName} (Driver) → ${resolvedAccountName}: ₦${amount.toLocaleString('en-NG')}`,
        type: 'withdrawal_pending',
        data: { reference, userId: req.user.id, amount },
      })
    )
  );

  res.status(200).json({
    success: true,
    message: 'Withdrawal request submitted. Our team will process it within 1–2 business days.',
    data: { reference, amount },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/drivers/payout/history
// ─────────────────────────────────────────────────────────────────────────────
exports.getPayoutHistory = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;
  const where = { userId: req.user.id, ...(status && { status }) };

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip, 10),
      take: parseInt(limit, 10),
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

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/drivers/floor-price
// ────────────────────────────────────────────────────────────────────────────
exports.setFloorMultiplier = async (req, res) => {
  const { floorMultiplier } = req.body;
  const multiplier = parseFloat(floorMultiplier);

  if (isNaN(multiplier) || multiplier < 1.0 || multiplier > 1.30)
    throw new AppError(
      'Floor multiplier must be between 1.0 (no floor) and 1.30 (+30% max)',
      400
    );

  const profile = await prisma.driverProfile.update({
    where: { userId: req.user.id },
    data:  { floorMultiplier: multiplier },
  });

  const pctAbove = Math.round((multiplier - 1) * 100);
  res.status(200).json({
    success: true,
    message: pctAbove === 0
      ? 'Floor price removed — you will accept base fare.'
      : `Floor price set to +${pctAbove}% above base fare.`,
    data: { floorMultiplier: profile.floorMultiplier },
  });
};

module.exports = exports;