// backend/src/services/corporate.service.js
'use strict';

const prisma              = require('../lib/prisma');
const notificationService = require('./notification.service');
const { logger }          = require('../utils/logger');

const CORPORATE_COMMISSION = 0.18;  // 18% on corporate rides vs 15% standard
const ONBOARDING_FEE       = 50000; // ₦50,000 one-time fee
const MONTHLY_MINIMUM      = 100000;// ₦100,000 minimum top-up
const LOW_BALANCE_THRESHOLD= 50000; // Notify company when wallet drops below this

// ── Eligibility ───────────────────────────────────────────────────────────────

/**
 * Check if a user is an active corporate employee and has remaining monthly budget.
 */
const getEmployeeContext = async (userId) => {
  const employment = await prisma.companyEmployee.findFirst({
    where: {
      userId,
      isActive:     true,
      inviteStatus: 'ACTIVE',
      company:      { status: 'ACTIVE' },
    },
    include: {
      company: {
        include: { wallet: true },
      },
    },
  });

  if (!employment) return null;

  const remaining = employment.monthlyLimit - employment.currentMonthSpend;
  const companyBalance = employment.company.wallet?.balance ?? 0;
  const available = Math.min(remaining, companyBalance);

  return {
    employment,
    company:    employment.company,
    wallet:     employment.company.wallet,
    remaining,
    available,
    canBook:    available > 0 && (!employment.restrictToBusinessHours || isBusinessHours()),
  };
};

/**
 * Mon–Fri 7 AM – 8 PM WAT (UTC+1)
 */
const isBusinessHours = () => {
  const now = new Date();
  const watHour    = (now.getUTCHours() + 1) % 24;
  const dayOfWeek  = now.getUTCDay();
  const isWeekday  = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isInHours  = watHour >= 7 && watHour < 20;
  return isWeekday && isInHours;
};

// ── Company registration ──────────────────────────────────────────────────────

const registerCompany = async ({ adminUserId, name, rcNumber, email, phone, address, billingType }) => {
  // Create company
  const company = await prisma.company.create({
    data: {
      name, rcNumber, email, phone, address,
      adminUserId,
      billingType: billingType || 'PREPAID',
      status:      'PENDING',
    },
  });

  // Create company wallet
  await prisma.companyWallet.create({
    data: { companyId: company.id, balance: 0 },
  });

  // Notify admin
  await notificationService.notify({
    userId:  adminUserId,
    title:   '🏢 Corporate Account Submitted',
    message: `Your corporate account for ${name} is under review. Our team will activate it within 24 hours.`,
    type:    'corporate_registered',
    data:    { companyId: company.id },
  });

  return company;
};

// ── Wallet top-up ─────────────────────────────────────────────────────────────

const topUpCompanyWallet = async ({ companyId, amount, reference, description }) => {
  if (amount < MONTHLY_MINIMUM) {
    throw new Error(`Minimum top-up is ₦${MONTHLY_MINIMUM.toLocaleString('en-NG')}`);
  }

  const company = await prisma.company.findUnique({
    where:   { id: companyId },
    include: { wallet: true, admin: { select: { id: true } } },
  });
  if (!company) throw new Error('Company not found');
  if (!company.wallet) throw new Error('Company wallet not found');

  const [updatedWallet] = await prisma.$transaction([
    prisma.companyWallet.update({
      where: { id: company.wallet.id },
      data:  { balance: { increment: amount } },
    }),
    prisma.companyWalletTransaction.create({
      data: {
        walletId:    company.wallet.id,
        type:        'CREDIT',
        amount,
        description: description || 'Wallet top-up',
        reference,
        status:      'COMPLETED',
      },
    }),
  ]);

  await notificationService.notify({
    userId:  company.admin.id,
    title:   '💰 Corporate Wallet Topped Up',
    message: `₦${amount.toLocaleString('en-NG')} has been added to ${company.name}'s transport wallet. New balance: ₦${updatedWallet.balance.toLocaleString('en-NG')}.`,
    type:    'corporate_topup',
    data:    { companyId, amount, balance: updatedWallet.balance },
  });

  return updatedWallet;
};

// ── Deduct fare from company wallet ──────────────────────────────────────────

const deductCorporateFare = async ({ companyId, employeeId, rideId, deliveryId, fare }) => {
  const company = await prisma.company.findUnique({
    where:   { id: companyId },
    include: { wallet: true },
  });
  if (!company?.wallet) throw new Error('Company wallet not found');
  if (company.wallet.balance < fare) throw new Error('Insufficient corporate wallet balance');

  const commissionAmount = fare * CORPORATE_COMMISSION;

  await prisma.$transaction([
    // Deduct from company wallet
    prisma.companyWallet.update({
      where: { id: company.wallet.id },
      data:  { balance: { decrement: fare } },
    }),
    // Record transaction
    prisma.companyWalletTransaction.create({
      data: {
        walletId:    company.wallet.id,
        type:        'DEBIT',
        amount:      fare,
        description: rideId
          ? `Corporate ride — employee ${employeeId}`
          : `Corporate delivery — employee ${employeeId}`,
        reference:   `CORP-${rideId ?? deliveryId}-${Date.now()}`,
        status:      'COMPLETED',
      },
    }),
    // Update employee monthly spend
    prisma.companyEmployee.update({
      where: { id: employeeId },
      data:  { currentMonthSpend: { increment: fare } },
    }),
    // Log corporate trip
    prisma.corporateTrip.create({
      data: {
        companyId,
        employeeId,
        rideId:           rideId     || null,
        deliveryId:       deliveryId || null,
        fare,
        commissionAmount,
      },
    }),
  ]);

  // Check low balance
  const newBalance = company.wallet.balance - fare;
  if (newBalance < LOW_BALANCE_THRESHOLD) {
    await notificationService.notify({
      userId:  company.admin.id,
      title:   '⚠️ Corporate Wallet Low',
      message: `${company.name}'s transport wallet balance is ₦${newBalance.toLocaleString('en-NG')}. Top up to avoid service interruption.`,
      type:    'corporate_low_balance',
      data:    { companyId, balance: newBalance, threshold: LOW_BALANCE_THRESHOLD },
    });
  }
};

