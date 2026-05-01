// backend/src/controllers/admin.controller.js
'use strict';

const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notification.service');
const shieldService = require('../services/shield.service');
const { invalidateFareCache } = require('../utils/fareEngine');
const bcrypt = require('bcryptjs');
const { invalidateMaintenanceCache } = require('../middleware/maintenance.middleware');
const commissionService = require('../services/commission.service');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const logActivity = async ({ userId, action, entityType, entityId, details, req }) => {
  await prisma.activityLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null,
    },
  });
};

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

exports.getDashboardStats = async (req, res) => {
  const [
    totalUsers, totalDrivers, totalPartners,
    totalRides, totalDeliveries, activeRides, activeDeliveries,
    todayRevenue, monthRevenue, totalWalletBalance,
    pendingDrivers, pendingPartners, openTickets,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.user.count({ where: { role: 'DRIVER' } }),
    prisma.user.count({ where: { role: 'DELIVERY_PARTNER' } }),
    prisma.ride.count({ where: { status: 'COMPLETED' } }),
    prisma.delivery.count({ where: { status: 'DELIVERED' } }),
    prisma.ride.count({ where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } } }),
    prisma.delivery.count({ where: { status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } } }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      _sum: { amount: true },
    }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.driverProfile.count({ where: { isApproved: false } }),
    prisma.deliveryPartnerProfile.count({ where: { isApproved: false } }),
    prisma.supportTicket.count({ where: { status: 'open' } }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      users:     { total: totalUsers, drivers: totalDrivers, partners: totalPartners },
      rides:     { total: totalRides, active: activeRides },
      deliveries:{ total: totalDeliveries, active: activeDeliveries },
      revenue:   { today: todayRevenue._sum.amount || 0, month: monthRevenue._sum.amount || 0, currency: 'NGN' },
      wallet:    { totalBalance: totalWalletBalance._sum.balance || 0 },
      pending:   { drivers: pendingDrivers, partners: pendingPartners },
      support:   { openTickets },
    },
  });
};

// ─────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────

exports.getUsers = async (req, res) => {
  const { page = 1, limit = 20, role, search, isActive } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
      { email:     { contains: search, mode: 'insensitive' } },
      { phone:     { contains: search, mode: 'insensitive' } },
    ];
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true,
        role: true, isActive: true, isSuspended: true, isVerified: true, createdAt: true,
        wallet: { select: { balance: true } },
      },
      skip: parseInt(skip), take: parseInt(limit), orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);
  res.status(200).json({ success: true, data: { users, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, phone: true, firstName: true, lastName: true,
      role: true, profileImage: true, isActive: true, isSuspended: true,
      isVerified: true, suspendedAt: true, suspensionReason: true, createdAt: true,
      driverProfile: true, deliveryProfile: true,
      wallet: { select: { balance: true, currency: true } },
      _count: { select: { customerRides: true, driverRides: true, customerDeliveries: true, partnerDeliveries: true, payments: true } },
    },
  });
  if (!user) throw new AppError('User not found', 404);
  res.status(200).json({ success: true, data: { user } });
};

exports.suspendUser = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false, isSuspended: true, suspendedAt: new Date(), suspendedBy: req.user.id, suspensionReason: reason || 'Suspended by admin' },
  });
  await notificationService.notify({ userId: id, title: 'Account Suspended', message: `Your account has been suspended. Reason: ${reason || 'Policy violation'}. Contact support to appeal.`, type: notificationService.TYPES.ACCOUNT_SUSPENDED, data: { reason, suspendedBy: req.user.id } });
  await logActivity({ userId: req.user.id, action: 'user_suspended', entityType: 'User', entityId: id, details: { reason }, req });
  res.status(200).json({ success: true, message: 'User suspended', data: { user } });
};

exports.activateUser = async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: true, isSuspended: false, suspendedAt: null, suspendedBy: null, suspensionReason: null },
  });
  await notificationService.notify({ userId: id, title: 'Account Activated ✅', message: 'Your account has been reactivated. Welcome back!', type: notificationService.TYPES.ACCOUNT_ACTIVATED, data: {} });
  await logActivity({ userId: req.user.id, action: 'user_activated', entityType: 'User', entityId: id, details: {}, req });
  res.status(200).json({ success: true, message: 'User activated', data: { user } });
};

// ─────────────────────────────────────────────
// DRIVER MANAGEMENT
// ─────────────────────────────────────────────

exports.getPendingDrivers = async (req, res) => {
  const drivers = await prisma.driverProfile.findMany({
    where: {
      isApproved: false,
      isRejected: false,
    },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true,
          email: true, phone: true,
          profileImage: true, createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Attach a derived `documentStatus` to each record so the admin dashboard
  // can surface "Has all docs", "Partial docs", or "No docs" without extra queries.
  const enriched = drivers.map(d => ({
    ...d,
    documentStatus: deriveDocumentStatus(d),
  }));

  res.status(200).json({ success: true, data: { drivers: enriched } });
};

// Helper — does NOT block approval, it's purely informational for the admin UI.
function deriveDocumentStatus(profile) {
  const uploaded = [profile.licenseImageUrl, profile.vehicleRegUrl, profile.insuranceUrl]
    .filter(Boolean).length;
  if (uploaded === 3) return 'COMPLETE';
  if (uploaded > 0)  return 'PARTIAL';
  return 'NONE';
}

exports.approveDriver = async (req, res) => {
  const { id } = req.params;
  const { grantBonus = false, bonusAmount = 5000, note = '' } = req.body;

  const driver = await prisma.driverProfile.findUnique({
    where:   { id },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!driver)            throw new AppError('Driver profile not found.', 404);
  if (driver.isApproved)  throw new AppError('Driver is already approved.', 400);

  const updatedDriver = await prisma.driverProfile.update({
    where: { id },
    data: {
      isApproved:     true,
      isRejected:     false,  // clear any prior rejection
      approvedAt:     new Date(),
      approvedBy:     req.user.id,
      rejectedAt:     null,
      rejectedBy:     null,
      rejectionReason: null,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Optional onboarding bonus (SUPER_ADMIN only)
  let bonusCredited = 0;
  const canGrantBonus = req.user.role === 'SUPER_ADMIN' && grantBonus && bonusAmount > 0;
  if (canGrantBonus) {
    const wallet = await prisma.wallet.findUnique({ where: { userId: driver.userId } });
    if (wallet) {
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: wallet.id },
          data:  { balance: { increment: bonusAmount } },
        }),
        prisma.walletTransaction.create({
          data: {
            walletId:    wallet.id,
            type:        'CREDIT',
            amount:      bonusAmount,
            description: 'Onboarding bonus — for accepting rides only, non-withdrawable.',
            status:      'COMPLETED',
            reference:   `ONBOARDING-DRV-${driver.userId}-${Date.now()}`,
          },
        }),
      ]);
      bonusCredited = bonusAmount;
    }
  }

  const docStatus     = deriveDocumentStatus(driver);
  const docStatusNote = docStatus === 'NONE'
    ? ' Note: this driver has not yet uploaded their documents — please follow up if required.'
    : docStatus === 'PARTIAL'
    ? ' Note: this driver has uploaded some but not all documents.'
    : '';

  const bonusNote = bonusCredited > 0
    ? ` We've credited ₦${bonusCredited.toLocaleString('en-NG')} to your wallet to get you started.`
    : '';

  await notificationService.notify({
    userId:  driver.userId,
    title:   'Application Approved! 🎉',
    message: `Welcome to the team, ${driver.user.firstName}! Your driver account is now active. Go online to start accepting rides.${bonusNote}${note ? ` Admin note: ${note}` : ''}`,
    type:    notificationService.TYPES.DRIVER_APPROVED,
    data:    { driverProfileId: id, bonusCredited, approvedBy: req.user.id },
  });

  await logActivity({
    userId:     req.user.id,
    action:     'driver_approved',
    entityType: 'DriverProfile',
    entityId:   id,
    details:    {
      driverUserId: driver.userId,
      bonusCredited,
      documentStatus: docStatus,
      approvedWithoutDocs: docStatus === 'NONE',
      note,
    },
    req,
  });

  res.status(200).json({
    success: true,
    message: `Driver approved.${bonusCredited ? ` ₦${bonusCredited.toLocaleString('en-NG')} onboarding bonus credited.` : ''}${docStatusNote}`,
    data:    { driver: updatedDriver, bonusCredited, documentStatus: docStatus },
  });
};

exports.rejectDriver = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim())
    throw new AppError('A rejection reason is required.', 400);

  const driver = await prisma.driverProfile.findUnique({
    where:   { id },
    include: { user: { select: { id: true, firstName: true } } },
  });
  if (!driver) throw new AppError('Driver profile not found.', 404);

  await prisma.driverProfile.update({
    where: { id },
    data: {
      isApproved:      false,
      isRejected:      true,
      rejectedAt:      new Date(),
      rejectedBy:      req.user.id,
      rejectionReason: reason.trim(),
    },
  });

  await notificationService.notify({
    userId:  driver.userId,
    title:   'Application Not Approved',
    message: `Unfortunately your driver application was not approved at this time. Reason: ${reason}. Please contact support if you have questions or wish to reapply.`,
    type:    notificationService.TYPES.DRIVER_REJECTED,
    data:    { reason, rejectedBy: req.user.id },
  });

  await logActivity({
    userId:     req.user.id,
    action:     'driver_rejected',
    entityType: 'DriverProfile',
    entityId:   id,
    details:    { reason, driverUserId: driver.userId },
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Driver application rejected. The driver has been notified.',
    data:    { driverProfileId: id, reason },
  });
};

