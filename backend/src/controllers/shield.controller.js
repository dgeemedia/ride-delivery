// backend/src/controllers/shield.controller.js
//
// SHIELD — Safety guardian feature.
//
// Public routes (no auth):
//   GET  /api/shield/view/:token       — beneficiary web view data
//   POST /api/shield/view/:token/ping  — beneficiary heartbeat (keeps session alive)
//   POST /api/shield/view/:token/alert — beneficiary sends alert to driver
//
// Private routes (auth required):
//   GET    /api/shield/beneficiaries            — list saved beneficiaries
//   POST   /api/shield/beneficiaries            — add beneficiary
//   PUT    /api/shield/beneficiaries/:id        — update beneficiary
//   DELETE /api/shield/beneficiaries/:id        — remove beneficiary
//   POST   /api/shield/activate                 — activate SHIELD for active ride/delivery
//   POST   /api/shield/deactivate               — deactivate (customer ended early)
//   POST   /api/shield/arrived-safe             — customer marks themselves safe
//   GET    /api/shield/session                  — get active session for current ride

'use strict';

const { validationResult } = require('express-validator');
const { AppError }         = require('../middleware/errorHandler');
const prisma               = require('../lib/prisma');
const shieldService        = require('../services/shield.service');
const notificationService  = require('../services/notification.service');
const { logger }           = require('../utils/logger');

const getIO = (req) => req.app.get('io');

// ─────────────────────────────────────────────────────────────────────────────
// BENEFICIARY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/shield/beneficiaries
 */
exports.listBeneficiaries = async (req, res) => {
  const beneficiaries = await prisma.shieldBeneficiary.findMany({
    where:   { userId: req.user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  res.status(200).json({ success: true, data: { beneficiaries } });
};

/**
 * POST /api/shield/beneficiaries
 */
exports.addBeneficiary = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, phone, email, isDefault = false } = req.body;

  const count = await prisma.shieldBeneficiary.count({ where: { userId: req.user.id } });
  if (count >= 5) throw new AppError('Maximum 5 beneficiaries allowed', 400);

  // Only one default allowed — unset others if this one is default
  if (isDefault) {
    await prisma.shieldBeneficiary.updateMany({
      where: { userId: req.user.id, isDefault: true },
      data:  { isDefault: false },
    });
  }

  const beneficiary = await prisma.shieldBeneficiary.create({
    data: { userId: req.user.id, name, phone, email: email || null, isDefault },
  });

  res.status(201).json({
    success: true,
    message: 'Beneficiary added successfully',
    data:    { beneficiary },
  });
};

/**
 * PUT /api/shield/beneficiaries/:id
 */
exports.updateBeneficiary = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { id }                              = req.params;
  const { name, phone, email, isDefault }   = req.body;

  const existing = await prisma.shieldBeneficiary.findUnique({ where: { id } });
  if (!existing)                        throw new AppError('Beneficiary not found', 404);
  if (existing.userId !== req.user.id)  throw new AppError('Unauthorized', 403);

  if (isDefault) {
    await prisma.shieldBeneficiary.updateMany({
      where: { userId: req.user.id, isDefault: true, id: { not: id } },
      data:  { isDefault: false },
    });
  }

  const beneficiary = await prisma.shieldBeneficiary.update({
    where: { id },
    data:  {
      ...(name      !== undefined && { name }),
      ...(phone     !== undefined && { phone }),
      ...(email     !== undefined && { email: email || null }),
      ...(isDefault !== undefined && { isDefault }),
    },
  });

  res.status(200).json({ success: true, message: 'Beneficiary updated', data: { beneficiary } });
};

/**
 * DELETE /api/shield/beneficiaries/:id
 */
