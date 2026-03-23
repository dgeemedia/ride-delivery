// backend/src/controllers/corporate.controller.js
'use strict';

const { validationResult } = require('express-validator');
const { AppError }         = require('../middleware/errorHandler');
const prisma               = require('../lib/prisma');
const corporateService     = require('../services/corporate.service');
const notificationService  = require('../services/notification.service');

// ── Company registration ──────────────────────────────────────────────────────

/**
 * POST /api/corporate/register
 * Any customer can register a company (becomes the admin).
 */
exports.registerCompany = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, rcNumber, email, phone, address, billingType } = req.body;

  // One company per user
  const existing = await prisma.company.findUnique({ where: { adminUserId: req.user.id } });
  if (existing) throw new AppError('You already have a corporate account', 400);

  const company = await corporateService.registerCompany({
    adminUserId: req.user.id,
    name, rcNumber, email, phone, address, billingType,
  });

  res.status(201).json({
    success: true,
    message: 'Corporate account submitted for review. You will be notified within 24 hours.',
    data:    { company },
  });
};

/**
 * GET /api/corporate/profile
 */
exports.getCompanyProfile = async (req, res) => {
  const company = await prisma.company.findUnique({
    where:   { adminUserId: req.user.id },
    include: {
      wallet: true,
      _count: { select: { employees: true, trips: true } },
    },
  });
  if (!company) throw new AppError('No corporate account found', 404);
  res.status(200).json({ success: true, data: { company } });
};

/**
 * PUT /api/corporate/profile
 */
exports.updateCompanyProfile = async (req, res) => {
  const { name, email, phone, address, logoUrl } = req.body;

  const company = await prisma.company.findUnique({ where: { adminUserId: req.user.id } });
  if (!company) throw new AppError('No corporate account found', 404);

  const updated = await prisma.company.update({
    where: { id: company.id },
    data:  {
      ...(name    && { name }),
      ...(email   && { email }),
      ...(phone   && { phone }),
      ...(address && { address }),
      ...(logoUrl && { logoUrl }),
    },
  });

  res.status(200).json({ success: true, message: 'Profile updated', data: { company: updated } });
};

// ── Wallet ────────────────────────────────────────────────────────────────────

/**
 * POST /api/corporate/wallet/topup
 * Initialise a Paystack payment for the top-up.
 * On payment success the webhook calls /verify which calls topUpCompanyWallet.
 */
exports.initiateTopUp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount } = req.body;

  const company = await prisma.company.findUnique({
    where:   { adminUserId: req.user.id },
    include: { wallet: true },
  });
  if (!company) throw new AppError('No corporate account found', 404);
  if (company.status !== 'ACTIVE') throw new AppError('Corporate account is not yet active', 400);

  if (amount < corporateService.ONBOARDING_FEE && !company.onboardingFeePaid) {
    throw new AppError(`First top-up must include ₦${corporateService.ONBOARDING_FEE.toLocaleString('en-NG')} onboarding fee`, 400);
  }

  // We return the amount so the frontend can initialise Paystack inline
  const reference = `CORP-TOPUP-${company.id}-${Date.now()}`;

  res.status(200).json({
    success: true,
    data: {
      reference,
      amount,
      email:     req.user.email,
      companyId: company.id,
      message:   'Use this reference to initialise Paystack payment',
    },
  });
};

/**
 * POST /api/corporate/wallet/verify
 * Called after Paystack payment succeeds (from mobile Paystack SDK callback).
 */
exports.verifyTopUp = async (req, res) => {
  const { reference, amount } = req.body;
  if (!reference) throw new AppError('Payment reference required', 400);

  const company = await prisma.company.findUnique({
    where:   { adminUserId: req.user.id },
    include: { wallet: true },
  });
  if (!company) throw new AppError('No corporate account found', 404);

  // In production: verify with Paystack API first
  // const verified = await paystackVerify(reference);
  // if (!verified.status) throw new AppError('Payment verification failed', 400);

  let topUpAmount = amount;

  // Deduct onboarding fee on first top-up
  if (!company.onboardingFeePaid) {
    topUpAmount = amount - corporateService.ONBOARDING_FEE;
    await prisma.company.update({
      where: { id: company.id },
      data:  { onboardingFeePaid: true, onboardingPaidAt: new Date() },
    });
  }

  const wallet = await corporateService.topUpCompanyWallet({
    companyId:   company.id,
    amount:      topUpAmount,
    reference,
    description: 'Wallet top-up via Paystack',
  });

  res.status(200).json({
    success: true,
    message: `₦${topUpAmount.toLocaleString('en-NG')} added to corporate wallet`,
    data:    { balance: wallet.balance },
  });
};

/**
 * GET /api/corporate/wallet
 */
exports.getWallet = async (req, res) => {
  const company = await prisma.company.findUnique({
    where:   { adminUserId: req.user.id },
    include: { wallet: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } } },
  });
  if (!company) throw new AppError('No corporate account found', 404);

  res.status(200).json({ success: true, data: { wallet: company.wallet } });
};

// ── Employees ─────────────────────────────────────────────────────────────────

/**
 * GET /api/corporate/employees
 */
exports.listEmployees = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const company = await prisma.company.findUnique({ where: { adminUserId: req.user.id } });
  if (!company) throw new AppError('No corporate account found', 404);

  const where = { companyId: company.id };
  if (status) where.inviteStatus = status;

  const [employees, total] = await Promise.all([
    prisma.companyEmployee.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, phone: true, profileImage: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.companyEmployee.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: { employees, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } },
  });
};

