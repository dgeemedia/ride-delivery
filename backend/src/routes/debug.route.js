// backend/src/routes/debug.route.js
// TEMPORARY — remove before production
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// GET /api/debug/drivers
router.get('/drivers', async (req, res) => {
  const drivers = await prisma.driverProfile.findMany({
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true }
      }
    }
  });

  res.json({
    total: drivers.length,
    drivers: drivers.map(d => ({
      name:        `${d.user.firstName} ${d.user.lastName}`,
      email:       d.user.email,
      userId:      d.user.id,
      role:        d.user.role,        // ← added
      isActive:    d.user.isActive,    // ← added
      isOnline:    d.isOnline,
      isApproved:  d.isApproved,
      currentLat:  d.currentLat,
      currentLng:  d.currentLng,
      vehicleType: d.vehicleType,
    }))
  });
});

// GET /api/debug/users — check all users and their roles
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, firstName: true, lastName: true,
      email: true, role: true, isActive: true, isSuspended: true
    }
  });
  res.json({ total: users.length, users });
});

module.exports = router;