exports.deleteBeneficiary = async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.shieldBeneficiary.findUnique({ where: { id } });
  if (!existing)                       throw new AppError('Beneficiary not found', 404);
  if (existing.userId !== req.user.id) throw new AppError('Unauthorized', 403);

  await prisma.shieldBeneficiary.delete({ where: { id } });

  res.status(200).json({ success: true, message: 'Beneficiary removed' });
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSION MANAGEMENT (authenticated customer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/shield/activate
 * Body: { rideId?, deliveryId?, beneficiaryId?, beneficiaryName?, beneficiaryPhone?, beneficiaryEmail? }
 *
 * Either pass a saved beneficiaryId, or pass name+phone inline (one-off share).
 */
exports.activateShield = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const {
    rideId, deliveryId,
    beneficiaryId,
    beneficiaryName, beneficiaryPhone, beneficiaryEmail,
  } = req.body;

  if (!rideId && !deliveryId) throw new AppError('rideId or deliveryId required', 400);

  // Verify the ride/delivery belongs to this customer
  if (rideId) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride)                           throw new AppError('Ride not found', 404);
    if (ride.customerId !== req.user.id) throw new AppError('Unauthorized', 403);
    if (['COMPLETED', 'CANCELLED'].includes(ride.status))
      throw new AppError('Cannot activate SHIELD on a completed or cancelled ride', 400);
  }

  if (deliveryId) {
    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery)                            throw new AppError('Delivery not found', 404);
    if (delivery.customerId !== req.user.id)  throw new AppError('Unauthorized', 403);
    if (['DELIVERED', 'CANCELLED'].includes(delivery.status))
      throw new AppError('Cannot activate SHIELD on a completed or cancelled delivery', 400);
  }

  // Resolve beneficiary details
  let bName  = beneficiaryName;
  let bPhone = beneficiaryPhone;
  let bEmail = beneficiaryEmail;

  if (beneficiaryId) {
    const saved = await prisma.shieldBeneficiary.findUnique({ where: { id: beneficiaryId } });
    if (!saved || saved.userId !== req.user.id) throw new AppError('Beneficiary not found', 404);
    bName  = saved.name;
    bPhone = saved.phone;
    bEmail = saved.email;
  }

  if (!bName || !bPhone) throw new AppError('Beneficiary name and phone are required', 400);

  const result = await shieldService.createSession({
    userId:           req.user.id,
    rideId:           rideId     || undefined,
    deliveryId:       deliveryId || undefined,
    beneficiaryName:  bName,
    beneficiaryPhone: bPhone,
    beneficiaryEmail: bEmail,
    autoTriggered:    false,
  });

  // Emit to the ride/delivery room so the driver's app can show the SHIELD badge
  const io = getIO(req);
  if (io) {
    const room = rideId ? `ride:${rideId}` : `delivery:${deliveryId}`;
    io.to(room).emit('shield:activated', {
      sessionId:       result.session.id,
      beneficiaryName: bName,
    });
  }

  logger.info(`[SHIELD] Activated by user=${req.user.id} ride=${rideId ?? '-'} delivery=${deliveryId ?? '-'}`);

  res.status(201).json({
    success:  true,
    message:  `SHIELD activated. Share the link with ${bName}.`,
    data: {
      session:       result.session,
      viewUrl:       result.viewUrl,
      whatsappLink:  result.whatsappLink,
      smsMessage:    result.smsMessage,
    },
  });
};

/**
 * POST /api/shield/deactivate
 * Body: { rideId?, deliveryId? }
 */
exports.deactivateShield = async (req, res) => {
  const { rideId, deliveryId } = req.body;
  if (!rideId && !deliveryId) throw new AppError('rideId or deliveryId required', 400);

  if (rideId)     await shieldService.closeSessionsForRide(rideId);
  if (deliveryId) await shieldService.closeSessionsForDelivery(deliveryId);

  const io = getIO(req);
  if (io) {
    const room = rideId ? `ride:${rideId}` : `delivery:${deliveryId}`;
    io.to(room).emit('shield:deactivated', { rideId, deliveryId });
  }

  res.status(200).json({ success: true, message: 'SHIELD deactivated' });
};

/**
 * POST /api/shield/arrived-safe
 * Body: { rideId?, deliveryId? }
 * Customer taps "I'm safe" at destination — notifies guardian.
 */