exports.getDrivers = async (req, res) => {
  const { page = 1, limit = 20, search, isApproved, isRejected, vehicleType } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (isApproved !== undefined) where.isApproved = isApproved === 'true';
  if (isRejected !== undefined) where.isRejected = isRejected === 'true';
  if (vehicleType) where.vehicleType = vehicleType.toUpperCase();
  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { phone:     { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [drivers, total] = await Promise.all([
    prisma.driverProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, createdAt: true,
            isActive: true, isSuspended: true, isVerified: true,
          },
        },
      },
      skip,
      take:    parseInt(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.driverProfile.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      drivers: drivers.map(d => ({ ...d, documentStatus: deriveDocumentStatus(d) })),
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

exports.getDriverById = async (req, res) => {
  const { id } = req.params;
 
  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          profileImage: true, isActive: true, isSuspended: true, createdAt: true,
          wallet: { select: { balance: true, currency: true } },
          _count: { select: { driverRides: true } },
        },
      },
    },
  });
 
  if (!driver) throw new AppError('Driver not found', 404);
 
  // Recent rides
  const recentRides = await prisma.ride.findMany({
    where: { driverId: driver.userId },
    include: { customer: { select: { firstName: true, lastName: true } }, payment: { select: { amount: true, method: true, driverEarnings: true } } },
    orderBy: { requestedAt: 'desc' },
    take: 10,
  });
 
  res.status(200).json({ success: true, data: { driver, recentRides } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// Helper — purely informational for the admin UI, does NOT block approval.
function derivePartnerDocumentStatus(profile) {
  const uploaded = [profile.idImageUrl, profile.vehicleImageUrl]
    .filter(Boolean).length;
  if (uploaded === 2) return 'COMPLETE';
  if (uploaded === 1) return 'PARTIAL';
  return 'NONE';
}

exports.getPendingPartners = async (req, res) => {
  const partners = await prisma.deliveryPartnerProfile.findMany({
    where: {
      isApproved: false,
      isRejected: false,           // ← only truly pending, not rejected
    },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true,
          email: true, phone: true,
          profileImage: true, createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const enriched = partners.map(p => ({
    ...p,
    documentStatus: derivePartnerDocumentStatus(p),
  }));

  res.status(200).json({ success: true, data: { partners: enriched } });
};

exports.approvePartner = async (req, res) => {
  const { id } = req.params;
  const { grantBonus = false, bonusAmount = 5000, note = '' } = req.body;

  const partner = await prisma.deliveryPartnerProfile.findUnique({
    where:   { id },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!partner)           throw new AppError('Partner profile not found.', 404);
  if (partner.isApproved) throw new AppError('Partner is already approved.', 400);

  const updatedPartner = await prisma.deliveryPartnerProfile.update({
    where: { id },
    data: {
      isApproved:      true,
      isRejected:      false,     // clear any prior rejection
      approvedAt:      new Date(),
      approvedBy:      req.user.id,
      rejectedAt:      null,
      rejectedBy:      null,
      rejectionReason: null,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });

  // Optional onboarding bonus (SUPER_ADMIN only)
  let bonusCredited = 0;
  const canGrantBonus = req.user.role === 'SUPER_ADMIN' && grantBonus && bonusAmount > 0;
  if (canGrantBonus) {
    const wallet = await prisma.wallet.findUnique({ where: { userId: partner.userId } });
    if (wallet) {
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: wallet.id },
          data:  { balance: { increment: bonusAmount } },
        }),
        prisma.walletTransaction.create({
          data: {
            walletId:    wallet.id,
            type:        'CREDIT',
            amount:      bonusAmount,
            description: 'Onboarding bonus — for accepting deliveries only, non-withdrawable.',
            status:      'COMPLETED',
            reference:   `ONBOARDING-PTR-${partner.userId}-${Date.now()}`,
          },
        }),
      ]);
      bonusCredited = bonusAmount;
    }
  }

  const docStatus     = derivePartnerDocumentStatus(partner);
  const docStatusNote = docStatus === 'NONE'
    ? ' Note: this partner has not yet uploaded their documents — please follow up if required.'
    : docStatus === 'PARTIAL'
    ? ' Note: this partner has uploaded some but not all documents.'
    : '';

  const bonusNote = bonusCredited > 0
    ? ` We've credited ₦${bonusCredited.toLocaleString('en-NG')} to your wallet to get you started.`
    : '';

  await notificationService.notify({
    userId:  partner.userId,
    title:   'Application Approved! 🎉',
    message: `Welcome to the team, ${partner.user.firstName}! Your courier account is now active. Go online to start accepting deliveries.${bonusNote}${note ? ` Admin note: ${note}` : ''}`,
    type:    notificationService.TYPES.PARTNER_APPROVED,
    data:    { partnerProfileId: id, bonusCredited, approvedBy: req.user.id },
  });

  await logActivity({
    userId:     req.user.id,
    action:     'partner_approved',
    entityType: 'DeliveryPartnerProfile',
    entityId:   id,
    details:    {
      partnerUserId: partner.userId,
      bonusCredited,
      documentStatus: docStatus,
      approvedWithoutDocs: docStatus === 'NONE',
      note,
    },
    req,
  });

  res.status(200).json({
    success: true,
    message: `Partner approved.${bonusCredited ? ` ₦${bonusCredited.toLocaleString('en-NG')} onboarding bonus credited.` : ''}${docStatusNote}`,
    data:    { partner: updatedPartner, bonusCredited, documentStatus: docStatus },
  });
};

exports.rejectPartner = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim())
    throw new AppError('A rejection reason is required.', 400);

  const partner = await prisma.deliveryPartnerProfile.findUnique({
    where:   { id },
    include: { user: { select: { id: true, firstName: true } } },
  });
  if (!partner) throw new AppError('Partner profile not found.', 404);

  // ← UPDATE instead of DELETE — partner can see rejection reason and reapply
  await prisma.deliveryPartnerProfile.update({
    where: { id },
    data: {
      isApproved:      false,
      isRejected:      true,
      rejectedAt:      new Date(),
      rejectedBy:      req.user.id,
      rejectionReason: reason.trim(),
    },
  });

  await notificationService.notify({
    userId:  partner.userId,
    title:   'Application Not Approved',
    message: `Unfortunately your courier application was not approved at this time. Reason: ${reason}. Please contact support if you have questions or wish to reapply.`,
    type:    notificationService.TYPES.PARTNER_REJECTED,
    data:    { reason, rejectedBy: req.user.id },
  });

  await logActivity({
    userId:     req.user.id,
    action:     'partner_rejected',
    entityType: 'DeliveryPartnerProfile',
    entityId:   id,
    details:    { reason, partnerUserId: partner.userId },
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Partner application rejected. The partner has been notified.',
    data:    { partnerProfileId: id, reason },
  });
};

