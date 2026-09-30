// backend/src/services/cashback.service.js
'use strict';

const prisma = require('../lib/prisma');
const notificationService = require('./notification.service');
const countrySettingsService = require('./countrySettings.service');
const { ensureWallet } = require('../utils/walletHelpers');
const { formatMoney } = require('../utils/currency');

const REFERENCE_PREFIX = 'CASHBACK-MILESTONE-'; // e.g. CASHBACK-MILESTONE-10-{userId}

// ─────────────────────────────────────────────
// SETTINGS
// Resolved PER COUNTRY through countrySettings.service (country override →
// global SystemSettings → default). Nigeria keeps reading the same global keys
// the admin has always edited, so its behaviour is unchanged. Other countries
// must be switched on explicitly and get their own reward amounts, because a
// Naira amount is meaningless in CFA.
// ─────────────────────────────────────────────
async function getCashbackSettings(countryCode = 'NG') {
  const { values: v } = await countrySettingsService.getEffectiveSettings(countryCode);
  return {
    enabled:      v.cashback_enabled === true,
    milestone:    v.cashback_milestone_trips,
    mode:         v.cashback_mode === 'percentage' ? 'percentage' : 'fixed',
    amount:       v.cashback_amount,
    percentage:   v.cashback_percentage,
    maxAmount:    v.cashback_max_amount > 0 ? v.cashback_max_amount : null,
    newUserAfter: v.cashback_new_user_after ? new Date(v.cashback_new_user_after) : null,
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
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'CUSTOMER') return;

  const settings = await getCashbackSettings(user.countryCode ?? 'NG');
  if (!settings.enabled) return;
  if (!settings.milestone || settings.milestone < 1) return;
  if (settings.mode === 'fixed' && settings.amount <= 0) return;
  if (settings.mode === 'percentage' && settings.percentage <= 0) return;

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

  const wallet = await ensureWallet(userId, user);
  const money  = (n) => formatMoney(n, wallet.currency, user.countryCode);

  try {
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { increment: cashbackAmount } } }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: cashbackAmount,
          description: settings.mode === 'percentage'
            ? `🎉 ${settings.percentage}% cashback on your first ${settings.milestone} trips (${money(totalSpend)} spent)`
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
    message: `You've completed ${settings.milestone} rides/deliveries — ${money(cashbackAmount)} cashback has been added to your wallet.`,
    type: 'cashback_awarded',
    data: { amount: cashbackAmount, mode: settings.mode, totalSpend, milestone: settings.milestone },
  }).catch(() => {});
}

module.exports = { checkAndIssueRideCashback, getCashbackSettings };
