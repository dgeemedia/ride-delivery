// backend/src/services/commission.service.js
//
// Called at ride/delivery completion (inside the prisma.$transaction that
// creates the Payment record).  Writes one CommissionLedger row per
// transaction.  All callers pass the raw numbers they already have — no
// re-derivation needed.
//
// USAGE (inside completeRide / completeDelivery):
//
//   const { commissionRecord } = await commissionService.createCommissionRecord({
//     paymentId:        payment.id,
//     serviceType:      'RIDE',
//     rideId:           ride.id,
//     earnerUserId:     ride.driverId,
//     grossAmount:      actualFare,
//     bookingFee:       bookingFee,          // from fareEngine result
//     commissionRate:   commissionRate,      // e.g. 0.20
//     commissionAmount: platformFee,         // NGN kept by platform
//     earnerAmount:     driverEarnings,      // NGN kept by driver
//     surgeMultiplier:  surgeMultiplier,     // 1.0 if no surge
//   });

'use strict';

const prisma = require('../lib/prisma');

/**
 * Write a CommissionLedger record.
 * Safe to call inside or outside a prisma.$transaction — if tx is provided
 * it uses it; otherwise it opens its own.
 *
 * @param {object} params
 * @param {string}  params.paymentId
 * @param {'RIDE'|'DELIVERY'} params.serviceType
 * @param {string}  [params.rideId]
 * @param {string}  [params.deliveryId]
 * @param {string}  params.earnerUserId
 * @param {number}  params.grossAmount
 * @param {number}  [params.bookingFee=0]
 * @param {number}  params.commissionRate    e.g. 0.20
 * @param {number}  params.commissionAmount  NGN
 * @param {number}  params.earnerAmount      NGN
 * @param {number}  [params.surgeMultiplier=1.0]
 * @param {object}  [params.tx]             Prisma transaction client
 */
exports.createCommissionRecord = async ({
  paymentId,
  serviceType,
  rideId,
  deliveryId,
  earnerUserId,
  grossAmount,
  bookingFee       = 0,
  commissionRate,
  commissionAmount,
  earnerAmount,
  surgeMultiplier  = 1.0,
  tx,
}) => {
  const client = tx ?? prisma;

  const record = await client.commissionLedger.create({
    data: {
      paymentId,
      serviceType,
      rideId       : rideId      ?? null,
      deliveryId   : deliveryId  ?? null,
      earnerUserId,
      grossAmount,
      bookingFee,
      commissionRate,
      commissionAmount,
      earnerAmount,
      surgeMultiplier,
      currency: 'NGN',
    },
  });

  return record;
};

/**
 * Aggregated commission stats for the admin analytics API.
 *
 * @param {{ from?: Date, to?: Date, serviceType?: 'RIDE'|'DELIVERY' }} opts
 */
exports.getCommissionStats = async ({ from, to, serviceType } = {}) => {
  const where = {};
  if (serviceType) where.serviceType = serviceType;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to)   where.createdAt.lte = to;
  }

  const [totals, byService, topEarners] = await Promise.all([
    // Overall totals
    prisma.commissionLedger.aggregate({
      where,
      _sum: {
        grossAmount:      true,
        commissionAmount: true,
        earnerAmount:     true,
        bookingFee:       true,
      },
      _count: { id: true },
    }),

    // Split by RIDE vs DELIVERY
    prisma.commissionLedger.groupBy({
      by: ['serviceType'],
      where,
      _sum: { grossAmount: true, commissionAmount: true, earnerAmount: true },
      _count: { id: true },
    }),

    // Top 10 earners (drivers/partners by total earnerAmount)
    prisma.commissionLedger.groupBy({
      by: ['earnerUserId'],
      where,
      _sum: { earnerAmount: true, commissionAmount: true, grossAmount: true },
      _count: { id: true },
      orderBy: { _sum: { earnerAmount: 'desc' } },
      take: 10,
    }),
  ]);

  // Enrich top earners with user info
  const earnerIds = topEarners.map(e => e.earnerUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: earnerIds } },
    select: { id: true, firstName: true, lastName: true, role: true, phone: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  return {
    totals: {
      transactions:      totals._count.id,
      grossRevenue:      totals._sum.grossAmount      ?? 0,
      platformCommission: totals._sum.commissionAmount ?? 0,
      earnerPayouts:     totals._sum.earnerAmount      ?? 0,
      bookingFees:       totals._sum.bookingFee        ?? 0,
    },
    byService: byService.map(s => ({
      serviceType:        s.serviceType,
      transactions:       s._count.id,
      grossRevenue:       s._sum.grossAmount      ?? 0,
      platformCommission: s._sum.commissionAmount ?? 0,
      earnerPayouts:      s._sum.earnerAmount      ?? 0,
    })),
    topEarners: topEarners.map(e => ({
      user:          userMap[e.earnerUserId] ?? { id: e.earnerUserId },
      transactions:  e._count.id,
      grossRevenue:  e._sum.grossAmount  ?? 0,
      netEarnings:   e._sum.earnerAmount ?? 0,
      commission:    e._sum.commissionAmount ?? 0,
    })),
  };
};

/**
 * Daily commission breakdown for the last N days (chart data).
 */
exports.getDailyCommission = async ({ days = 30, serviceType } = {}) => {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const where = { createdAt: { gte: from } };
  if (serviceType) where.serviceType = serviceType;

  const rows = await prisma.commissionLedger.findMany({
    where,
    select: {
      createdAt:        true,
      serviceType:      true,
      grossAmount:      true,
      commissionAmount: true,
      earnerAmount:     true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Bucket by date string
  const buckets = {};
  for (const row of rows) {
    const date = row.createdAt.toISOString().slice(0, 10);
    if (!buckets[date]) {
      buckets[date] = { date, gross: 0, commission: 0, earner: 0, rides: 0, deliveries: 0 };
    }
    buckets[date].gross      += row.grossAmount;
    buckets[date].commission += row.commissionAmount;
    buckets[date].earner     += row.earnerAmount;
    if (row.serviceType === 'RIDE')     buckets[date].rides++;
    if (row.serviceType === 'DELIVERY') buckets[date].deliveries++;
  }

  return Object.values(buckets);
};

module.exports = exports;