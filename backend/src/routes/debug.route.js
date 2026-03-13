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
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } }
    }
  });
  res.json({
    total: drivers.length,
    drivers: drivers.map(d => ({
      name: `${d.user.firstName} ${d.user.lastName}`,
      email: d.user.email,
      userId: d.user.id,
      role: d.user.role,
      isActive: d.user.isActive,
      isOnline: d.isOnline,
      isApproved: d.isApproved,
      currentLat: d.currentLat,
      currentLng: d.currentLng,
      vehicleType: d.vehicleType,
    }))
  });
});

// GET /api/debug/users
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, isSuspended: true }
  });
  res.json({ total: users.length, users });
});

// POST /api/debug/force-online
// Body: { "userId": "...", "lat": 6.54, "lng": 3.07 }
router.post('/force-online', async (req, res) => {
  const { userId, lat, lng } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const updated = await prisma.driverProfile.update({
      where: { userId },
      data: {
        isOnline: true,
        currentLat: lat ?? 6.5411374,
        currentLng: lng ?? 3.0710882,
      }
    });
    res.json({ success: true, isOnline: updated.isOnline, currentLat: updated.currentLat, currentLng: updated.currentLng });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/debug/force-offline  
// Body: { "userId": "..." }
router.post('/force-offline', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    await prisma.driverProfile.update({ where: { userId }, data: { isOnline: false } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// GET /api/debug/active-rides — see what rides are stuck
router.get('/active-rides', async (req, res) => {
  const rides = await prisma.ride.findMany({
    where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS'] } },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      driver:   { select: { firstName: true, lastName: true, email: true } },
    }
  });
  res.json({ total: rides.length, rides });
});

// POST /api/debug/cancel-ride — force cancel a stuck ride
// Body: { "rideId": "..." }
router.post('/cancel-ride', async (req, res) => {
  const { rideId } = req.body;
  if (!rideId) return res.status(400).json({ error: 'rideId required' });
  try {
    await prisma.ride.update({
      where: { id: rideId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Debug: force cancelled' }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
