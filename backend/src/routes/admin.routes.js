const express = require('express');
const { body, param, query } = require('express-validator');
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication and ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * Dashboard
 */
router.get('/dashboard/stats', adminController.getDashboardStats);

/**
 * User Management
 */
router.get('/users', adminController.getUsers);
router.put('/users/:id/suspend', 
  param('id').isUUID(),
  body('reason').optional().isString(),
  adminController.suspendUser
);
router.put('/users/:id/activate', 
  param('id').isUUID(),
  adminController.activateUser
);

/**
 * Driver Management
 */
router.get('/drivers/pending', adminController.getPendingDrivers);
router.put('/drivers/:id/approve', 
  param('id').isUUID(),
  adminController.approveDriver
);
router.put('/drivers/:id/reject', 
  param('id').isUUID(),
  body('reason').notEmpty(),
  adminController.rejectDriver
);

/**
 * Partner Management  
 */
router.get('/partners/pending', async (req, res) => {
  // Similar to getPendingDrivers but for delivery partners
  const partners = await prisma.deliveryPartnerProfile.findMany({
    where: { isApproved: false },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        }
      }
    }
  });
  
  res.status(200).json({
    success: true,
    data: { partners }
  });
});

router.put('/partners/:id/approve',
  param('id').isUUID(),
  async (req, res) => {
    const { id } = req.params;
    const partner = await prisma.deliveryPartnerProfile.update({
      where: { id },
      data: { isApproved: true }
    });
    
    res.status(200).json({
      success: true,
      message: 'Partner approved',
      data: { partner }
    });
  }
);

/**
 * Ride Management
 */
router.get('/rides', adminController.getRides);

/**
 * Delivery Management
 */
router.get('/deliveries', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  
  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      include: {
        customer: {
          select: { firstName: true, lastName: true, email: true }
        },
        partner: {
          select: { firstName: true, lastName: true, email: true }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { requestedAt: 'desc' }
    }),
    prisma.delivery.count()
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      deliveries,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * Payment Management
 */
router.get('/payments', async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const skip = (page - 1) * limit;
  
  const where = status ? { status } : {};
  
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        },
        ride: {
          select: { pickupAddress: true, dropoffAddress: true }
        },
        delivery: {
          select: { pickupAddress: true, dropoffAddress: true }
        }
      },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.payment.count({ where })
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      payments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * Analytics
 */
router.get('/analytics/revenue', adminController.getRevenueAnalytics);
router.get('/analytics/user-growth', adminController.getUserGrowth);

/**
 * Settings
 */
router.get('/settings', async (req, res) => {
  // Return platform settings
  res.status(200).json({
    success: true,
    data: {
      platformName: 'DuoRide',
      baseFare: 5.0,
      perKmRate: 2.5,
      platformCommission: 0.20,
      // ... other settings
    }
  });
});

router.put('/settings', 
  body('baseFare').optional().isFloat({ min: 0 }),
  body('perKmRate').optional().isFloat({ min: 0 }),
  body('platformCommission').optional().isFloat({ min: 0, max: 1 }),
  async (req, res) => {
    // Update platform settings (store in database or config)
    res.status(200).json({
      success: true,
      message: 'Settings updated'
    });
  }
);

module.exports = router;