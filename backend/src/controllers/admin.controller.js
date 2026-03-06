const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middleware/errorHandler');
const notificationService = require('../services/notification.service');

const prisma = new PrismaClient();

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
      userAgent: req?.headers?.['user-agent'] || null
    }
  });
};

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/admin/dashboard/stats
 * @access  Private (ADMIN)
 */
exports.getDashboardStats = async (req, res) => {
  const [
    totalUsers,
    totalDrivers,
    totalPartners,
    totalRides,
    totalDeliveries,
    activeRides,
    activeDeliveries,
    todayRevenue,
    monthRevenue,
    totalWalletBalance,
    pendingDrivers,
    pendingPartners,
    openTickets
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
      _sum: { amount: true }
    }),
    prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      },
      _sum: { amount: true }
    }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.driverProfile.count({ where: { isApproved: false } }),
    prisma.deliveryPartnerProfile.count({ where: { isApproved: false } }),
    prisma.supportTicket.count({ where: { status: 'open' } })
  ]);

  res.status(200).json({
    success: true,
    data: {
      users: { total: totalUsers, drivers: totalDrivers, partners: totalPartners },
      rides: { total: totalRides, active: activeRides },
      deliveries: { total: totalDeliveries, active: activeDeliveries },
      revenue: {
        today: todayRevenue._sum.amount || 0,
        month: monthRevenue._sum.amount || 0,
        currency: 'NGN'
      },
      wallet: { totalBalance: totalWalletBalance._sum.balance || 0 },
      pending: { drivers: pendingDrivers, partners: pendingPartners },
      support: { openTickets }
    }
  });
};

// ─────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────

/**
 * @desc    Get all users with pagination and filters
 * @route   GET /api/admin/users
 * @access  Private (ADMIN)
 */
exports.getUsers = async (req, res) => {
  const { page = 1, limit = 20, role, search, isActive } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, phone: true, firstName: true, lastName: true,
        role: true, isActive: true, isSuspended: true, isVerified: true, createdAt: true,
        wallet: { select: { balance: true } }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { users, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

/**
 * @desc    Get single user detail
 * @route   GET /api/admin/users/:id
 * @access  Private (ADMIN)
 */
exports.getUserById = async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, phone: true, firstName: true, lastName: true,
      role: true, profileImage: true, isActive: true, isSuspended: true,
      isVerified: true, suspendedAt: true, suspensionReason: true, createdAt: true,
      driverProfile: true,
      deliveryProfile: true,
      wallet: { select: { balance: true, currency: true } },
      _count: {
        select: {
          customerRides: true,
          driverRides: true,
          customerDeliveries: true,
          partnerDeliveries: true,
          payments: true
        }
      }
    }
  });

  if (!user) throw new AppError('User not found', 404);

  res.status(200).json({ success: true, data: { user } });
};

/**
 * @desc    Suspend user account
 * @route   PUT /api/admin/users/:id/suspend
 * @access  Private (ADMIN)
 */
exports.suspendUser = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      isSuspended: true,
      suspendedAt: new Date(),
      suspendedBy: req.user.id,
      suspensionReason: reason || 'Suspended by admin'
    }
  });

  // Notify user
  await notificationService.notify({
    userId: id,
    title: 'Account Suspended',
    message: `Your account has been suspended. Reason: ${reason || 'Policy violation'}. Contact support to appeal.`,
    type: notificationService.TYPES.ACCOUNT_SUSPENDED,
    data: { reason, suspendedBy: req.user.id }
  });

  // Log activity
  await logActivity({
    userId: req.user.id,
    action: 'user_suspended',
    entityType: 'User',
    entityId: id,
    details: { reason },
    req
  });

  res.status(200).json({ success: true, message: 'User suspended', data: { user } });
};

/**
 * @desc    Activate user account
 * @route   PUT /api/admin/users/:id/activate
 * @access  Private (ADMIN)
 */
exports.activateUser = async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.update({
    where: { id },
    data: {
      isActive: true,
      isSuspended: false,
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null
    }
  });

  // Notify user
  await notificationService.notify({
    userId: id,
    title: 'Account Activated ✅',
    message: 'Your account has been reactivated. Welcome back!',
    type: notificationService.TYPES.ACCOUNT_ACTIVATED,
    data: {}
  });

  await logActivity({
    userId: req.user.id,
    action: 'user_activated',
    entityType: 'User',
    entityId: id,
    details: {},
    req
  });

  res.status(200).json({ success: true, message: 'User activated', data: { user } });
};