exports.getPartners = async (req, res) => {
  const { page = 1, limit = 20, search, isApproved, isRejected, vehicleType } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (isApproved !== undefined) where.isApproved = isApproved === 'true';
  if (isRejected !== undefined) where.isRejected = isRejected === 'true';  // ← NEW filter
  if (vehicleType) where.vehicleType = vehicleType.toUpperCase();
  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { email:     { contains: search, mode: 'insensitive' } },
        { phone:     { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [partners, total] = await Promise.all([
    prisma.deliveryPartnerProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true,
            email: true, phone: true, createdAt: true,
            isActive: true, isSuspended: true, isVerified: true,
          },
        },
      },
      skip,
      take:    parseInt(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.deliveryPartnerProfile.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      partners: partners.map(p => ({ ...p, documentStatus: derivePartnerDocumentStatus(p) })),
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

exports.getPartnerById = async (req, res) => {
  const { id } = req.params;

  const partner = await prisma.deliveryPartnerProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          profileImage: true, isActive: true, isSuspended: true, isVerified: true,
          suspensionReason: true, createdAt: true,
          wallet: { select: { balance: true, currency: true } },
          _count: { select: { partnerDeliveries: true } },
        },
      },
    },
  });

  if (!partner) throw new AppError('Delivery partner not found', 404);

  const recentDeliveries = await prisma.delivery.findMany({
    where:   { partnerId: partner.userId },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      payment:  { select: { amount: true, method: true, driverEarnings: true } },
    },
    orderBy: { requestedAt: 'desc' },
    take:    10,
  });

  res.status(200).json({
    success: true,
    data: {
      partner: { ...partner, documentStatus: derivePartnerDocumentStatus(partner) },
      recentDeliveries,
    },
  });
};

// ─────────────────────────────────────────────
// RIDE & DELIVERY MANAGEMENT
// ─────────────────────────────────────────────

exports.getRides = async (req, res) => {
  const { page = 1, limit = 20, status, driverId, customerId, startDate, endDate } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  if (driverId) where.driverId = driverId;
  if (customerId) where.customerId = customerId;
  if (startDate || endDate) {
    where.requestedAt = {};
    if (startDate) where.requestedAt.gte = new Date(startDate);
    if (endDate)   where.requestedAt.lte = new Date(endDate);
  }
  const [rides, total] = await Promise.all([
    prisma.ride.findMany({ where, include: { customer: { select: { firstName: true, lastName: true, email: true } }, driver: { select: { firstName: true, lastName: true, email: true } }, payment: true }, skip: parseInt(skip), take: parseInt(limit), orderBy: { requestedAt: 'desc' } }),
    prisma.ride.count({ where }),
  ]);
  res.status(200).json({ success: true, data: { rides, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
};

exports.getDeliveries = async (req, res) => {
  const { page = 1, limit = 20, status, partnerId, customerId } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  if (partnerId) where.partnerId = partnerId;
  if (customerId) where.customerId = customerId;
  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({ where, include: { customer: { select: { firstName: true, lastName: true, email: true } }, partner: { select: { firstName: true, lastName: true, email: true } }, payment: true }, skip: parseInt(skip), take: parseInt(limit), orderBy: { requestedAt: 'desc' } }),
    prisma.delivery.count({ where }),
  ]);
  res.status(200).json({ success: true, data: { deliveries, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
};

// ─────────────────────────────────────────────
// PAYMENT MANAGEMENT
// ─────────────────────────────────────────────

exports.getPayments = async (req, res) => {
  const {
    page   = 1,
    limit  = 25,
    status,
    method,
    search,
    hasRide,
    hasDelivery,
  } = req.query;
 
  const skip = (parseInt(page) - 1) * parseInt(limit);
 
  const where = {};
  if (status)            where.status  = status;
  if (method)            where.method  = method;
  if (hasRide === 'true')     where.rideId     = { not: null };
  if (hasDelivery === 'true') where.deliveryId = { not: null };
  if (search) {
    where.OR = [
      { transactionId: { contains: search, mode: 'insensitive' } },
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName:  { contains: search, mode: 'insensitive' } } },
      { user: { email:     { contains: search, mode: 'insensitive' } } },
      { user: { phone:     { contains: search } } },
    ];
  }
 
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        // Join CommissionLedger for platformFee / earnerAmount
        commissionLedger: { select: { commissionAmount: true, earnerAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.payment.count({ where }),
  ]);
 
  // Flatten commission fields into payment object
  const enriched = payments.map(p => ({
    ...p,
    platformFee:    p.commissionLedger?.commissionAmount ?? p.platformFee   ?? undefined,
    driverEarnings: p.commissionLedger?.earnerAmount     ?? p.driverEarnings ?? undefined,
    commissionLedger: undefined, // don't double-send
  }));
 
  res.status(200).json({
    success: true,
    data: {
      payments: enriched,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

exports.getPaymentById = async (req, res) => {
  const { id } = req.params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      commissionLedger: { select: { commissionAmount: true, earnerAmount: true } },
    },
  });
  if (!payment) throw new AppError('Payment not found', 404);
  res.status(200).json({ success: true, data: { payment } });
};
 
exports.getPaymentStats = async (req, res) => {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
 
  const [
    totalRevenue, todayRevenue,
    totalCommission, todayCommission,
    pendingCount, refundedTotal,
    byMethod,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: todayStart } },
      _sum: { amount: true },
    }),
    // Commission from CommissionLedger if available, else from platformFee column
    prisma.commissionLedger.aggregate({ _sum: { commissionAmount: true } }).catch(() => ({ _sum: { commissionAmount: 0 } })),
    prisma.commissionLedger.aggregate({
      where: { createdAt: { gte: todayStart } },
      _sum: { commissionAmount: true },
    }).catch(() => ({ _sum: { commissionAmount: 0 } })),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.aggregate({
      where: { status: 'REFUNDED' },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: { status: 'COMPLETED' },
      _sum:   { amount: true },
      _count: { id: true },
    }),
  ]);
 
  res.status(200).json({
    success: true,
    data: {
      totalRevenue:     totalRevenue._sum.amount        ?? 0,
      todayRevenue:     todayRevenue._sum.amount        ?? 0,
      totalCommission:  totalCommission._sum.commissionAmount ?? 0,
      todayCommission:  todayCommission._sum.commissionAmount ?? 0,
      pendingCount,
      refundedTotal:    refundedTotal._sum.amount       ?? 0,
      byMethod: byMethod.map(m => ({
        method: m.method,
        count:  m._count.id,
        total:  m._sum.amount ?? 0,
      })),
    },
  });
};

// ─────────────────────────────────────────────
// COMMISSION ANALYTICS
// ─────────────────────────────────────────────

exports.getCommissionAnalytics = async (req, res) => {
  const { from, to, serviceType, days } = req.query;
 
  const [stats, daily] = await Promise.all([
    commissionService.getCommissionStats({
      from:        from ? new Date(from) : undefined,
      to:          to   ? new Date(to)   : undefined,
      serviceType: serviceType || undefined,
    }),
    commissionService.getDailyCommission({
      days:        parseInt(days ?? '30'),
      serviceType: serviceType || undefined,
    }),
  ]);
 
  res.status(200).json({ success: true, data: { ...stats, daily } });
};

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────

