// backend/src/services/duopay.service.js
//
// Platform-funded BNPL. Key rules:
//   - Min 5 completed rides before activation
//   - Starting limit ₦2,000; max ₦15,000
//   - Limit increases by ₦1,000 after every 3 consecutive on-time repayments
//   - Single-ride DuoPay max ₦5,000
//   - Weekly repayment via Paystack card charge (tokenised at activation)
//   - Missed repayment → SUSPENDED, DuoPay locked until balance cleared
'use strict';

const prisma              = require('../lib/prisma');
const notificationService = require('./notification.service');
const { logger }          = require('../utils/logger');
const axios               = require('axios');

const PAYSTACK_SECRET  = process.env.PAYSTACK_SECRET_KEY;
const MIN_RIDES        = 5;
const STARTING_LIMIT   = 2000;
const MAX_LIMIT        = 15000;
const MAX_SINGLE_RIDE  = 5000;
const LIMIT_INCREMENT  = 1000;
const CONSECUTIVE_FOR_UPGRADE = 3;
const REPAYMENT_DAYS   = 7; // days until repayment due

// ── Eligibility check ─────────────────────────────────────────────────────────

const checkEligibility = async (userId) => {
  const completedRides = await prisma.ride.count({
    where: { customerId: userId, status: 'COMPLETED' },
  });

  const existing = await prisma.duoPayAccount.findUnique({ where: { userId } });

  if (existing) {
    return {
      eligible:     existing.status !== 'DEFAULTED',
      account:      existing,
      completedRides,
      reason:       existing.status === 'DEFAULTED' ? 'Account in default. Clear outstanding balance.' : null,
    };
  }

  const eligible = completedRides >= MIN_RIDES;
  return {
    eligible,
    account:       null,
    completedRides,
    ridesNeeded:   eligible ? 0 : MIN_RIDES - completedRides,
    reason:        eligible ? null : `Complete ${MIN_RIDES - completedRides} more rides to unlock DuoPay`,
  };
};

// ── Activate DuoPay (tokenise card via Paystack) ──────────────────────────────

const activateAccount = async ({ userId, paystackCustomerCode, subscriptionCode, cardLast4, cardBrand, repaymentDay }) => {
  const eligibility = await checkEligibility(userId);
  if (!eligibility.eligible) throw new Error(eligibility.reason);

  const existing = await prisma.duoPayAccount.findUnique({ where: { userId } });

  if (existing) {
    // Re-activate a suspended account
    const updated = await prisma.duoPayAccount.update({
      where: { id: existing.id },
      data:  {
        status:                  'ACTIVE',
        paystackCustomerCode:    paystackCustomerCode || existing.paystackCustomerCode,
        paystackSubscriptionCode: subscriptionCode    || existing.paystackSubscriptionCode,
        cardLast4:               cardLast4            || existing.cardLast4,
        cardBrand:               cardBrand            || existing.cardBrand,
        repaymentDay:            repaymentDay         || existing.repaymentDay,
        activatedAt:             new Date(),
        suspendedAt:             null,
      },
    });
    return updated;
  }

  const account = await prisma.duoPayAccount.create({
    data: {
      userId,
      creditLimit:             STARTING_LIMIT,
      usedBalance:             0,
      status:                  'ACTIVE',
      repaymentDay:            repaymentDay || 1,
      paystackCustomerCode,
      paystackSubscriptionCode: subscriptionCode,
      cardLast4,
      cardBrand,
      activatedAt:             new Date(),
      nextRepaymentDate:       getNextRepaymentDate(repaymentDay || 1),
    },
  });

  await notificationService.notify({
    userId,
    title:   '🎉 DuoPay Activated!',
    message: `You now have ₦${STARTING_LIMIT.toLocaleString('en-NG')} credit to ride now and pay later every week. Repayments auto-debit every ${getDayName(account.repaymentDay)}.`,
    type:    'duopay_activated',
    data:    { limit: STARTING_LIMIT, repaymentDay: account.repaymentDay },
  });

  return account;
};

// ── Use DuoPay for a ride ─────────────────────────────────────────────────────

const chargeRide = async ({ userId, rideId, amount }) => {
  if (amount > MAX_SINGLE_RIDE) {
    throw new Error(`DuoPay maximum per ride is ₦${MAX_SINGLE_RIDE.toLocaleString('en-NG')}. Use wallet or cash for this fare.`);
  }

  const account = await prisma.duoPayAccount.findUnique({ where: { userId } });
  if (!account)                    throw new Error('DuoPay account not found');
  if (account.status !== 'ACTIVE') throw new Error('DuoPay is not active on this account');

  const available = account.creditLimit - account.usedBalance;
  if (available < amount) {
    throw new Error(`Insufficient DuoPay credit. Available: ₦${available.toLocaleString('en-NG')}`);
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + REPAYMENT_DAYS);

  await prisma.$transaction([
    prisma.duoPayAccount.update({
      where: { id: account.id },
      data:  { usedBalance: { increment: amount } },
    }),
    prisma.duoPayTransaction.create({
      data: {
        duoPayAccountId: account.id,
        rideId,
        amount,
        dueDate,
        status: 'PENDING',
      },
    }),
  ]);

  return { success: true, amount, dueDate };
};