// ─────────────────────────────────────────────
// DRIVER MANAGEMENT
// ─────────────────────────────────────────────

/**
 * @desc    Get pending driver approvals
 * @route   GET /api/admin/drivers/pending
 * @access  Private (ADMIN)
 */
exports.getPendingDrivers = async (req, res) => {
  const drivers = await prisma.driverProfile.findMany({
    where: { isApproved: false },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({ success: true, data: { drivers } });
};

/**
 * @desc    Approve driver
 * @route   PUT /api/admin/drivers/:id/approve
 * @access  Private (ADMIN)
 */
exports.approveDriver = async (req, res) => {
  const { id } = req.params;

  const driver = await prisma.driverProfile.update({
    where: { id },
    data: { isApproved: true },
    include: { user: { select: { id: true, firstName: true } } }
  });

  // Notify driver
  await notificationService.notify({
    userId: driver.userId,
    title: 'Driver Application Approved! 🎉',
    message: 'Congratulations! Your driver application has been approved. You can now go online and start accepting rides.',
    type: notificationService.TYPES.DRIVER_APPROVED,
    data: { driverProfileId: id }
  });

  await logActivity({
    userId: req.user.id,
    action: 'driver_approved',
    entityType: 'DriverProfile',
    entityId: id,
    details: { driverUserId: driver.userId },
    req
  });

  res.status(200).json({ success: true, message: 'Driver approved successfully', data: { driver } });
};

/**
 * @desc    Reject driver
 * @route   PUT /api/admin/drivers/:id/reject
 * @access  Private (ADMIN)
 */
exports.rejectDriver = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const driver = await prisma.driverProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true, firstName: true } } }
  });

  if (!driver) throw new AppError('Driver profile not found', 404);

  const driverUserId = driver.userId;

  await prisma.driverProfile.delete({ where: { id } });

  // Notify driver
  await notificationService.notify({
    userId: driverUserId,
    title: 'Driver Application Not Approved',
    message: `Your driver application was not approved. Reason: ${reason || 'Does not meet requirements'}. You may reapply after resolving the issue.`,
    type: notificationService.TYPES.DRIVER_REJECTED,
    data: { reason }
  });

  await logActivity({
    userId: req.user.id,
    action: 'driver_rejected',
    entityType: 'DriverProfile',
    entityId: id,
    details: { reason, driverUserId },
    req
  });

  res.status(200).json({ success: true, message: 'Driver rejected', data: { driver } });
};

// ─────────────────────────────────────────────
// PARTNER MANAGEMENT
// ─────────────────────────────────────────────

/**
 * @desc    Get pending delivery partner approvals
 * @route   GET /api/admin/partners/pending
 * @access  Private (ADMIN)
 */
exports.getPendingPartners = async (req, res) => {
  const partners = await prisma.deliveryPartnerProfile.findMany({
    where: { isApproved: false },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({ success: true, data: { partners } });
};

/**
 * @desc    Approve delivery partner
 * @route   PUT /api/admin/partners/:id/approve
 * @access  Private (ADMIN)
 */
exports.approvePartner = async (req, res) => {
  const { id } = req.params;

  const partner = await prisma.deliveryPartnerProfile.update({
    where: { id },
    data: { isApproved: true },
    include: { user: { select: { id: true, firstName: true } } }
  });

  await notificationService.notify({
    userId: partner.userId,
    title: 'Delivery Partner Approved! 🎉',
    message: 'Your delivery partner application has been approved. You can now go online and start accepting deliveries.',
    type: notificationService.TYPES.PARTNER_APPROVED,
    data: { partnerProfileId: id }
  });

  await logActivity({
    userId: req.user.id,
    action: 'partner_approved',
    entityType: 'DeliveryPartnerProfile',
    entityId: id,
    details: { partnerUserId: partner.userId },
    req
  });

  res.status(200).json({ success: true, message: 'Partner approved', data: { partner } });
};

/**
 * @desc    Reject delivery partner
 * @route   PUT /api/admin/partners/:id/reject
 * @access  Private (ADMIN)
 */
exports.rejectPartner = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const partner = await prisma.deliveryPartnerProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true } } }
  });

  if (!partner) throw new AppError('Partner profile not found', 404);

  const partnerUserId = partner.userId;

  await prisma.deliveryPartnerProfile.delete({ where: { id } });

  await notificationService.notify({
    userId: partnerUserId,
    title: 'Delivery Partner Application Not Approved',
    message: `Your application was not approved. Reason: ${reason || 'Does not meet requirements'}. You may reapply after resolving the issue.`,
    type: notificationService.TYPES.PARTNER_REJECTED,
    data: { reason }
  });

  await logActivity({
    userId: req.user.id,
    action: 'partner_rejected',
    entityType: 'DeliveryPartnerProfile',
    entityId: id,
    details: { reason, partnerUserId },
    req
  });

  res.status(200).json({ success: true, message: 'Partner rejected' });
};