exports.getRevenueAnalytics = async (req, res) => {
  const { period = 'month' } = req.query;
  let startDate = new Date();
  if (period === 'week')  startDate.setDate(startDate.getDate() - 7);
  else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
  else if (period === 'year')  startDate.setFullYear(startDate.getFullYear() - 1);

  const payments = await prisma.payment.findMany({ where: { status: 'COMPLETED', createdAt: { gte: startDate } }, select: { amount: true, createdAt: true, rideId: true, deliveryId: true, method: true }, orderBy: { createdAt: 'asc' } });
  const revenueByDate = {};
  payments.forEach(p => {
    const date = p.createdAt.toISOString().split('T')[0];
    if (!revenueByDate[date]) revenueByDate[date] = { date, total: 0, rides: 0, deliveries: 0, count: 0 };
    revenueByDate[date].total += p.amount;
    revenueByDate[date].count++;
    if (p.rideId)     revenueByDate[date].rides     += p.amount;
    if (p.deliveryId) revenueByDate[date].deliveries += p.amount;
  });
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const byMethod = {};
  payments.forEach(p => { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; });
  res.status(200).json({ success: true, data: { totalRevenue, platformFee: totalRevenue * 0.20, netRevenue: totalRevenue * 0.80, transactionCount: payments.length, dailyRevenue: Object.values(revenueByDate), byMethod, period, currency: 'NGN' } });
};

exports.getUserGrowth = async (req, res) => {
  const { period = 'month' } = req.query;
  let startDate = new Date();
  if (period === 'month') startDate.setMonth(startDate.getMonth() - 6);
  else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
  const users = await prisma.user.findMany({ where: { createdAt: { gte: startDate } }, select: { role: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  const growthByMonth = {};
  users.forEach(u => {
    const month = u.createdAt.toISOString().slice(0, 7);
    if (!growthByMonth[month]) growthByMonth[month] = { month, customers: 0, drivers: 0, partners: 0, total: 0 };
    growthByMonth[month].total++;
    if (u.role === 'CUSTOMER')         growthByMonth[month].customers++;
    if (u.role === 'DRIVER')           growthByMonth[month].drivers++;
    if (u.role === 'DELIVERY_PARTNER') growthByMonth[month].partners++;
  });
  res.status(200).json({ success: true, data: { growth: Object.values(growthByMonth), totalUsers: users.length, period } });
};

// ─────────────────────────────────────────────
// SYSTEM SETTINGS — busts fare cache on every save
// ─────────────────────────────────────────────

exports.getSettings = async (req, res) => {
  const { category } = req.query;
  const settings = await prisma.systemSettings.findMany({ where: category ? { category } : {} });
  const settingsMap = {};
  settings.forEach(s => { settingsMap[s.key] = { value: s.value, category: s.category, description: s.description }; });
  res.status(200).json({ success: true, data: { settings: settingsMap } });
};

exports.updateSetting = async (req, res) => {
  const { key } = req.params;
  const { value, category, description } = req.body;
  if (value === undefined) throw new AppError('Value is required', 400);

  const setting = await prisma.systemSettings.upsert({
    where:  { key },
    update: { value, updatedBy: req.user.id, ...(description && { description }) },
    create: { key, value, category: category || 'general', description, updatedBy: req.user.id },
  });

  // Bust fare engine cache so pricing is live immediately
  invalidateFareCache();

  // Bust maintenance cache so the new state takes effect immediately
  if (['maintenance_mode', 'maintenance_message', 'maintenance_starts_at', 'maintenance_ends_at'].includes(key)) {
  invalidateMaintenanceCache();
  }

  await logActivity({ userId: req.user.id, action: 'setting_updated', entityType: 'SystemSettings', entityId: setting.id, details: { key, value }, req });
  res.status(200).json({ success: true, message: 'Setting updated', data: { setting } });
};

exports.updateSettingsBatch = async (req, res) => {
  const { settings } = req.body;
  if (!Array.isArray(settings) || settings.length === 0)
    throw new AppError('settings array is required', 400);

  const results = await Promise.all(
    settings.map(({ key, value, category = 'general', description }) =>
      prisma.systemSettings.upsert({
        where:  { key },
        update: { value, updatedBy: req.user.id, ...(description && { description }) },
        create: { key, value, category, description, updatedBy: req.user.id },
      })
    )
  );

  const keys = settings.map(s => s.key);

  // Bust caches for any relevant keys
  invalidateFareCache();
  if (keys.some(k => k.startsWith('maintenance'))) invalidateMaintenanceCache();

  await logActivity({
    userId:     req.user.id,
    action:     'settings_batch_updated',
    entityType: 'SystemSettings',
    entityId:   null,
    details:    { keys },
    req,
  });

  res.json({ success: true, message: 'Settings updated', data: { settings: results } });
};

// ─────────────────────────────────────────────
// PROMO CODES
// ─────────────────────────────────────────────

exports.getPromoCodes = async (req, res) => {
  const { page = 1, limit = 20, isActive } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';
  const [codes, total] = await Promise.all([prisma.promoCode.findMany({ where, skip: parseInt(skip), take: parseInt(limit), orderBy: { createdAt: 'desc' } }), prisma.promoCode.count({ where })]);
  res.status(200).json({ success: true, data: { codes, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
};

exports.createPromoCode = async (req, res) => {
  const { code, description, discountType, discountValue, maxUses, maxUsesPerUser, minPurchaseAmount, validFrom, validUntil, applicableFor } = req.body;
  const existing = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (existing) throw new AppError('Promo code already exists', 400);
  const promo = await prisma.promoCode.create({ data: { code: code.toUpperCase(), description, discountType, discountValue, maxUses, maxUsesPerUser: maxUsesPerUser || 1, minPurchaseAmount, validFrom: new Date(validFrom), validUntil: new Date(validUntil), applicableFor } });
  res.status(201).json({ success: true, message: 'Promo code created', data: { promo } });
};

exports.togglePromoCode = async (req, res) => {
  const { id } = req.params;
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new AppError('Promo code not found', 404);
  const updated = await prisma.promoCode.update({ where: { id }, data: { isActive: !promo.isActive } });
  res.status(200).json({ success: true, message: `Promo code ${updated.isActive ? 'activated' : 'deactivated'}`, data: { promo: updated } });
};

// ─────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────

exports.getTickets = async (req, res) => {
  const { page = 1, limit = 20, status, priority, assignedTo } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignedTo) where.assignedTo = assignedTo;
  const [tickets, total] = await Promise.all([prisma.supportTicket.findMany({ where, skip: parseInt(skip), take: parseInt(limit), orderBy: { createdAt: 'desc' } }), prisma.supportTicket.count({ where })]);
  res.status(200).json({ success: true, data: { tickets, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
};

exports.updateTicket = async (req, res) => {
  const { id } = req.params;
  const { status, assignedTo, resolution } = req.body;
  const ticket = await prisma.supportTicket.update({ where: { id }, data: { ...(status && { status }), ...(assignedTo && { assignedTo }), ...(resolution && { resolution }), ...(status === 'resolved' && { resolvedAt: new Date() }) } });
  if (status === 'resolved') {
    await notificationService.notify({ userId: ticket.userId, title: 'Support Ticket Resolved ✅', message: `Your support ticket #${ticket.ticketNumber} has been resolved. ${resolution || ''}`, type: 'ticket_resolved', data: { ticketId: id, ticketNumber: ticket.ticketNumber } });
  }
  res.status(200).json({ success: true, message: 'Ticket updated', data: { ticket } });
};

// ─────────────────────────────────────────────
// ACTIVITY LOGS
// ─────────────────────────────────────────────

exports.getActivityLogs = async (req, res) => {
  const { page = 1, limit = 50, action, entityType, userId } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (action)     where.action     = action;
  if (entityType) where.entityType = entityType;
  if (userId)     where.userId     = userId;
  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({ where, include: { user: { select: { firstName: true, lastName: true, email: true } } }, skip: parseInt(skip), take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
    prisma.activityLog.count({ where }),
  ]);
  res.status(200).json({ success: true, data: { logs, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
};

// ─────────────────────────────────────────────
// WALLET MANAGEMENT
// ─────────────────────────────────────────────

exports.getWallets = async (req, res) => {
  const { page = 1, limit = 20, minBalance } = req.query;
  const skip = (page - 1) * limit;
  const where = {};
  if (minBalance) where.balance = { gte: parseFloat(minBalance) };
  const [wallets, total, totalBalance] = await Promise.all([
    prisma.wallet.findMany({ where, include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } }, skip: parseInt(skip), take: parseInt(limit), orderBy: { balance: 'desc' } }),
    prisma.wallet.count({ where }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
  ]);
  res.status(200).json({ success: true, data: { wallets, totalBalance: totalBalance._sum.balance || 0, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } } });
};

exports.adjustWallet = async (req, res) => {
  const { userId } = req.params;
  const { amount, type, reason } = req.body;
  if (!amount || amount <= 0) throw new AppError('Valid amount is required', 400);
  if (!['credit', 'debit'].includes(type)) throw new AppError('Type must be credit or debit', 400);
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError('Wallet not found', 404);
  if (type === 'debit' && wallet.balance < amount) throw new AppError('Insufficient wallet balance', 400);
  const newBalance = type === 'credit' ? wallet.balance + amount : wallet.balance - amount;
  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: newBalance } }),
    prisma.walletTransaction.create({ data: { walletId: wallet.id, type: type === 'credit' ? 'CREDIT' : 'DEBIT', amount, description: reason || `Admin ${type}`, status: 'COMPLETED', reference: `ADMIN-${Date.now()}` } }),
  ]);
  await notificationService.notify({ userId, title: type === 'credit' ? 'Wallet Credited 💰' : 'Wallet Debited', message: `Your wallet has been ${type}ed with ₦${amount.toFixed(2)}.${reason ? ` Reason: ${reason}` : ''}`, type: notificationService.TYPES.PAYMENT_RECEIVED, data: { amount, type, reason } });
  await logActivity({ userId: req.user.id, action: `wallet_${type}`, entityType: 'Wallet', entityId: wallet.id, details: { amount, reason, targetUserId: userId }, req });
  res.status(200).json({ success: true, message: `Wallet ${type}ed successfully`, data: { wallet: updatedWallet, transaction } });
};

exports.getWithdrawableBalance = async (wallet) => {
  const bonusCredits = await prisma.walletTransaction.aggregate({
    where: {
      walletId:    wallet.id,
      type:        'CREDIT',
      status:      'COMPLETED',
      description: { contains: 'non-withdrawable' },
    },
    _sum: { amount: true },
  });
  const totalBonus = bonusCredits._sum.amount ?? 0;
  return Math.max(0, wallet.balance - totalBonus);
};

// ─────────────────────────────────────────────
// BROADCAST NOTIFICATIONS
// ─────────────────────────────────────────────

exports.broadcastNotification = async (req, res) => {
  const { title, message, type = 'admin_broadcast', role } = req.body;
  if (!title || !message) throw new AppError('Title and message are required', 400);
  const where = { isActive: true };
  if (role) where.role = role;
  const users = await prisma.user.findMany({ where, select: { id: true } });
  await prisma.notification.createMany({ data: users.map(u => ({ userId: u.id, title, message, type, data: { broadcast: true, sentBy: req.user.id } })) });
  if (notificationService._io) {
    users.forEach(u => { notificationService._io.to(`user:${u.id}`).emit('notification', { title, message, type, data: { broadcast: true }, createdAt: new Date() }); });
  }
  await logActivity({ userId: req.user.id, action: 'broadcast_notification', entityType: 'Notification', entityId: null, details: { title, message, type, recipientCount: users.length, role }, req });
  res.status(200).json({ success: true, message: `Notification sent to ${users.length} user(s)`, data: { recipientCount: users.length } });
};

// ─────────────────────────────────────────────
// ONBOARDING BONUS BULK DISBURSEMENT
// SUPER_ADMIN only — credits all approved drivers/partners at ₦0 balance
// ─────────────────────────────────────────────

exports.disburseOnboardingBonuses = async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') throw new AppError('Only Super Admins can disburse onboarding bonuses', 403);

  const { driverBonus = 5000, partnerBonus = 5000 } = req.body;
  if (driverBonus < 0 || partnerBonus < 0) throw new AppError('Bonus amounts must be positive', 400);

  // ── FIX: use separate select levels — no mixing select+include on same level
  const [eligibleDrivers, eligiblePartners] = await Promise.all([
    prisma.driverProfile.findMany({
      where:   { isApproved: true },
      include: {
        user: {
          include: { wallet: { select: { id: true, balance: true } } },
        },
      },
    }),
    prisma.deliveryPartnerProfile.findMany({
      where:   { isApproved: true },
      include: {
        user: {
          include: { wallet: { select: { id: true, balance: true } } },
        },
      },
    }),
  ]);

  // Only credit those who currently have ₦0 (never received a bonus)
  const driversToBonus  = eligibleDrivers.filter(d  => (d.user.wallet?.balance ?? 0) === 0);
  const partnersToBonus = eligiblePartners.filter(p => (p.user.wallet?.balance ?? 0) === 0);

  let driverCount = 0, partnerCount = 0;
  const REF = `ONBOARDING-${Date.now()}`;

  for (const driver of driversToBonus) {
    const wallet = driver.user.wallet;
    if (!wallet) continue;
    await prisma.$transaction([
      prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: driverBonus } } }),
      prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'CREDIT', amount: driverBonus, description: 'Onboarding bonus — non-withdrawable, for accepting rides only', status: 'COMPLETED', reference: `${REF}-DRV-${driver.user.id}` } }),
    ]);
    await notificationService.notify({ userId: driver.user.id, title: '🎁 Onboarding Bonus Received!', message: `₦${driverBonus.toLocaleString('en-NG')} has been credited to your wallet. You can now start accepting rides. Welcome to Diakite!`, type: notificationService.TYPES?.PAYMENT_RECEIVED ?? 'payment_received', data: { amount: driverBonus, type: 'onboarding_bonus' } });
    driverCount++;
  }

  for (const partner of partnersToBonus) {
    const wallet = partner.user.wallet;
    if (!wallet) continue;
    await prisma.$transaction([
      prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: partnerBonus } } }),
      prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'CREDIT', amount: partnerBonus, description: 'Onboarding bonus — non-withdrawable, for accepting deliveries only', status: 'COMPLETED', reference: `${REF}-PTR-${partner.user.id}` } }),
    ]);
    await notificationService.notify({ userId: partner.user.id, title: '🎁 Onboarding Bonus Received!', message: `₦${partnerBonus.toLocaleString('en-NG')} has been credited to your wallet. You can now start accepting deliveries. Welcome to Diakite!`, type: notificationService.TYPES?.PAYMENT_RECEIVED ?? 'payment_received', data: { amount: partnerBonus, type: 'onboarding_bonus' } });
    partnerCount++;
  }

  await logActivity({ userId: req.user.id, action: 'onboarding_bonus_disbursed', entityType: 'Wallet', entityId: null, details: { driverBonus, partnerBonus, driverCount, partnerCount, totalDisbursed: (driverBonus * driverCount) + (partnerBonus * partnerCount) }, req });

  res.status(200).json({ success: true, message: `Onboarding bonus disbursed to ${driverCount} driver(s) and ${partnerCount} delivery partner(s).`, data: { drivers: driverCount, partners: partnerCount, driverBonus, partnerBonus, totalDisbursed: (driverBonus * driverCount) + (partnerBonus * partnerCount), currency: 'NGN' } });
};