exports.arrivedSafe = async (req, res) => {
  const { rideId, deliveryId } = req.body;
  if (!rideId && !deliveryId) throw new AppError('rideId or deliveryId required', 400);

  const session = await prisma.shieldSession.findFirst({
    where: {
      isActive: true,
      ...(rideId     && { rideId }),
      ...(deliveryId && { deliveryId }),
      userId: req.user.id,
    },
  });

  if (!session) throw new AppError('No active SHIELD session found', 404);

  await shieldService.markArrivedSafe(session.token);

  // Broadcast "arrived safe" to beneficiary's browser tab via shield room
  const io = getIO(req);
  if (io) {
    io.to(`shield:${session.token}`).emit('shield:arrived_safe', {
      customerName: `${req.user.firstName} ${req.user.lastName}`,
      timestamp:    new Date(),
    });
  }

  res.status(200).json({ success: true, message: 'Safety confirmed. Guardian notified.' });
};

/**
 * GET /api/shield/session?rideId=&deliveryId=
 * Returns the active session for the customer's current ride/delivery.
 */
exports.getActiveSession = async (req, res) => {
  const { rideId, deliveryId } = req.query;

  const session = await prisma.shieldSession.findFirst({
    where: {
      userId:   req.user.id,
      isActive: true,
      ...(rideId     && { rideId }),
      ...(deliveryId && { deliveryId }),
    },
  });

  if (!session) return res.status(200).json({ success: true, data: { session: null } });

  const viewUrl     = shieldService.buildViewUrl(session.token);
  const whatsappLink = shieldService.buildWhatsAppLink(
    session.beneficiaryPhone,
    `🛡️ Track my ride live: ${viewUrl}`
  );

  res.status(200).json({ success: true, data: { session, viewUrl, whatsappLink } });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC BENEFICIARY ENDPOINTS (no auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/shield/view/:token
 * Called by the beneficiary's browser — returns safe ride info.
 */
exports.getSessionView = async (req, res) => {
  const { token } = req.params;

  const session = await shieldService.getSessionByToken(token);

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'This SHIELD link has expired or is no longer active.',
    });
  }

  // Shape the response — never expose customer phone/email
  const ride     = session.ride;
  const delivery = session.delivery;

  const response = {
    sessionId:       session.id,
    beneficiaryName: session.beneficiaryName,
    arrivedSafe:     session.arrivedSafe,
    autoTriggered:   session.autoTriggered,
    createdAt:       session.createdAt,
    expiresAt:       session.expiresAt,
  };

  if (ride) {
    response.type = 'RIDE';
    response.customer = {
      firstName:    ride.customer.firstName,
      profileImage: ride.customer.profileImage,
    };
    response.driver = ride.driver ? {
      firstName:    ride.driver.firstName,
      lastName:     ride.driver.lastName,
      profileImage: ride.driver.profileImage,
      vehicleType:  ride.driver.driverProfile?.vehicleType,
      vehicleMake:  ride.driver.driverProfile?.vehicleMake,
      vehicleModel: ride.driver.driverProfile?.vehicleModel,
      vehicleColor: ride.driver.driverProfile?.vehicleColor,
      vehiclePlate: ride.driver.driverProfile?.vehiclePlate,
      rating:       ride.driver.driverProfile?.rating,
      currentLat:   ride.driver.driverProfile?.currentLat,
      currentLng:   ride.driver.driverProfile?.currentLng,
    } : null;
    response.pickupAddress  = ride.pickupAddress;
    response.dropoffAddress = ride.dropoffAddress;
    response.status         = ride.status;
    response.requestedAt    = ride.requestedAt;
  }

  if (delivery) {
    response.type = 'DELIVERY';
    response.customer = {
      firstName:    delivery.customer.firstName,
      profileImage: delivery.customer.profileImage,
    };
    response.partner = delivery.partner ? {
      firstName:    delivery.partner.firstName,
      lastName:     delivery.partner.lastName,
      profileImage: delivery.partner.profileImage,
      vehicleType:  delivery.partner.deliveryProfile?.vehicleType,
      vehiclePlate: delivery.partner.deliveryProfile?.vehiclePlate,
      rating:       delivery.partner.deliveryProfile?.rating,
      currentLat:   delivery.partner.deliveryProfile?.currentLat,
      currentLng:   delivery.partner.deliveryProfile?.currentLng,
    } : null;
    response.pickupAddress  = delivery.pickupAddress;
    response.dropoffAddress = delivery.dropoffAddress;
    response.status         = delivery.status;
    response.requestedAt    = delivery.requestedAt;
  }

  res.status(200).json({ success: true, data: response });
};

