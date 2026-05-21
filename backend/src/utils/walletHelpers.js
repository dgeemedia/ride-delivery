// backend/src/utils/walletHelpers.js
'use strict';
const prisma = require('../lib/prisma');

exports.getWithdrawableBalance = async (wallet) => {
  const bonusCredits = await prisma.walletTransaction.aggregate({
    where: {
      walletId:    wallet.id,
      type:        'CREDIT',
      status:      'COMPLETED',
      description: { contains: 'non-withdrawable' },
    },
    _sum: { amount: true },
  });
  const totalBonus = bonusCredits._sum.amount ?? 0;
  return Math.max(0, wallet.balance - totalBonus);
};