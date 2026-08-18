// backend/src/services/cashback.service.js
'use strict';

const prisma = require('../lib/prisma');
const notificationService = require('./notification.service');

const REFERENCE_PREFIX = 'CASHBACK-10RIDES-';
const MILESTONE = 10;

async function getCashbackSettings() {
  const [enabledSetting, amountSetting, cutoffSetting] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_enabled' } }),
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_amount' } }),
    prisma.systemSettings.findUnique({ where: { key: 'cashback_10rides_new_user_after' } }),
  ]);
  return {
    enabled: enabledSetting?.value === 'true',
    amount: amountSetting?.value ? parseFloat(amountSetting.value) : 0,
    newUserAfter: cutoffSetting?.value ? new Date(cutoffSetting.value) : null,
  };
}

async function checkAndIssueRideCashback(userId) {
  const settings = await getCashbackSettings();
  if (!settings.enabled || settings.amount <= 0) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'CUSTOMER') return;
  if (settings.newUserAfter && user.createdAt < settings.newUserAfter) return;

  const reference = `${REFERENCE_PREFIX}${userId}`;
  const alreadyPaid = await prisma.walletTransaction.findFirst({ where: { reference } });
  if (alreadyPaid) return;

  const [completedRides, completedDeliveries] = await Promise.all([
    prisma.ride.count({ where: { customerId: userId, status: 'COMPLETED' } }),
    prisma.delivery.count({ where: { customerId: userId, status: 'DELIVERED' } }),
  ]);
  if (completedRides + completedDeliveries < MILESTONE) return;

  const wallet = await prisma.wallet.upsert({
    where: { userId }, update: {}, create: { userId, balance: 0, currency: 'NGN' },
  });

  try {
    await prisma.$transaction([
      prisma.wallet.update({ where: { userId }, data: { balance: { increment: settings.amount } } }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id, type: 'CREDIT', amount: settings.amount,
          description: `🎉 Cashback for completing your first ${MILESTONE} trips`,
          status: 'COMPLETED', reference,
        },
      }),
    ]);
  } catch (err) {
    if (err.code === 'P2002') return; // race-safe: two completions fired at once
    throw err;
  }

  await notificationService.notify({
    userId, title: 'Cashback Unlocked! 🎉',
    message: `You've completed ${MILESTONE} rides/deliveries — cashback added to your wallet.`,
    type: 'cashback_awarded',
    data: { amount: settings.amount },
  }).catch(() => {});
}

module.exports = { checkAndIssueRideCashback, getCashbackSettings };