// backend/src/controllers/call.controller.js
const prisma = require('../lib/prisma');
const { AppError } = require('../middleware/errorHandler');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const APP_ID        = process.env.AGORA_APP_ID;
const APP_CERT      = process.env.AGORA_APP_CERTIFICATE;
const TOKEN_EXPIRY  = 3600; // 1 hour

/**
 * @desc    Generate Agora RTC token for a call
 * @route   POST /api/calls/token
 * @access  Private
 *
 * Call channel naming convention:
 *   ride_<rideId>   — for ride-based calls
 *   delivery_<deliveryId> — for delivery-based calls
 */
exports.getCallToken = async (req, res) => {
  const { channelName, uid = 0 } = req.body;

  if (!channelName) throw new AppError('Channel name is required', 400);
  if (!APP_ID || !APP_CERT) {
    throw new AppError('Agora credentials not configured on server', 500);
  }

  // Determine the other party exists and is allowed in this channel
  const [type, entityId] = channelName.split('_');

  if (type === 'ride') {
    const ride = await prisma.ride.findUnique({ where: { id: entityId } });
    if (!ride) throw new AppError('Ride not found', 404);
    const allowed = [ride.customerId, ride.driverId].includes(req.user.id);
    if (!allowed) throw new AppError('Not authorised for this call', 403);
  } else if (type === 'delivery') {
    const delivery = await prisma.delivery.findUnique({ where: { id: entityId } });
    if (!delivery) throw new AppError('Delivery not found', 404);
    const allowed = [delivery.customerId, delivery.partnerId].includes(req.user.id);
    if (!allowed) throw new AppError('Not authorised for this call', 403);
  }

  const expireAt = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY;
  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERT,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireAt,
    expireAt
  );

  res.status(200).json({
    success: true,
    data: { token, channelName, appId: APP_ID, uid, expireAt }
  });
};

/**
 * @desc    Initiate a call (sends socket signal to other party)
 * @route   POST /api/calls/initiate
 * @access  Private
 */
exports.initiateCall = async (req, res) => {
  const { targetUserId, channelName, callType = 'voice' } = req.body;
  // callType: 'voice' | 'video'

  if (!targetUserId || !channelName) {
    throw new AppError('targetUserId and channelName are required', 400);
  }

  const caller = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, firstName: true, lastName: true, profileImage: true, role: true }
  });

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || !target.isActive) throw new AppError('User not available', 404);

  // The socket emit is handled by the mobile client after receiving the token.
  // This endpoint just validates and logs the call intent.
  res.status(200).json({
    success: true,
    data: {
      channelName,
      callType,
      caller: {
        id: caller.id,
        name: `${caller.firstName} ${caller.lastName}`,
        profileImage: caller.profileImage,
        role: caller.role
      }
    }
  });
};

/**
 * @desc    Get nearest online drivers/partners to a location
 * @route   GET /api/calls/nearest
 * @access  Private (CUSTOMER)
 */
exports.getNearestProviders = async (req, res) => {
  const { lat, lng, type = 'driver', limit = 5 } = req.query;

  if (!lat || !lng) throw new AppError('lat and lng are required', 400);

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  let providers = [];

  if (type === 'driver') {
    const drivers = await prisma.driverProfile.findMany({
      where: { isOnline: true, isApproved: true,
        currentLat: { not: null }, currentLng: { not: null } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profileImage: true } }
      },
      take: 20
    });

    providers = drivers
      .map(d => ({
        userId: d.userId,
        name: `${d.user.firstName} ${d.user.lastName}`,
        profileImage: d.user.profileImage,
        vehicleType: d.vehicleType,
        vehiclePlate: d.vehiclePlate,
        vehicleColor: d.vehicleColor,
        rating: d.rating,
        lat: d.currentLat,
        lng: d.currentLng,
        distance: haversine(userLat, userLng, d.currentLat, d.currentLng),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parseInt(limit));

  } else if (type === 'partner') {
    const partners = await prisma.deliveryPartnerProfile.findMany({
      where: { isOnline: true, isApproved: true,
        currentLat: { not: null }, currentLng: { not: null } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profileImage: true } }
      },
      take: 20
    });

    providers = partners
      .map(p => ({
        userId: p.userId,
        name: `${p.user.firstName} ${p.user.lastName}`,
        profileImage: p.user.profileImage,
        vehicleType: p.vehicleType,
        vehiclePlate: p.vehiclePlate,
        rating: p.rating,
        lat: p.currentLat,
        lng: p.currentLng,
        distance: haversine(userLat, userLng, p.currentLat, p.currentLng),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, parseInt(limit));
  }

  res.status(200).json({ success: true, data: { providers, userLocation: { lat: userLat, lng: userLng } } });
};

// ─── Haversine distance in km ─────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function deg2rad(d) { return d * (Math.PI / 180); }

module.exports = exports;