// ─── RIDE DETAIL ─────────────────────────────────────────────────────────────

exports.getRideById = async (req, res) => {
  const { id } = req.params;
 
  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, profileImage: true } },
      driver: {
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true, profileImage: true,
          driverProfile: {
            select: { vehicleType: true, vehicleMake: true, vehicleModel: true, vehicleColor: true, vehiclePlate: true, rating: true, currentLat: true, currentLng: true },
          },
        },
      },
      payment: true,
      rating: true,
    },
  });
 
  if (!ride) throw new AppError('Ride not found', 404);
 
  res.status(200).json({ success: true, data: { ride } });
};

// ─── DELIVERY DETAIL + LIVE + CANCEL ─────────────────────────────────────────

exports.getDeliveryById = async (req, res) => {
  const { id } = req.params;
 
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, profileImage: true },
      },
      partner: {
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true, profileImage: true,
          deliveryProfile: {
            select: {
              vehicleType: true, vehiclePlate: true, rating: true,
              currentLat: true, currentLng: true, // live location
            },
          },
        },
      },
      payment: true,
      rating: true,
    },
  });
 
  if (!delivery) throw new AppError('Delivery not found', 404);
 
  // Build a timeline from status-change timestamps
  const timeline = [
    { event: 'Requested',   at: delivery.requestedAt,  done: !!delivery.requestedAt },
    { event: 'Assigned',    at: delivery.assignedAt,   done: !!delivery.assignedAt  },
    { event: 'Picked Up',   at: delivery.pickedUpAt,   done: !!delivery.pickedUpAt  },
    { event: 'In Transit',  at: delivery.inTransitAt,  done: !!delivery.inTransitAt },
    { event: 'Delivered',   at: delivery.deliveredAt,  done: !!delivery.deliveredAt },
  ].filter(t => t.at);
 
  res.status(200).json({ success: true, data: { delivery, timeline } });
};

