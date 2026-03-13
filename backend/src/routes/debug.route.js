// backend/src/routes/debug.route.js
// TEMPORARY — remove before production
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

// GET /api/debug/drivers
// Returns all driver profiles so we can see their online status + location
router.get('/drivers', async (req, res) => {
  const drivers = await prisma.driverProfile.findMany({
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true }
      }
    }
  });

  res.json({
    total: drivers.length,
    drivers: drivers.map(d => ({
      name:       `${d.user.firstName} ${d.user.lastName}`,
      email:      d.user.email,
      userId:     d.user.id,
      isOnline:   d.isOnline,
      isApproved: d.isApproved,
      currentLat: d.currentLat,
      currentLng: d.currentLng,
      vehicleType: d.vehicleType,
    }))
  });
});

module.exports = router;