// ── Employee invite ───────────────────────────────────────────────────────────

const inviteEmployee = async ({ companyId, phone, monthlyLimit, department, jobTitle, requireTripPurpose, restrictToBusinessHours }) => {
  // Find user by phone
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) throw new Error('No DuoRide account found for this phone number. Ask the employee to register first.');

  // Check not already added
  const existing = await prisma.companyEmployee.findUnique({
    where: { companyId_userId: { companyId, userId: user.id } },
  });
  if (existing && existing.inviteStatus !== 'REJECTED') {
    throw new Error('This employee is already in your corporate account');
  }

  const employee = existing
    ? await prisma.companyEmployee.update({
        where: { id: existing.id },
        data:  {
          inviteStatus: 'PENDING',
          monthlyLimit: monthlyLimit || 30000,
          department,
          jobTitle,
          requireTripPurpose:      requireTripPurpose      ?? false,
          restrictToBusinessHours: restrictToBusinessHours ?? false,
          isActive:     true,
          invitedAt:    new Date(),
        },
      })
    : await prisma.companyEmployee.create({
        data: {
          companyId,
          userId:       user.id,
          monthlyLimit: monthlyLimit || 30000,
          department,
          jobTitle,
          requireTripPurpose:      requireTripPurpose      ?? false,
          restrictToBusinessHours: restrictToBusinessHours ?? false,
          inviteStatus: 'PENDING',
        },
      });

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  await notificationService.notify({
    userId:  user.id,
    title:   '🏢 Corporate Invite',
    message: `${company.name} has invited you to join their corporate transport account. Open DuoRide to accept.`,
    type:    'corporate_invite',
    data:    { companyId, employeeId: employee.id, companyName: company.name },
  });

  return employee;
};

// ── Accept / reject invite ────────────────────────────────────────────────────

const respondToInvite = async ({ userId, employeeId, accept }) => {
  const employee = await prisma.companyEmployee.findUnique({
    where:   { id: employeeId },
    include: { company: { select: { name: true, admin: { select: { id: true } } } } },
  });
  if (!employee)              throw new Error('Invite not found');
  if (employee.userId !== userId) throw new Error('Unauthorized');
  if (employee.inviteStatus !== 'PENDING') throw new Error('Invite already responded to');

  const updated = await prisma.companyEmployee.update({
    where: { id: employeeId },
    data:  {
      inviteStatus: accept ? 'ACTIVE' : 'REJECTED',
      joinedAt:     accept ? new Date() : null,
    },
  });

  await notificationService.notify({
    userId:  employee.company.admin.id,
    title:   accept ? '✅ Employee Joined' : '❌ Employee Declined',
    message: accept
      ? `An employee accepted your corporate transport invite.`
      : `An employee declined your corporate transport invite.`,
    type:    'corporate_invite_response',
    data:    { employeeId, accepted: accept },
  });

  return updated;
};

// ── Monthly spend reset (run via cron on 1st of each month) ──────────────────

const resetMonthlySpend = async () => {
  const count = await prisma.companyEmployee.updateMany({
    where: { isActive: true },
    data:  { currentMonthSpend: 0, spendResetDate: new Date() },
  });
  logger.info(`[Corporate] Monthly spend reset for ${count.count} employees`);
  return count;
};

// ── Invoice generation ────────────────────────────────────────────────────────

const generateMonthlyInvoice = async ({ companyId, year, month }) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate   = new Date(year, month, 0, 23, 59, 59);

  const trips = await prisma.corporateTrip.findMany({
    where: {
      companyId,
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      employee: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      ride:     { select: { pickupAddress: true, dropoffAddress: true, completedAt: true } },
      delivery: { select: { pickupAddress: true, dropoffAddress: true, deliveredAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalFare       = trips.reduce((s, t) => s + t.fare, 0);
  const totalCommission = trips.reduce((s, t) => s + t.commissionAmount, 0);

  return {
    companyId,
    period:       `${year}-${String(month).padStart(2, '0')}`,
    totalTrips:   trips.length,
    totalFare,
    totalCommission,
    trips: trips.map(t => ({
      id:         t.id,
      date:       t.ride?.completedAt ?? t.delivery?.deliveredAt ?? t.createdAt,
      employee:   `${t.employee.user.firstName} ${t.employee.user.lastName}`,
      department: t.employee.department,
      type:       t.rideId ? 'Ride' : 'Delivery',
      from:       t.ride?.pickupAddress   ?? t.delivery?.pickupAddress,
      to:         t.ride?.dropoffAddress  ?? t.delivery?.dropoffAddress,
      purpose:    t.purpose,
      fare:       t.fare,
    })),
  };
};

module.exports = {
  getEmployeeContext,
  registerCompany,
  topUpCompanyWallet,
  deductCorporateFare,
  inviteEmployee,
  respondToInvite,
  resetMonthlySpend,
  generateMonthlyInvoice,
  CORPORATE_COMMISSION,
  ONBOARDING_FEE,
};