exports.getLiveDeliveries = async (req, res) => {
  const deliveries = await prisma.delivery.findMany({
    where: { status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      partner: {
        select: {
          id: true, firstName: true, lastName: true, phone: true, profileImage: true,
          deliveryProfile: {
            select: { vehicleType: true, vehiclePlate: true, currentLat: true, currentLng: true },
          },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });
 
  res.status(200).json({ success: true, data: { deliveries, total: deliveries.length } });
};

exports.cancelDelivery = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const delivery = await prisma.delivery.findUnique({ where: { id } });
  if (!delivery) throw new AppError('Delivery not found', 404);
  if (['DELIVERED', 'CANCELLED'].includes(delivery.status)) {
    throw new AppError('Cannot cancel this delivery', 400);
  }

  const updated = await prisma.delivery.update({
    where: { id },
    data:  { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason || 'Cancelled by admin' },
  });

  // Notify both parties
  const notifyIds = [delivery.customerId, delivery.partnerId].filter(Boolean);
  await Promise.all(notifyIds.map(userId =>
    notificationService.notify({
      userId,
      title:   'Delivery Cancelled by Admin',
      message: `Your delivery has been cancelled by an admin.${reason ? ` Reason: ${reason}` : ''}`,
      type:    'delivery_cancelled',
      data:    { deliveryId: id, reason, cancelledBy: 'admin' },
    })
  ));

  await logActivity({
    userId: req.user.id, action: 'delivery_cancelled',
    entityType: 'Delivery', entityId: id,
    details: { reason }, req,
  });

  res.status(200).json({ success: true, message: 'Delivery cancelled', data: { delivery: updated } });
};

exports.getLiveRides = async (req, res) => {
  const rides = await prisma.ride.findMany({
    where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      driver: {
        select: {
          id: true, firstName: true, lastName: true, phone: true, profileImage: true,
          driverProfile: {
            select: {
              vehicleType: true, vehicleMake: true, vehicleModel: true,
              vehicleColor: true, vehiclePlate: true,
              currentLat: true, currentLng: true,
            },
          },
        },
      },
    },
    orderBy: { requestedAt: 'desc' },
  });

  res.status(200).json({ success: true, data: { rides, total: rides.length } });
};

exports.getAdminRideById = async (req, res) => {
  const { id } = req.params;

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, profileImage: true },
      },
      driver: {
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true, profileImage: true,
          driverProfile: {
            select: {
              vehicleType: true, vehicleMake: true, vehicleModel: true,
              vehicleColor: true, vehiclePlate: true, vehicleYear: true,
              rating: true, licenseNumber: true,
              currentLat: true, currentLng: true,
            },
          },
        },
      },
      payment: true,
      rating:  true,
    },
  });

  if (!ride) throw new AppError('Ride not found', 404);

  res.status(200).json({ success: true, data: { ride } });
};

exports.adminCancelRide = async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  const ride = await prisma.ride.findUnique({ where: { id } });
  if (!ride) throw new AppError('Ride not found', 404);
  if (['COMPLETED', 'CANCELLED'].includes(ride.status)) {
    throw new AppError('Cannot cancel a completed or already cancelled ride', 400);
  }

  const updated = await prisma.ride.update({
    where: { id },
    data:  { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason || 'Cancelled by admin' },
  });

  // Notify both parties
  const notifyIds = [ride.customerId, ride.driverId].filter(Boolean);
  await Promise.all(notifyIds.map(userId =>
    notificationService.notify({
      userId,
      title:   'Ride Cancelled by Admin',
      message: `Your ride has been cancelled by an admin.${reason ? ` Reason: ${reason}` : ''}`,
      type:    'ride_cancelled',
      data:    { rideId: id, reason, cancelledBy: 'admin' },
    })
  ));

  await logActivity({
    userId:     req.user.id,
    action:     'ride_cancelled',
    entityType: 'Ride',
    entityId:   id,
    details:    { reason },
    req,
  });

  res.status(200).json({ success: true, message: 'Ride cancelled', data: { ride: updated } });
};

// ─── CREATE ADMIN / STAFF USER (SUPER_ADMIN only) ────────────────────────────

exports.createAdminUser = async (req, res) => {
  const {
    email, phone, password, firstName, lastName,
    role, adminDepartment,
  } = req.body;
 
  // Only ADMIN, SUPPORT, MODERATOR can be created here (not CUSTOMER/DRIVER/etc.)
  const allowedRoles = ['ADMIN', 'SUPPORT', 'MODERATOR'];
  if (!allowedRoles.includes(role))
    throw new AppError(`Role must be one of: ${allowedRoles.join(', ')}`, 400);
 
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) throw new AppError('A user with this email or phone already exists', 400);
 
  const hashed = await bcrypt.hash(password, 10);
 
  const user = await prisma.user.create({
    data: {
      email, phone, firstName, lastName,
      password:        hashed,
      role,
      adminDepartment: adminDepartment ?? null,
      isVerified:      true,   // admin accounts are pre-verified
      isActive:        true,
    },
    select: {
      id: true, email: true, phone: true, firstName: true, lastName: true,
      role: true, adminDepartment: true, isActive: true, createdAt: true,
    },
  });
 
  // Create wallet
  await prisma.wallet.create({
    data: { userId: user.id, balance: 0, currency: 'NGN' },
  });
 
  await logActivity({
    userId: req.user.id,
    action: 'admin_user_created',
    entityType: 'User',
    entityId: user.id,
    details: { role, adminDepartment, createdEmail: email },
    req,
  });
 
  res.status(201).json({
    success: true,
    message: `${role} account created successfully${adminDepartment ? ` with ${adminDepartment} department access` : ''}`,
    data: { user },
  });
};

// ─── DELETE USER (SUPER_ADMIN only — soft delete) ────────────────────────────

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
 
  if (id === req.user.id)
    throw new AppError('You cannot delete your own account', 400);
 
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError('User not found', 404);
 
  // Prevent deleting other super admins
  if (user.role === 'SUPER_ADMIN')
    throw new AppError('Super admin accounts cannot be deleted', 403);
 
  // Soft delete: deactivate + anonymise PII
  const anonymisedEmail = `deleted_${id}@diakite.internal`;
  const anonymisedPhone = `+000000000000${id.slice(0, 4)}`;
 
  const deleted = await prisma.user.update({
    where: { id },
    data: {
      isActive:    false,
      isSuspended: true,
      email:       anonymisedEmail,
      phone:       anonymisedPhone,
      firstName:   'Deleted',
      lastName:    'User',
      profileImage: null,
      suspensionReason: 'Account deleted by admin',
    },
    select: { id: true, role: true, createdAt: true },
  });
 
  await logActivity({
    userId: req.user.id,
    action: 'user_deleted',
    entityType: 'User',
    entityId: id,
    details: { originalRole: user.role, originalEmail: user.email },
    req,
  });
 
  res.status(200).json({
    success: true,
    message: 'User account deleted and PII anonymised',
    data: { user: deleted },
  });
};

// ─── GET SINGLE TICKET ────────────────────────────────────────────────────────

exports.getTicketById = async (req, res) => {
  const { id } = req.params;
 
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
      },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      },
    },
  });
 
  if (!ticket) throw new AppError('Ticket not found', 404);
 
  res.status(200).json({ success: true, data: { ticket } });
};

// ─── UPDATE TICKET (with reply support) ──────────────────────────────────────

