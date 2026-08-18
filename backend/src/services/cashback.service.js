// backend/src/services/cashback.service.js
'use strict';

const prisma = require('../lib/prisma');
const notificationService = require('./notification.service');

const REFERENCE_PREFIX = 'CASHBACK-MILESTONE-'; // e.g. CASHBACK-MILESTONE-10-{userId}
const DEFAULT_MILESTONE = 10;

// ─────────────────────────────────────────────
// SETTINGS
// All values are admin-configurable via SystemSettings — no redeploy needed
// to change the trip threshold, reward mode, amount, cap, or eligibility date.
// ─────────────────────────────────────────────
async function getCashbackSettings() {
  const [enabledS, milestoneS, modeS, amountS, pctS, capS, cutoffS] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { key: 'cashback_enabled' } }),
    prisma.systemSettings.findUnique({ where: { key: 'cashback_milestone_trips' } }),
    prisma.systemSettings.findUnique({ where: { key: 'cashback_mode' } }),          // 'fixed' | 'percentage'
    prisma.systemSettings.findUnique({ where: { key: 'cashback_amount' } }),        // used if mode = fixed
    prisma.systemSettings.findUnique({ where: { key: 'cashback_percentage' } }),    // used if mode = percentage
    prisma.systemSettings.findUnique({ where: { key: 'cashback_max_amount' } }),    // optional cap, percentage mode only
    prisma.systemSettings.findUnique({ where: { key: 'cashback_new_user_after' } }),
  ]);

  return {
    enabled:      enabledS?.value === 'true',
    milestone:    milestoneS?.value ? parseInt(milestoneS.value, 10) : DEFAULT_MILESTONE,
    mode:         modeS?.value === 'percentage' ? 'percentage' : 'fixed',
    amount:       amountS?.value ? parseFloat(amountS.value) : 0,
    percentage:   pctS?.value ? parseFloat(pctS.value) : 0,
    maxAmount:    capS?.value ? parseFloat(capS.value) : null,
    newUserAfter: cutoffS?.value ? new Date(cutoffS.value) : null,
  };
}

// ─────────────────────────────────────────────
// Merge the customer's rides + deliveries by completion time, take the first
// N (N = milestone), return count + combined spend. Used for percentage-mode
// payouts, and to confirm the customer has actually reached the milestone.
// ─────────────────────────────────────────────
async function getFirstNTripsSpend(userId, milestone) {
  const [rides, deliveries] = await Promise.all([
    prisma.ride.findMany({
      where:  { customerId: userId, status: 'COMPLETED' },
      select: { actualFare: true, estimatedFare: true, completedAt: true },
    }),
    prisma.delivery.findMany({
      where:  { customerId: userId, status: 'DELIVERED' },
      select: { actualFee: true, estimatedFee: true, deliveredAt: true },
    }),
  ]);

  const trips = [
    ...rides.map(r => ({ amount: r.actualFare ?? r.estimatedFare ?? 0, at: r.completedAt })),
    ...deliveries.map(d => ({ amount: d.actualFee ?? d.estimatedFee ?? 0, at: d.deliveredAt })),
  ]
    .filter(t => t.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .slice(0, milestone);

  return { count: trips.length, totalSpend: trips.reduce((sum, t) => sum + t.amount, 0) };
}

// ─────────────────────────────────────────────
// Call this after a ride/delivery is completed for a CUSTOMER.
// Cheap no-ops out early in every case except the one real trigger,
// so it's safe to call unconditionally on every completion.
// ─────────────────────────────────────────────
async function checkAndIssueRideCashback(userId) {
  const settings = await getCashbackSettings();
  if (!settings.enabled) return;
  if (!settings.milestone || settings.milestone < 1) return;
  if (settings.mode === 'fixed' && settings.amount <= 0) return;
  if (settings.mode === 'percentage' && settings.percentage <= 0) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'CUSTOMER') return;

  // "New users" = signed up on/after the promo's configured start date
  if (settings.newUserAfter && user.createdAt < settings.newUserAfter) return;

  // Reference is tied to the milestone value at time of payout, so changing
  // the milestone later doesn't accidentally re-trigger a payout for someone
  // who already got one under a different threshold.
  const reference = `${REFERENCE_PREFIX}${settings.milestone}-${userId}`;
  const alreadyPaid = await prisma.walletTransaction.findFirst({ where: { reference } });
  if (alreadyPaid) return;

  const { count, totalSpend } = await getFirstNTripsSpend(userId, settings.milestone);
  if (count < settings.milestone) return;

  let cashbackAmount;
  if (settings.mode === 'percentage') {
    cashbackAmount = totalSpend * (settings.percentage / 100);
    if (settings.maxAmount) cashbackAmount = Math.min(cashbackAmount, settings.maxAmount);
  } else {
    cashbackAmount = settings.amount;
  }
  cashbackAmount = Math.round(cashbackAmount);
  if (cashbackAmount <= 0) return;

  const wallet = await prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, currency: 'NGN' },
  });

  try {
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { increment: cashbackAmount } } }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: cashbackAmount,
          description: settings.mode === 'percentage'
            ? `🎉 ${settings.percentage}% cashback on your first ${settings.milestone} trips (₦${totalSpend.toLocaleString('en-NG')} spent)`
            : `🎉 Cashback for completing your first ${settings.milestone} trips`,
          status: 'COMPLETED',
          reference,
        },
      }),
    ]);
  } catch (err) {
    // Duplicate reference under a race (two completions firing at once) — safe to ignore
    if (err.code === 'P2002') return;
    throw err;
  }

  await notificationService.notify({
    userId,
    title: 'Cashback Unlocked! 🎉',
    message: `You've completed ${settings.milestone} rides/deliveries — ₦${cashbackAmount.toLocaleString('en-NG')} cashback has been added to your wallet.`,
    type: 'cashback_awarded',
    data: { amount: cashbackAmount, mode: settings.mode, totalSpend, milestone: settings.milestone },
  }).catch(() => {});
}

module.exports = { checkAndIssueRideCashback, getCashbackSettings };