/**
 * POST /api/shield/view/:token/ping
 * Beneficiary heartbeat — keeps the session from being gc'd, updates lastPingAt.
 */
exports.pingSession = async (req, res) => {
  const { token } = req.params;

  const session = await prisma.shieldSession.findUnique({ where: { token } });
  if (!session || !session.isActive) {
    return res.status(404).json({ success: false, message: 'Session not found or expired' });
  }

  await prisma.shieldSession.update({
    where: { token },
    data:  { lastPingAt: new Date() },
  });

  res.status(200).json({ success: true });
};

/**
 * POST /api/shield/view/:token/alert
 * Beneficiary hits the "Check on passenger" button.
 * Sends a push notification to the driver.
 */
exports.beneficiaryAlert = async (req, res) => {
  const { token } = req.params;

  const session = await prisma.shieldSession.findUnique({
    where:   { token },
    include: {
      ride:     { include: { driver:   { select: { id: true, firstName: true } } } },
      delivery: { include: { partner:  { select: { id: true, firstName: true } } } },
    },
  });

  if (!session || !session.isActive) {
    return res.status(404).json({ success: false, message: 'Session not found or expired' });
  }

  if (session.driverAlerted) {
    return res.status(429).json({
      success: false,
      message: 'An alert was already sent. Please wait before sending another.',
    });
  }

  const driverOrPartner = session.ride?.driver ?? session.delivery?.partner;

  if (driverOrPartner?.id) {
    await notificationService.notify({
      userId:  driverOrPartner.id,
      title:   '🛡️ SHIELD Safety Check',
      message: `${session.beneficiaryName} is checking on your passenger. Please confirm all is well.`,
      type:    'shield_beneficiary_alert',
      data:    { sessionId: session.id, token },
    });

    // Emit socket event so driver sees an in-app popup immediately
    const io = req.app.get('io');
    if (io && driverOrPartner.id) {
      io.to(`user:${driverOrPartner.id}`).emit('shield:safety_check', {
        fromBeneficiary: session.beneficiaryName,
        sessionId:       session.id,
      });
    }
  }

  // Mark as alerted to prevent spam (rate-limit: 1 alert per session)
  await prisma.shieldSession.update({
    where: { token },
    data:  { driverAlerted: true },
  });

  res.status(200).json({
    success: true,
    message: 'Alert sent to driver. They have been asked to confirm all is well.',
  });
};

/**
 * POST /api/shield/driver/confirm-safe
 * Driver/partner responds to safety check — broadcasts "all good" to beneficiary.
 * Body: { sessionId }
 */
exports.driverConfirmSafe = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) throw new AppError('sessionId required', 400);

  const session = await prisma.shieldSession.findUnique({ where: { id: sessionId } });
  if (!session || !session.isActive) throw new AppError('Session not found', 404);

  const io = getIO(req);
  if (io) {
    io.to(`shield:${session.token}`).emit('shield:driver_confirmed_safe', {
      confirmedBy: `${req.user.firstName} ${req.user.lastName}`,
      timestamp:   new Date(),
    });
  }

  // Reset the alerted flag so beneficiary can send one more if needed
  await prisma.shieldSession.update({
    where: { id: sessionId },
    data:  { driverAlerted: false },
  });

  res.status(200).json({ success: true, message: 'Confirmed. Guardian has been notified.' });
};

module.exports = exports;