exports.updateTicket = async (req, res) => {
  const { id } = req.params;
  const { status, assignedTo, resolution, replyMessage } = req.body;
 
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Ticket not found', 404);
 
  // Update ticket fields
  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(status      && { status }),
      ...(assignedTo  && { assignedTo }),
      ...(resolution  && { resolution }),
      ...(status === 'resolved' && { resolvedAt: new Date() }),
    },
  });
 
  // Add reply if provided
  if (replyMessage?.trim()) {
    try {
      await prisma.ticketReply.create({
        data: {
          ticketId: id,
          authorId: req.user.id,
          message:  replyMessage.trim(),
          isAdmin:  true,
        },
      });
    } catch {
      // TicketReply model may not exist yet — skip gracefully
    }
 
    // Notify the ticket creator
    await notificationService.notify({
      userId:  ticket.userId,
      title:   `Update on Ticket #${ticket.ticketNumber}`,
      message: replyMessage.trim(),
      type:    'ticket_reply',
      data:    { ticketId: id, ticketNumber: ticket.ticketNumber, repliedBy: req.user.id },
    });
  }
 
  if (status === 'resolved') {
    await notificationService.notify({
      userId:  ticket.userId,
      title:   `Ticket #${ticket.ticketNumber} Resolved ✅`,
      message: `Your support ticket has been resolved.${resolution ? ` Resolution: ${resolution}` : ''}`,
      type:    'ticket_resolved',
      data:    { ticketId: id, ticketNumber: ticket.ticketNumber },
    });
  }
 
  await logActivity({
    userId: req.user.id,
    action: 'ticket_updated',
    entityType: 'SupportTicket',
    entityId: id,
    details: { status, assignedTo, hasReply: !!replyMessage },
    req,
  });
 
  res.status(200).json({ success: true, message: 'Ticket updated', data: { ticket: updated } });
};

// ─── SHIELD MONITORING ───────────────────────────────────────────────────────
 
exports.getShieldStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
 
  const [
    activeSessions,
    sessionsToday,
    alertsTriggered,
    autoTriggered,
    arrivedSafe,
  ] = await Promise.all([
    prisma.shieldSession.count({ where: { isActive: true } }),
    prisma.shieldSession.count({ where: { createdAt: { gte: today } } }),
    prisma.shieldSession.count({ where: { driverAlerted: true } }),
    prisma.shieldSession.count({ where: { autoTriggered: true, createdAt: { gte: today } } }),
    prisma.shieldSession.count({ where: { arrivedSafe: true, createdAt: { gte: today } } }),
  ]);
 
  res.status(200).json({
    success: true,
    data: {
      activeSessions,
      sessionsToday,
      alertsTriggered,
      autoTriggered,
      arrivedSafe,
    },
  });
};
 
exports.getShieldSessions = async (req, res) => {
  const { page = 1, limit = 20, isActive, autoTriggered } = req.query;
  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
 
  if (isActive !== undefined)      where.isActive      = isActive === 'true';
  if (autoTriggered !== undefined) where.autoTriggered = autoTriggered === 'true';
 
  const [sessions, total] = await Promise.all([
    prisma.shieldSession.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        ride: {
          select: {
            id: true, status: true, pickupAddress: true, dropoffAddress: true,
            driver: { select: { firstName: true, lastName: true } },
          },
        },
        delivery: {
          select: {
            id: true, status: true, pickupAddress: true, dropoffAddress: true,
            partner: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.shieldSession.count({ where }),
  ]);
 
  res.status(200).json({
    success: true,
    data: {
      sessions,
      pagination: {
        total,
        page:  parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
};
 
exports.getShieldSessionById = async (req, res) => {
  const { id } = req.params;
 
  const session = await prisma.shieldSession.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, email: true, profileImage: true,
        },
      },
      ride: {
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
          driver: {
            select: {
              firstName: true, lastName: true, phone: true,
              driverProfile: {
                select: {
                  vehicleType: true, vehicleMake: true, vehicleModel: true,
                  vehiclePlate: true, currentLat: true, currentLng: true,
                },
              },
            },
          },
        },
      },
      delivery: {
        include: {
          customer: { select: { firstName: true, lastName: true, phone: true } },
          partner: {
            select: {
              firstName: true, lastName: true, phone: true,
              deliveryProfile: {
                select: {
                  vehicleType: true, vehiclePlate: true,
                  currentLat: true, currentLng: true,
                },
              },
            },
          },
        },
      },
    },
  });
 
  if (!session) throw new AppError('SHIELD session not found', 404);
 
  res.status(200).json({ success: true, data: { session } });
};
 
exports.closeShieldSession = async (req, res) => {
  const { id } = req.params;
 
  const session = await prisma.shieldSession.findUnique({ where: { id } });
  if (!session) throw new AppError('SHIELD session not found', 404);
 
  await prisma.shieldSession.update({
    where: { id },
    data:  { isActive: false },
  });
 
  await logActivity({
    userId:     req.user.id,
    action:     'shield_session_closed',
    entityType: 'ShieldSession',
    entityId:   id,
    details:    { closedBy: req.user.id },
    req,
  });
 
  res.status(200).json({ success: true, message: 'SHIELD session closed' });
};