// ─────────────────────────────────────────────
// RIDE MANAGEMENT
// ─────────────────────────────────────────────

/**
 * @desc    Get all rides with filters
 * @route   GET /api/admin/rides
 * @access  Private (ADMIN)
 */
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
    if (endDate) where.requestedAt.lte = new Date(endDate);
  }

  const [rides, total] = await Promise.all([
    prisma.ride.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        driver: { select: { firstName: true, lastName: true, email: true } },
        payment: true
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { requestedAt: 'desc' }
    }),
    prisma.ride.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { rides, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

// ─────────────────────────────────────────────
// DELIVERY MANAGEMENT
// ─────────────────────────────────────────────

/**
 * @desc    Get all deliveries
 * @route   GET /api/admin/deliveries
 * @access  Private (ADMIN)
 */
exports.getDeliveries = async (req, res) => {
  const { page = 1, limit = 20, status, partnerId, customerId } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (partnerId) where.partnerId = partnerId;
  if (customerId) where.customerId = customerId;

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        partner: { select: { firstName: true, lastName: true, email: true } },
        payment: true
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { requestedAt: 'desc' }
    }),
    prisma.delivery.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { deliveries, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

// ─────────────────────────────────────────────
// PAYMENT MANAGEMENT
// ─────────────────────────────────────────────

/**
 * @desc    Get all payments
 * @route   GET /api/admin/payments
 * @access  Private (ADMIN)
 */
exports.getPayments = async (req, res) => {
  const { page = 1, limit = 20, status, method } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (method) where.method = method;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        ride: { select: { pickupAddress: true, dropoffAddress: true } },
        delivery: { select: { pickupAddress: true, dropoffAddress: true } }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.payment.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { payments, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────

/**
 * @desc    Get revenue analytics
 * @route   GET /api/admin/analytics/revenue
 * @access  Private (ADMIN)
 */
exports.getRevenueAnalytics = async (req, res) => {
  const { period = 'month' } = req.query;

  let startDate = new Date();
  if (period === 'week') startDate.setDate(startDate.getDate() - 7);
  else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
  else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);

  const payments = await prisma.payment.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: startDate } },
    select: { amount: true, createdAt: true, rideId: true, deliveryId: true, method: true },
    orderBy: { createdAt: 'asc' }
  });

  const revenueByDate = {};
  payments.forEach(payment => {
    const date = payment.createdAt.toISOString().split('T')[0];
    if (!revenueByDate[date]) {
      revenueByDate[date] = { date, total: 0, rides: 0, deliveries: 0, count: 0 };
    }
    revenueByDate[date].total += payment.amount;
    revenueByDate[date].count++;
    if (payment.rideId) revenueByDate[date].rides += payment.amount;
    if (payment.deliveryId) revenueByDate[date].deliveries += payment.amount;
  });

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const platformFee = totalRevenue * 0.20;

  const byMethod = {};
  payments.forEach(p => {
    byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
  });

  res.status(200).json({
    success: true,
    data: {
      totalRevenue,
      platformFee,
      netRevenue: totalRevenue - platformFee,
      transactionCount: payments.length,
      dailyRevenue: Object.values(revenueByDate),
      byMethod,
      period,
      currency: 'NGN'
    }
  });
};

/**
 * @desc    Get user growth analytics
 * @route   GET /api/admin/analytics/user-growth
 * @access  Private (ADMIN)
 */
exports.getUserGrowth = async (req, res) => {
  const { period = 'month' } = req.query;

  let startDate = new Date();
  if (period === 'month') startDate.setMonth(startDate.getMonth() - 6);
  else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: startDate } },
    select: { role: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  const growthByMonth = {};
  users.forEach(user => {
    const month = user.createdAt.toISOString().slice(0, 7);
    if (!growthByMonth[month]) {
      growthByMonth[month] = { month, customers: 0, drivers: 0, partners: 0, total: 0 };
    }
    growthByMonth[month].total++;
    if (user.role === 'CUSTOMER') growthByMonth[month].customers++;
    if (user.role === 'DRIVER') growthByMonth[month].drivers++;
    if (user.role === 'DELIVERY_PARTNER') growthByMonth[month].partners++;
  });

  res.status(200).json({
    success: true,
    data: { growth: Object.values(growthByMonth), totalUsers: users.length, period }
  });
};

