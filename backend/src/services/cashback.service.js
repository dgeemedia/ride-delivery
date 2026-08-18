// backend/src/services/cashback.service.js
'use strict';

const prisma = require('../lib/prisma');
const notificationService = require('./notification.service');

const REFERENCE_PREFIX = 'CASHBACK-10RIDES-';
const MILESTONE = 10;

async function getCashbackSettings() {
  const [enabledS, modeS, amountS, pctS, capS, cutoffS] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_enabled' } }),
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_mode' } }),          // 'fixed' | 'percentage'
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_amount' } }),         // used if mode = fixed
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_percentage' } }),     // used if mode = percentage
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_max_amount' } }),     // optional cap, percentage mode only
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_new_user_after' } }),
  ]);

  return {
    enabled:      enabledS?.value === 'true',
    mode:         modeS?.value === 'percentage' ? 'percentage' : 'fixed',
    amount:       amountS?.value ? parseFloat(amountS.value) : 0,
    percentage:   pctS?.value ? parseFloat(pctS.value) : 0,
    maxAmount:    capS?.value ? parseFloat(capS.value) : null,
    newUserAfter: cutoffS?.value ? new Date(cutoffS.value) : null,
  };
}

// Merge the customer's rides + deliveries by completion time, take the first 10,
// return their combined spend. This is "spend on the trips that earned the reward,"
// not lifetime spend — so it stays correct even if they book an 11th trip before
// the job runs.
async function getFirstTenTripsSpend(userId) {
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
    .slice(0, MILESTONE);

  return { count: trips.length, totalSpend: trips.reduce((sum, t) => sum + t.amount, 0) };
}

async function checkAndIssueRideCashback(userId) {
  const settings = await getCashbackSettings();
  if (!settings.enabled) return;
  if (settings.mode === 'fixed' && settings.amount <= 0) return;
  if (settings.mode === 'percentage' && settings.percentage <= 0) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'CUSTOMER') return;
  if (settings.newUserAfter && user.createdAt < settings.newUserAfter) return;

  const reference = `${REFERENCE_PREFIX}${userId}`;
  const alreadyPaid = await prisma.walletTransaction.findFirst({ where: { reference } });
  if (alreadyPaid) return;

  const { count, totalSpend } = await getFirstTenTripsSpend(userId);
  if (count < MILESTONE) return;

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
    where: { userId }, update: {}, create: { userId, balance: 0, currency: 'NGN' },
  });

  try {
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { increment: cashbackAmount } } }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id, type: 'CREDIT', amount: cashbackAmount,
          description: settings.mode === 'percentage'
            ? `🎉 ${settings.percentage}% cashback on your first ${MILESTONE} trips (₦${totalSpend.toLocaleString('en-NG')} spent)`
            : `🎉 Cashback for completing your first ${MILESTONE} trips`,
          status: 'COMPLETED', reference,
        },
      }),
    ]);
  } catch (err) {
    if (err.code === 'P2002') return; // race-safe
    throw err;
  }

  await notificationService.notify({
    userId, title: 'Cashback Unlocked! 🎉',
    message: `You've completed ${MILESTONE} rides/deliveries — ₦${cashbackAmount.toLocaleString('en-NG')} cashback added to your wallet.`,
    type: 'cashback_awarded',
    data: { amount: cashbackAmount, mode: settings.mode, totalSpend },
  }).catch(() => {});
}

module.exports = { checkAndIssueRideCashback, getCashbackSettings };