/**
 * POST /api/corporate/employees/invite
 */
exports.inviteEmployee = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const company = await prisma.company.findUnique({ where: { adminUserId: req.user.id } });
  if (!company)                   throw new AppError('No corporate account found', 404);
  if (company.status !== 'ACTIVE') throw new AppError('Corporate account must be active to invite employees', 400);

  const employee = await corporateService.inviteEmployee({
    companyId: company.id,
    ...req.body,
  });

  res.status(201).json({
    success: true,
    message: 'Invitation sent. Employee will be notified in the app.',
    data:    { employee },
  });
};

/**
 * PUT /api/corporate/employees/:id
 * Update employee limits / settings
 */
exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { monthlyLimit, department, jobTitle, requireTripPurpose, restrictToBusinessHours, isActive } = req.body;

  const company = await prisma.company.findUnique({ where: { adminUserId: req.user.id } });
  if (!company) throw new AppError('No corporate account found', 404);

  const employee = await prisma.companyEmployee.findUnique({ where: { id } });
  if (!employee)                        throw new AppError('Employee not found', 404);
  if (employee.companyId !== company.id) throw new AppError('Unauthorized', 403);

  const updated = await prisma.companyEmployee.update({
    where: { id },
    data: {
      ...(monthlyLimit             !== undefined && { monthlyLimit }),
      ...(department               !== undefined && { department }),
      ...(jobTitle                 !== undefined && { jobTitle }),
      ...(requireTripPurpose       !== undefined && { requireTripPurpose }),
      ...(restrictToBusinessHours  !== undefined && { restrictToBusinessHours }),
      ...(isActive                 !== undefined && { isActive }),
    },
  });

  res.status(200).json({ success: true, message: 'Employee updated', data: { employee: updated } });
};

/**
 * DELETE /api/corporate/employees/:id
 */
exports.removeEmployee = async (req, res) => {
  const { id } = req.params;

  const company = await prisma.company.findUnique({ where: { adminUserId: req.user.id } });
  if (!company) throw new AppError('No corporate account found', 404);

  const employee = await prisma.companyEmployee.findUnique({ where: { id } });
  if (!employee)                        throw new AppError('Employee not found', 404);
  if (employee.companyId !== company.id) throw new AppError('Unauthorized', 403);

  await prisma.companyEmployee.update({ where: { id }, data: { isActive: false, inviteStatus: 'REJECTED' } });

  res.status(200).json({ success: true, message: 'Employee removed from corporate account' });
};

// ── Employee self-service ─────────────────────────────────────────────────────

/**
 * GET /api/corporate/my-account
 * For employees — get their corporate employment context.
 */
exports.getMyEmploymentContext = async (req, res) => {
  const context = await corporateService.getEmployeeContext(req.user.id);

  if (!context) {
    return res.status(200).json({ success: true, data: { employed: false } });
  }

  res.status(200).json({
    success: true,
    data: {
      employed:    true,
      companyName: context.company.name,
      companyLogo: context.company.logoUrl,
      monthlyLimit:       context.employment.monthlyLimit,
      currentMonthSpend:  context.employment.currentMonthSpend,
      remaining:          context.remaining,
      available:          context.available,
      canBook:            context.canBook,
      requireTripPurpose: context.employment.requireTripPurpose,
      department:         context.employment.department,
    },
  });
};

/**
 * POST /api/corporate/invite/respond
 * Employee accepts or rejects invite.
 */
exports.respondToInvite = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { employeeId, accept } = req.body;

  const updated = await corporateService.respondToInvite({
    userId:     req.user.id,
    employeeId,
    accept,
  });

  res.status(200).json({
    success: true,
    message: accept ? 'You have joined the corporate account' : 'Invite declined',
    data:    { employee: updated },
  });
};

// ── Trips & reporting ─────────────────────────────────────────────────────────

/**
 * GET /api/corporate/trips?page=1&limit=20&employeeId=&startDate=&endDate=
 */
exports.getCorporateTrips = async (req, res) => {
  const { page = 1, limit = 20, employeeId, startDate, endDate } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const company = await prisma.company.findUnique({ where: { adminUserId: req.user.id } });
  if (!company) throw new AppError('No corporate account found', 404);

  const where = { companyId: company.id };
  if (employeeId) where.employeeId = employeeId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate)   where.createdAt.lte = new Date(endDate);
  }

  const [trips, total] = await Promise.all([
    prisma.corporateTrip.findMany({
      where,
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
        ride:     { select: { pickupAddress: true, dropoffAddress: true, completedAt: true, status: true } },
        delivery: { select: { pickupAddress: true, dropoffAddress: true, deliveredAt: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.corporateTrip.count({ where }),
  ]);

  const totalSpend = trips.reduce((s, t) => s + t.fare, 0);

  res.status(200).json({
    success: true,
    data: {
      trips,
      totalSpend,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

/**
 * GET /api/corporate/invoice?year=2025&month=6
 */
exports.getInvoice = async (req, res) => {
  const company = await prisma.company.findUnique({ where: { adminUserId: req.user.id } });
  if (!company) throw new AppError('No corporate account found', 404);

  const year  = parseInt(req.query.year  || new Date().getFullYear());
  const month = parseInt(req.query.month || new Date().getMonth() + 1);

  const invoice = await corporateService.generateMonthlyInvoice({ companyId: company.id, year, month });

  res.status(200).json({ success: true, data: { invoice } });
};

module.exports = exports;