// ─────────────────────────────────────────────
// SYSTEM SETTINGS
// ─────────────────────────────────────────────

/**
 * @desc    Get all system settings
 * @route   GET /api/admin/settings
 * @access  Private (ADMIN)
 */
exports.getSettings = async (req, res) => {
  const { category } = req.query;

  const where = category ? { category } : {};

  const settings = await prisma.systemSettings.findMany({ where });

  // Convert to key-value map for easy consumption
  const settingsMap = {};
  settings.forEach(s => {
    settingsMap[s.key] = { value: s.value, category: s.category, description: s.description };
  });

  res.status(200).json({ success: true, data: { settings: settingsMap } });
};

/**
 * @desc    Update a system setting
 * @route   PUT /api/admin/settings/:key
 * @access  Private (ADMIN)
 */
exports.updateSetting = async (req, res) => {
  const { key } = req.params;
  const { value, category, description } = req.body;

  if (value === undefined) throw new AppError('Value is required', 400);

  const setting = await prisma.systemSettings.upsert({
    where: { key },
    update: { value, updatedBy: req.user.id, ...(description && { description }) },
    create: {
      key,
      value,
      category: category || 'general',
      description,
      updatedBy: req.user.id
    }
  });

  await logActivity({
    userId: req.user.id,
    action: 'setting_updated',
    entityType: 'SystemSettings',
    entityId: setting.id,
    details: { key, value },
    req
  });

  res.status(200).json({ success: true, message: 'Setting updated', data: { setting } });
};

// ─────────────────────────────────────────────
// PROMO CODES
// ─────────────────────────────────────────────

/**
 * @desc    Get all promo codes
 * @route   GET /api/admin/promo-codes
 * @access  Private (ADMIN)
 */
exports.getPromoCodes = async (req, res) => {
  const { page = 1, limit = 20, isActive } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const [codes, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.promoCode.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { codes, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

/**
 * @desc    Create promo code
 * @route   POST /api/admin/promo-codes
 * @access  Private (ADMIN)
 */
exports.createPromoCode = async (req, res) => {
  const {
    code, description, discountType, discountValue,
    maxUses, maxUsesPerUser, minPurchaseAmount,
    validFrom, validUntil, applicableFor
  } = req.body;

  const existing = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (existing) throw new AppError('Promo code already exists', 400);

  const promo = await prisma.promoCode.create({
    data: {
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      maxUses,
      maxUsesPerUser: maxUsesPerUser || 1,
      minPurchaseAmount,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      applicableFor
    }
  });

  res.status(201).json({ success: true, message: 'Promo code created', data: { promo } });
};

/**
 * @desc    Toggle promo code active/inactive
 * @route   PUT /api/admin/promo-codes/:id/toggle
 * @access  Private (ADMIN)
 */
exports.togglePromoCode = async (req, res) => {
  const { id } = req.params;

  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) throw new AppError('Promo code not found', 404);

  const updated = await prisma.promoCode.update({
    where: { id },
    data: { isActive: !promo.isActive }
  });

  res.status(200).json({
    success: true,
    message: `Promo code ${updated.isActive ? 'activated' : 'deactivated'}`,
    data: { promo: updated }
  });
};

// ─────────────────────────────────────────────
// SUPPORT TICKETS
// ─────────────────────────────────────────────

/**
 * @desc    Get all support tickets
 * @route   GET /api/admin/tickets
 * @access  Private (ADMIN)
 */
exports.getTickets = async (req, res) => {
  const { page = 1, limit = 20, status, priority, assignedTo } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assignedTo) where.assignedTo = assignedTo;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.supportTicket.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { tickets, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

/**
 * @desc    Update ticket status
 * @route   PUT /api/admin/tickets/:id
 * @access  Private (ADMIN)
 */
exports.updateTicket = async (req, res) => {
  const { id } = req.params;
  const { status, assignedTo, resolution } = req.body;

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(resolution && { resolution }),
      ...(status === 'resolved' && { resolvedAt: new Date() })
    }
  });

  // Notify user if resolved
  if (status === 'resolved') {
    await notificationService.notify({
      userId: ticket.userId,
      title: 'Support Ticket Resolved ✅',
      message: `Your support ticket #${ticket.ticketNumber} has been resolved. Resolution: ${resolution || 'Please check your ticket for details.'}`,
      type: 'ticket_resolved',
      data: { ticketId: id, ticketNumber: ticket.ticketNumber }
    });
  }

  res.status(200).json({ success: true, message: 'Ticket updated', data: { ticket } });
};