// ── Process repayment (called by Paystack webhook or manual trigger) ───────────

const processRepayment = async ({ userId, amount, reference, paystackEventData }) => {
  const account = await prisma.duoPayAccount.findUnique({
    where:   { userId },
    include: {
      transactions: {
        where:   { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!account) throw new Error('DuoPay account not found');

  let remaining = amount;
  const paid    = [];

  for (const tx of account.transactions) {
    if (remaining <= 0) break;
    const toApply = Math.min(remaining, tx.amount);

    await prisma.duoPayTransaction.update({
      where: { id: tx.id },
      data:  {
        status:             toApply >= tx.amount ? 'PAID' : 'PENDING',
        paidAt:             toApply >= tx.amount ? new Date() : null,
        repaymentReference: reference,
      },
    });

    remaining -= toApply;
    paid.push(tx.id);
  }

  // Update account balance
  const newUsed = Math.max(0, account.usedBalance - amount);
  const updates = { usedBalance: newUsed };

  // Check if all transactions are now paid → increment consecutive counter → maybe upgrade limit
  const openTx = await prisma.duoPayTransaction.count({
    where: { duoPayAccountId: account.id, status: 'PENDING' },
  });

  if (openTx === 0) {
    updates.consecutiveOnTime = account.consecutiveOnTime + 1;

    // Upgrade credit limit every 3 consecutive on-time repayments
    if (updates.consecutiveOnTime % CONSECUTIVE_FOR_UPGRADE === 0) {
      const newLimit = Math.min(account.creditLimit + LIMIT_INCREMENT, MAX_LIMIT);
      if (newLimit > account.creditLimit) {
        updates.creditLimit = newLimit;
        await notificationService.notify({
          userId,
          title:   '📈 DuoPay Limit Increased!',
          message: `Your DuoPay credit limit has increased to ₦${newLimit.toLocaleString('en-NG')} for consistent repayments. Keep it up!`,
          type:    'duopay_limit_upgrade',
          data:    { oldLimit: account.creditLimit, newLimit },
        });
      }
    }

    // Reactivate if previously suspended
    if (account.status === 'SUSPENDED') {
      updates.status       = 'ACTIVE';
      updates.suspendedAt  = null;
      updates.activatedAt  = new Date();
    }
  }

  await prisma.duoPayAccount.update({ where: { id: account.id }, data: updates });

  await notificationService.notify({
    userId,
    title:   '✅ DuoPay Repayment Received',
    message: `₦${amount.toLocaleString('en-NG')} has been applied to your DuoPay balance. Remaining: ₦${newUsed.toLocaleString('en-NG')}.`,
    type:    'duopay_repayment',
    data:    { amount, newUsed, reference },
  });

  return { paid, newUsed };
};

// ── Mark overdue (run daily via cron) ─────────────────────────────────────────

const markOverdue = async () => {
  const now = new Date();

  // Mark overdue transactions
  const overdue = await prisma.duoPayTransaction.updateMany({
    where:  { status: 'PENDING', dueDate: { lt: now } },
    data:   { status: 'OVERDUE' },
  });

  // Suspend accounts with overdue transactions
  const overdueAccounts = await prisma.duoPayTransaction.findMany({
    where:   { status: 'OVERDUE' },
    select:  { duoPayAccountId: true },
    distinct: ['duoPayAccountId'],
  });

  for (const { duoPayAccountId } of overdueAccounts) {
    const account = await prisma.duoPayAccount.findUnique({
      where:   { id: duoPayAccountId },
      include: { user: { select: { id: true, firstName: true } } },
    });
    if (!account || account.status === 'SUSPENDED' || account.status === 'DEFAULTED') continue;

    await prisma.duoPayAccount.update({
      where: { id: duoPayAccountId },
      data:  { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    await notificationService.notify({
      userId:  account.userId,
      title:   '⚠️ DuoPay Suspended',
      message: `Your DuoPay account has been suspended due to an overdue repayment. Pay your outstanding balance to reactivate.`,
      type:    'duopay_suspended',
      data:    { accountId: duoPayAccountId },
    });
  }

  logger.info(`[DuoPay] Marked ${overdue.count} transactions overdue, suspended ${overdueAccounts.length} accounts`);
  return { overdue: overdue.count, suspended: overdueAccounts.length };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getNextRepaymentDate = (dayOfMonth) => {
  const now  = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (next <= now) next.setMonth(next.getMonth() + 1);
  return next;
};

const getDayName = (dayOfMonth) => {
  const d = getNextRepaymentDate(dayOfMonth);
  return d.toLocaleDateString('en-NG', { weekday: 'long' });
};

module.exports = {
  checkEligibility,
  activateAccount,
  chargeRide,
  processRepayment,
  markOverdue,
  MAX_SINGLE_RIDE,
  STARTING_LIMIT,
  MAX_LIMIT,
};