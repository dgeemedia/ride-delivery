// backend/src/utils/walletHelpers.js
'use strict';
const prisma = require('../lib/prisma');
const countryService = require('../services/country.service');

/**
 * Single source of truth for wallet creation. Every place that used to do
 * `prisma.wallet.create({ data: { userId, balance: 0, currency: 'NGN' } })`
 * or a `wallet.upsert` with the same hardcoded currency now calls this
 * instead, so currency assignment can never drift between the 5 call sites
 * (register, verifyEmail, lazy ensureWallet, admin user creation, cashback).
 *
 * Looks up the user's country to set the correct currency. If the user row
 * isn't passed in, pass the userId and we'll fetch it. Existing users all
 * have countryCode='NG' (Stage 1 migration default), so behavior for them
 * is unchanged — this only diverges once a user has a non-NG countryCode.
 */
exports.ensureWallet = async (userId, userOrCountryCode = null) => {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;

  let countryCode = 'NG';
  if (userOrCountryCode && typeof userOrCountryCode === 'object') {
    countryCode = userOrCountryCode.countryCode ?? 'NG';
  } else if (typeof userOrCountryCode === 'string') {
    countryCode = userOrCountryCode;
  } else {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { countryCode: true } });
    countryCode = user?.countryCode ?? 'NG';
  }

  const country = await countryService.getCountryByCode(countryCode);

  return prisma.wallet.create({
    data: { userId, balance: 0, currency: country.currencyCode },
  });
};

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