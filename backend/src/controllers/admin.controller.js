const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

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
  ] = await Promise.all([
    // Total users
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    
    // Total drivers
    prisma.user.count({ where: { role: 'DRIVER' } }),
    
    // Total partners
    prisma.user.count({ where: { role: 'DELIVERY_PARTNER' } }),
    
    // Total rides
    prisma.ride.count({ where: { status: 'COMPLETED' } }),
    
    // Total deliveries
    prisma.delivery.count({ where: { status: 'DELIVERED' } }),
    
    // Active rides
    prisma.ride.count({
      where: {
        status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] }
      }
    }),
    
    // Active deliveries
    prisma.delivery.count({
      where: {
        status: { in: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
      }
    }),
    
    // Today's revenue
    prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      },
      _sum: { amount: true }
    }),
    
    // This month's revenue
    prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      },
      _sum: { amount: true }
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        drivers: totalDrivers,
        partners: totalPartners,
      },
      rides: {
        total: totalRides,
        active: activeRides,
      },
      deliveries: {
        total: totalDeliveries,
        active: activeDeliveries,
      },
      revenue: {
        today: todayRevenue._sum.amount || 0,
        month: monthRevenue._sum.amount || 0,
      }
    }
  });
};

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
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    }
  });
};

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
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          createdAt: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  res.status(200).json({
    success: true,
    data: { drivers }
  });
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
    data: { isApproved: true }
  });

  // FUTURE: Send notification to driver
  
  res.status(200).json({
    success: true,
    message: 'Driver approved successfully',
    data: { driver }
  });
};

/**
 * @desc    Reject driver
 * @route   PUT /api/admin/drivers/:id/reject
 * @access  Private (ADMIN)
 */
exports.rejectDriver = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const driver = await prisma.driverProfile.delete({
    where: { id }
  });

  // FUTURE: Send rejection notification with reason

  res.status(200).json({
    success: true,
    message: 'Driver rejected',
    data: { driver }
  });
};

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
        customer: {
          select: { firstName: true, lastName: true, email: true }
        },
        driver: {
          select: { firstName: true, lastName: true, email: true }
        },
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
    data: {
      rides,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    }
  });
};

/**
 * @desc    Get revenue analytics
 * @route   GET /api/admin/analytics/revenue
 * @access  Private (ADMIN)
 */
exports.getRevenueAnalytics = async (req, res) => {
  const { period = 'month' } = req.query;

  let startDate = new Date();
  if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  } else if (period === 'year') {
    startDate.setFullYear(startDate.getFullYear() - 1);
  }

  const payments = await prisma.payment.findMany({
    where: {
      status: 'COMPLETED',
      createdAt: { gte: startDate }
    },
    select: {
      amount: true,
      createdAt: true,
      rideId: true,
      deliveryId: true
    },
    orderBy: { createdAt: 'asc' }
  });

  // Group by date
  const revenueByDate = {};
  payments.forEach(payment => {
    const date = payment.createdAt.toISOString().split('T')[0];
    if (!revenueByDate[date]) {
      revenueByDate[date] = {
        date,
        total: 0,
        rides: 0,
        deliveries: 0,
        count: 0
      };
    }
    revenueByDate[date].total += payment.amount;
    revenueByDate[date].count++;
    if (payment.rideId) revenueByDate[date].rides += payment.amount;
    if (payment.deliveryId) revenueByDate[date].deliveries += payment.amount;
  });

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const platformFee = totalRevenue * 0.20; // 20% commission

  res.status(200).json({
    success: true,
    data: {
      totalRevenue,
      platformFee,
      netRevenue: totalRevenue - platformFee,
      transactionCount: payments.length,
      dailyRevenue: Object.values(revenueByDate),
      period
    }
  });
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
    data: { isActive: false }
  });

  // FUTURE: Log suspension reason and notify user

  res.status(200).json({
    success: true,
    message: 'User suspended',
    data: { user }
  });
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
    data: { isActive: true }
  });

  res.status(200).json({
    success: true,
    message: 'User activated',
    data: { user }
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
  if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 6);
  } else if (period === 'year') {
    startDate.setFullYear(startDate.getFullYear() - 1);
  }

  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: startDate }
    },
    select: {
      role: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  // Group by month
  const growthByMonth = {};
  users.forEach(user => {
    const month = user.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!growthByMonth[month]) {
      growthByMonth[month] = {
        month,
        customers: 0,
        drivers: 0,
        partners: 0,
        total: 0
      };
    }
    growthByMonth[month].total++;
    if (user.role === 'CUSTOMER') growthByMonth[month].customers++;
    if (user.role === 'DRIVER') growthByMonth[month].drivers++;
    if (user.role === 'DELIVERY_PARTNER') growthByMonth[month].partners++;
  });

  res.status(200).json({
    success: true,
    data: {
      growth: Object.values(growthByMonth),
      totalUsers: users.length,
      period
    }
  });
};

module.exports = exports;