// ─────────────────────────────────────────────
// ACTIVITY LOGS
// ─────────────────────────────────────────────

/**
 * @desc    Get activity logs
 * @route   GET /api/admin/logs
 * @access  Private (ADMIN)
 */
exports.getActivityLogs = async (req, res) => {
  const { page = 1, limit = 50, action, entityType, userId } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.activityLog.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { logs, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

// ─────────────────────────────────────────────
// WALLET MANAGEMENT
// ─────────────────────────────────────────────

/**
 * @desc    Get wallet overview
 * @route   GET /api/admin/wallets
 * @access  Private (ADMIN)
 */
exports.getWallets = async (req, res) => {
  const { page = 1, limit = 20, minBalance } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (minBalance) where.balance = { gte: parseFloat(minBalance) };

  const [wallets, total, totalBalance] = await Promise.all([
    prisma.wallet.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, role: true } }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { balance: 'desc' }
    }),
    prisma.wallet.count({ where }),
    prisma.wallet.aggregate({ _sum: { balance: true } })
  ]);

  res.status(200).json({
    success: true,
    data: {
      wallets,
      totalBalance: totalBalance._sum.balance || 0,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
    }
  });
};

/**
 * @desc    Manually credit/debit a wallet (admin action)
 * @route   POST /api/admin/wallets/:userId/adjust
 * @access  Private (ADMIN)
 */
exports.adjustWallet = async (req, res) => {
  const { userId } = req.params;
  const { amount, type, reason } = req.body; // type: 'credit' | 'debit'

  if (!amount || amount <= 0) throw new AppError('Valid amount is required', 400);
  if (!['credit', 'debit'].includes(type)) throw new AppError('Type must be credit or debit', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new AppError('Wallet not found', 404);

  if (type === 'debit' && wallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
  }

  const newBalance = type === 'credit' ? wallet.balance + amount : wallet.balance - amount;

  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: { balance: newBalance }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: type === 'credit' ? 'CREDIT' : 'DEBIT',
        amount,
        description: reason || `Admin ${type}`,
        status: 'COMPLETED',
        reference: `ADMIN-${Date.now()}`
      }
    })
  ]);

  await notificationService.notify({
    userId,
    title: type === 'credit' ? 'Wallet Credited 💰' : 'Wallet Debited',
    message: `Your wallet has been ${type}ed with ₦${amount.toFixed(2)}. ${reason ? `Reason: ${reason}` : ''}`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { amount, type, reason }
  });

  await logActivity({
    userId: req.user.id,
    action: `wallet_${type}`,
    entityType: 'Wallet',
    entityId: wallet.id,
    details: { amount, reason, targetUserId: userId },
    req
  });

  res.status(200).json({
    success: true,
    message: `Wallet ${type}ed successfully`,
    data: { wallet: updatedWallet, transaction }
  });
};

/**
 * @desc    Broadcast notification to all users
 * @route   POST /api/admin/notifications/broadcast
 * @access  Private (ADMIN)
 */
exports.broadcastNotification = async (req, res) => {
  const { title, message, type = 'admin_broadcast', role } = req.body;

  if (!title || !message) throw new AppError('Title and message are required', 400);

  const where = { isActive: true };
  if (role) where.role = role;

  const users = await prisma.user.findMany({
    where,
    select: { id: true }
  });

  // Bulk create notifications
  await prisma.notification.createMany({
    data: users.map(user => ({
      userId: user.id,
      title,
      message,
      type,
      data: { broadcast: true, sentBy: req.user.id }
    }))
  });

  // Emit via socket to all connected users
  if (notificationService._io) {
    users.forEach(user => {
      notificationService._io.to(`user:${user.id}`).emit('notification', {
        title, message, type, data: { broadcast: true }, createdAt: new Date()
      });
    });
  }

  await logActivity({
    userId: req.user.id,
    action: 'broadcast_notification',
    entityType: 'Notification',
    entityId: null,
    details: { title, message, type, recipientCount: users.length, role },
    req
  });

  res.status(200).json({
    success: true,
    message: `Notification sent to ${users.length} user(s)`,
    data: { recipientCount: users.length }
  });
};

module.exports = exports;