// ─── CORPORATE ADMIN ─────────────────────────────────────────────────────────
exports.getCompanies = async (req, res) => {
  const { page = 1, limit = 15, search, status } = req.query;
  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const where = {};

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { rcNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: {
        admin:  { select: { id: true, firstName: true, lastName: true, email: true } },
        wallet: { select: { balance: true, lowBalanceThreshold: true } },
        _count: { select: { employees: true, trips: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.company.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      companies,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

exports.getCompanyById = async (req, res) => {
  const { id } = req.params;

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      admin:  { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      wallet: {
        include: {
          transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      },
      _count: { select: { employees: true, trips: true } },
    },
  });

  if (!company) throw new AppError('Company not found', 404);

  res.status(200).json({ success: true, data: { company } });
};

exports.getCompanyEmployees = async (req, res) => {
  const { id }              = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [employees, total] = await Promise.all([
    prisma.companyEmployee.findMany({
      where: { companyId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, profileImage: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.companyEmployee.count({ where: { companyId: id } }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      employees,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

exports.getCompanyTrips = async (req, res) => {
  const { id }              = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [trips, total] = await Promise.all([
    prisma.corporateTrip.findMany({
      where: { companyId: id },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
        ride:     { select: { pickupAddress: true, dropoffAddress: true, completedAt: true, status: true } },
        delivery: { select: { pickupAddress: true, dropoffAddress: true, deliveredAt: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.corporateTrip.count({ where: { companyId: id } }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      trips,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

exports.activateCompany = async (req, res) => {
  const { id } = req.params;

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) throw new AppError('Company not found', 404);
  if (company.status === 'ACTIVE') throw new AppError('Company is already active', 400);

  const updated = await prisma.company.update({
    where: { id },
    data:  { status: 'ACTIVE' },
  });

  await notificationService.notify({
    userId:  company.adminUserId,
    title:   '🏢 Corporate Account Activated!',
    message: `Your corporate transport account for ${company.name} has been approved and activated. You can now top up your wallet and invite employees.`,
    type:    'corporate_activated',
    data:    { companyId: id },
  });

  await logActivity({
    userId:     req.user.id,
    action:     'company_activated',
    entityType: 'Company',
    entityId:   id,
    details:    { companyName: company.name },
    req,
  });

  res.status(200).json({ success: true, message: 'Company activated', data: { company: updated } });
};

exports.suspendCompany = async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) throw new AppError('Company not found', 404);
  if (company.status === 'SUSPENDED') throw new AppError('Company is already suspended', 400);

  const updated = await prisma.company.update({
    where: { id },
    data:  { status: 'SUSPENDED' },
  });

  await notificationService.notify({
    userId:  company.adminUserId,
    title:   '⚠️ Corporate Account Suspended',
    message: `Your corporate transport account has been suspended.${reason ? ` Reason: ${reason}` : ''} Contact support to resolve.`,
    type:    'corporate_suspended',
    data:    { companyId: id, reason },
  });

  await logActivity({
    userId:     req.user.id,
    action:     'company_suspended',
    entityType: 'Company',
    entityId:   id,
    details:    { reason, companyName: company.name },
    req,
  });

  res.status(200).json({ success: true, message: 'Company suspended', data: { company: updated } });
};

// ─── DUOPAY ADMIN ─────────────────────────────────────────────────────────────

exports.getDuoPayStats = async (req, res) => {
  const [
    totalAccounts,
    activeAccounts,
    suspendedAccounts,
    defaultedAccounts,
    outstandingAgg,
    overdueAgg,
  ] = await Promise.all([
    prisma.duoPayAccount.count(),
    prisma.duoPayAccount.count({ where: { status: 'ACTIVE'    } }),
    prisma.duoPayAccount.count({ where: { status: 'SUSPENDED' } }),
    prisma.duoPayAccount.count({ where: { status: 'DEFAULTED' } }),
    prisma.duoPayAccount.aggregate({ _sum: { usedBalance: true } }),
    prisma.duoPayTransaction.aggregate({
      where: { status: 'OVERDUE' },
      _sum:  { amount: true },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalAccounts,
      activeAccounts,
      suspendedAccounts,
      defaultedAccounts,
      totalOutstanding: outstandingAgg._sum.usedBalance ?? 0,
      totalOverdue:     overdueAgg._sum.amount          ?? 0,
    },
  });
};

exports.getDuoPayAccounts = async (req, res) => {
  const { page = 1, limit = 15, status } = req.query;
  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const where = status ? { status } : {};

  const [accounts, total] = await Promise.all([
    prisma.duoPayAccount.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        transactions: {
          where:   { status: { in: ['OVERDUE', 'PENDING'] } },
          orderBy: { dueDate: 'asc' },
        },
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.duoPayAccount.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      accounts,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

exports.waiveDuoPayAccount = async (req, res) => {
  const { id } = req.params;

  const account = await prisma.duoPayAccount.findUnique({
    where:   { id },
    include: { transactions: { where: { status: 'OVERDUE' } } },
  });
  if (!account) throw new AppError('DuoPay account not found', 404);

  const overdueAmount = account.transactions.reduce((s, t) => s + t.amount, 0);

  await prisma.$transaction([
    prisma.duoPayTransaction.updateMany({
      where: { duoPayAccountId: id, status: 'OVERDUE' },
      data:  { status: 'WAIVED', paidAt: new Date() },
    }),
    prisma.duoPayAccount.update({
      where: { id },
      data:  {
        status:      'ACTIVE',
        usedBalance: 0,
        suspendedAt: null,
        activatedAt: new Date(),
      },
    }),
  ]);

  await notificationService.notify({
    userId:  account.userId,
    title:   '🎁 DuoPay Balance Cleared',
    message: 'Your outstanding DuoPay balance has been waived by the Diakite team. Your account is now reactivated. Please make timely repayments going forward.',
    type:    'duopay_waived',
    data:    { accountId: id, overdueAmount },
  });

  await logActivity({
    userId:     req.user.id,
    action:     'duopay_balance_waived',
    entityType: 'DuoPayAccount',
    entityId:   id,
    details:    { overdueAmount, transactionCount: account.transactions.length },
    req,
  });

  res.status(200).json({
    success: true,
    message: `₦${overdueAmount.toLocaleString('en-NG')} in overdue balance waived. Account reactivated.`,
    data:    { overdueAmount, transactionsWaived: account.transactions.length },
  });
};

exports.waiveDuoPayTransaction = async (req, res) => {
  const { id, txId } = req.params;

  const tx = await prisma.duoPayTransaction.findUnique({ where: { id: txId } });
  if (!tx)                        throw new AppError('Transaction not found', 404);
  if (tx.duoPayAccountId !== id)  throw new AppError('Transaction does not belong to this account', 400);
  if (tx.status !== 'OVERDUE')    throw new AppError('Only OVERDUE transactions can be waived', 400);

  const account = await prisma.duoPayAccount.findUnique({ where: { id } });
  if (!account) throw new AppError('DuoPay account not found', 404);

  await prisma.$transaction([
    prisma.duoPayTransaction.update({
      where: { id: txId },
      data:  { status: 'WAIVED', paidAt: new Date() },
    }),
    prisma.duoPayAccount.update({
      where: { id },
      data:  { usedBalance: { decrement: tx.amount } },
    }),
  ]);

  const remainingOverdue = await prisma.duoPayTransaction.count({
    where: { duoPayAccountId: id, status: 'OVERDUE' },
  });

  if (remainingOverdue === 0) {
    await prisma.duoPayAccount.update({
      where: { id },
      data:  { status: 'ACTIVE', suspendedAt: null, activatedAt: new Date() },
    });
    await notificationService.notify({
      userId:  account.userId,
      title:   '✅ DuoPay Reactivated',
      message: 'Your outstanding DuoPay balance has been cleared. Your account is active again.',
      type:    'duopay_reactivated',
      data:    { accountId: id },
    });
  }

  await logActivity({
    userId:     req.user.id,
    action:     'duopay_transaction_waived',
    entityType: 'DuoPayTransaction',
    entityId:   txId,
    details:    { amount: tx.amount, accountId: id },
    req,
  });

  res.status(200).json({
    success: true,
    message: `₦${tx.amount.toLocaleString('en-NG')} transaction waived${remainingOverdue === 0 ? '. Account reactivated.' : '.'}`,
    data:    { remainingOverdue },
  });
};

exports.runDuoPayOverdueCheck = async (req, res) => {
  const { markOverdue } = require('../services/duopay.service');
  const result = await markOverdue();

  await logActivity({
    userId:     req.user.id,
    action:     'duopay_overdue_check_manual',
    entityType: 'DuoPayAccount',
    entityId:   null,
    details:    result,
    req,
  });

  res.status(200).json({
    success: true,
    message: `Overdue check complete. ${result.overdue} transactions marked overdue, ${result.suspended} accounts suspended.`,
    data:    result,
  });
};

// ─── ONBOARDING BONUS PREVIEW (dry run) ──────────────────────────────────────

exports.previewOnboardingBonuses = async (req, res) => {
  const [eligibleDrivers, eligiblePartners] = await Promise.all([
    prisma.driverProfile.findMany({
      where:   { isApproved: true },
      include: { user: { include: { wallet: { select: { balance: true } } } } },
    }),
    prisma.deliveryPartnerProfile.findMany({
      where:   { isApproved: true },
      include: { user: { include: { wallet: { select: { balance: true } } } } },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      eligibleDrivers:  eligibleDrivers.filter(d  => (d.user.wallet?.balance ?? 0) === 0).length,
      eligiblePartners: eligiblePartners.filter(p => (p.user.wallet?.balance ?? 0) === 0).length,
    },
  });
};

// APP FEEDBACK
exports.getAppFeedback = async (req, res) => {
  const { page = 1, limit = 20, rating, category } = req.query;
  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  if (rating)   where.rating   = parseInt(rating);
  if (category) where.category = category;
 
  const [feedback, total] = await Promise.all([
    prisma.appFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
      },
    }),
    prisma.appFeedback.count({ where }),
  ]);
 
  res.status(200).json({
    success: true,
    data: {
      feedback,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};
 
exports.getAppFeedbackStats = async (req, res) => {
  const [total, ratingGroups, categoryGroups, avgResult] = await Promise.all([
    prisma.appFeedback.count(),
    prisma.appFeedback.groupBy({ by: ['rating'],   _count: { rating: true }   }),
    prisma.appFeedback.groupBy({ by: ['category'], _count: { category: true } }),
    prisma.appFeedback.aggregate({ _avg: { rating: true } }),
  ]);
 
  const distribution = {};
  ratingGroups.forEach(r => { distribution[String(r.rating)] = r._count.rating; });
 
  const byCategory = {};
  categoryGroups.forEach(c => { byCategory[c.category] = c._count.category; });
 
  res.status(200).json({
    success: true,
    data: {
      total,
      averageRating: avgResult._avg.rating ?? 0,
      distribution,
      byCategory,
    },
  });
};

module.exports = exports;