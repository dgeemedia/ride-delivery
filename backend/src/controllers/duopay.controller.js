// backend/src/controllers/duopay.controller.js
'use strict';

const { validationResult } = require('express-validator');
const { AppError }         = require('../middleware/errorHandler');
const prisma               = require('../lib/prisma');
const duopayService        = require('../services/duopay.service');

/**
 * GET /api/duopay/eligibility
 */
exports.getEligibility = async (req, res) => {
  const result = await duopayService.checkEligibility(req.user.id);
  res.status(200).json({ success: true, data: result });
};

/**
 * GET /api/duopay/account
 */
exports.getAccount = async (req, res) => {
  const account = await prisma.duoPayAccount.findUnique({
    where:   { userId: req.user.id },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take:    20,
      },
    },
  });

  if (!account) {
    return res.status(200).json({ success: true, data: { account: null } });
  }

  const available = account.creditLimit - account.usedBalance;
  const overdue   = account.transactions.filter(t => t.status === 'OVERDUE');

  res.status(200).json({
    success: true,
    data: {
      account,
      available,
      hasOverdue:    overdue.length > 0,
      overdueAmount: overdue.reduce((s, t) => s + t.amount, 0),
    },
  });
};

/**
 * POST /api/duopay/activate
 * Body: { paystackCustomerCode, subscriptionCode, cardLast4, cardBrand, repaymentDay }
 *
 * The mobile app initiates a Paystack charge authorisation first,
 * then calls this endpoint with the returned subscription/customer codes.
 */
exports.activateAccount = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { paystackCustomerCode, subscriptionCode, cardLast4, cardBrand, repaymentDay } = req.body;

  const account = await duopayService.activateAccount({
    userId: req.user.id,
    paystackCustomerCode,
    subscriptionCode,
    cardLast4,
    cardBrand,
    repaymentDay,
  });

  res.status(200).json({
    success: true,
    message: 'DuoPay activated successfully!',
    data:    { account },
  });
};

/**
 * POST /api/duopay/repay
 * Manual repayment trigger from the customer.
 * In production, repayment is mainly auto-debited via Paystack subscription.
 * This endpoint allows a manual lump-sum payment.
 * Body: { amount, reference }
 */
exports.manualRepay = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount, reference } = req.body;

  // Check wallet has enough
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet || wallet.balance < amount) {
    throw new AppError('Insufficient wallet balance for repayment. Top up your wallet first.', 400);
  }

  // Deduct from wallet
  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: req.user.id },
      data:  { balance: { decrement: amount } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'DEBIT',
        amount,
        description: 'DuoPay repayment',
        status:      'COMPLETED',
        reference:   reference || `DUOPAY-REPAY-${Date.now()}`,
      },
    }),
  ]);

  const result = await duopayService.processRepayment({
    userId:    req.user.id,
    amount,
    reference: reference || `DUOPAY-REPAY-${Date.now()}`,
  });

  res.status(200).json({
    success: true,
    message: `₦${amount.toLocaleString('en-NG')} repayment processed`,
    data:    result,
  });
};

/**
 * GET /api/duopay/transactions
 */
exports.getTransactions = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const account = await prisma.duoPayAccount.findUnique({ where: { userId: req.user.id } });
  if (!account) throw new AppError('DuoPay account not found', 404);

  const where = { duoPayAccountId: account.id };
  if (status) where.status = status;

  const [transactions, total] = await Promise.all([
    prisma.duoPayTransaction.findMany({
      where,
      include: { ride: { select: { pickupAddress: true, dropoffAddress: true, completedAt: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.duoPayTransaction.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: { transactions, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } },
  });
};

/**
 * POST /api/duopay/webhook/paystack
 * Paystack webhook for subscription charge success / failure.
 * Raw body parsing must be set up in app.js for this route.
 */
exports.paystackWebhook = async (req, res) => {
  const crypto = require('crypto');
  const hash   = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const { event, data } = req.body;

  if (event === 'charge.success') {
    try {
      const meta = data.metadata;
      if (meta?.duopay_repayment) {
        await duopayService.processRepayment({
          userId:    meta.userId,
          amount:    data.amount / 100, // Paystack amounts are in kobo
          reference: data.reference,
          paystackEventData: data,
        });
      }
    } catch (err) {
      console.error('[DuoPay webhook] processRepayment error:', err.message);
    }
  }

  res.status(200).json({ received: true });
};

module.exports = exports;