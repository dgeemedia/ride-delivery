// backend/src/controllers/payment.controller.js
const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/payment.service');
const notificationService = require('../services/notification.service');

// ─────────────────────────────────────────────
// PAYSTACK FLOWS
// ─────────────────────────────────────────────

/**
 * @desc    Initialize Paystack transaction
 * @route   POST /api/payments/paystack/initialize
 * @access  Private
 */
exports.paystackInitialize = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount, rideId, deliveryId } = req.body;
  const { email, id: userId } = req.user;

  const transaction = await paymentService.paystackInitialize({
    email,
    amount,
    metadata: {
      userId,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId })
    }
  });

  res.status(200).json({
    success: true,
    data: {
      authorizationUrl: transaction.authorization_url,
      accessCode: transaction.access_code,
      reference: transaction.reference
    }
  });
};

/**
 * @desc    Verify Paystack payment and record it
 * @route   POST /api/payments/paystack/verify
 * @access  Private
 */
exports.paystackVerify = async (req, res) => {
  const { reference } = req.body;
  if (!reference) throw new AppError('Payment reference is required', 400);

  const transaction = await paymentService.paystackVerify(reference);
  const { userId, rideId, deliveryId } = transaction.metadata;

  // Prevent duplicate recording
  const existing = await prisma.payment.findFirst({ where: { transactionId: reference } });
  if (existing) {
    return res.status(200).json({ success: true, message: 'Payment already recorded', data: { payment: existing } });
  }

  const amount = transaction.amount / 100; // kobo → NGN

  const payment = await prisma.payment.create({
    data: {
      userId,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId }),
      amount,
      currency: 'NGN',
      method: 'CARD',
      status: 'COMPLETED',
      transactionId: reference,
      platformFee: amount * 0.20,
      driverEarnings: amount * 0.80
    }
  });

  await notificationService.notify({
    userId,
    title: 'Payment Successful ✅',
    message: `Your payment of ₦${amount.toFixed(2)} was successful.`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { reference, amount, rideId, deliveryId }
  });

  res.status(201).json({ success: true, message: 'Payment verified and recorded', data: { payment } });
};

/**
 * @desc    Paystack webhook (called by Paystack server)
 * @route   POST /api/payments/paystack/webhook
 * @access  Public (HMAC-verified)
 */
exports.paystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const isValid = paymentService.validatePaystackWebhook(signature, req.rawBody);
  if (!isValid) return res.status(401).json({ success: false, message: 'Invalid signature' });

  const { event, data } = req.body;

  if (event === 'charge.success') {
    const { metadata, reference, amount } = data;
    const { userId, rideId, deliveryId } = metadata || {};

    const existing = await prisma.payment.findFirst({ where: { transactionId: reference } });

    if (!existing && userId) {
      const amountNGN = amount / 100;

      await prisma.payment.create({
        data: {
          userId,
          ...(rideId && { rideId }),
          ...(deliveryId && { deliveryId }),
          amount: amountNGN,
          currency: 'NGN',
          method: 'CARD',
          status: 'COMPLETED',
          transactionId: reference,
          platformFee: amountNGN * 0.20,
          driverEarnings: amountNGN * 0.80
        }
      });

      await notificationService.notify({
        userId,
        title: 'Payment Received ✅',
        message: `Your payment of ₦${amountNGN.toFixed(2)} was received.`,
        type: notificationService.TYPES.PAYMENT_RECEIVED,
        data: { reference, amount: amountNGN }
      });
    }
  }

  // Always return 200 to Paystack immediately
  res.sendStatus(200);
};

// ─────────────────────────────────────────────
// FLUTTERWAVE FLOWS
// ─────────────────────────────────────────────

/**
 * @desc    Initialize Flutterwave payment
 * @route   POST /api/payments/flutterwave/initialize
 * @access  Private
 */
exports.flutterwaveInitialize = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount, rideId, deliveryId } = req.body;
  const { email, phone, firstName, lastName, id: userId } = req.user;
  const txRef = `TXN-${userId}-${Date.now()}`;

  const transaction = await paymentService.flutterwaveInitialize({
    email,
    phone,
    name: `${firstName} ${lastName}`,
    amount,
    txRef,
    metadata: {
      userId,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId })
    }
  });

  res.status(200).json({ success: true, data: { paymentLink: transaction.link, txRef } });
};

/**
 * @desc    Verify Flutterwave payment
 * @route   POST /api/payments/flutterwave/verify
 * @access  Private
 */
exports.flutterwaveVerify = async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) throw new AppError('Transaction ID is required', 400);

  const transaction = await paymentService.flutterwaveVerify(transactionId);
  const { userId, rideId, deliveryId } = transaction.meta || {};

  const existing = await prisma.payment.findFirst({ where: { transactionId: String(transactionId) } });
  if (existing) {
    return res.status(200).json({ success: true, message: 'Payment already recorded', data: { payment: existing } });
  }

  const amount = transaction.amount;

  const payment = await prisma.payment.create({
    data: {
      userId,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId }),
      amount,
      currency: 'NGN',
      method: 'CARD',
      status: 'COMPLETED',
      transactionId: String(transactionId),
      platformFee: amount * 0.20,
      driverEarnings: amount * 0.80
    }
  });

  await notificationService.notify({
    userId,
    title: 'Payment Successful ✅',
    message: `Your payment of ₦${amount.toFixed(2)} was successful.`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { transactionId, amount }
  });

  res.status(201).json({ success: true, message: 'Payment verified and recorded', data: { payment } });
};

/**
 * @desc    Flutterwave webhook
 * @route   POST /api/payments/flutterwave/webhook
 * @access  Public (hash-verified)
 */
exports.flutterwaveWebhook = async (req, res) => {
  const signature = req.headers['verif-hash'];
  if (!paymentService.validateFlutterwaveWebhook(signature)) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  const { event, data } = req.body;

  if (event === 'charge.completed' && data.status === 'successful') {
    const { userId, rideId, deliveryId } = data.meta || {};
    const existing = await prisma.payment.findFirst({ where: { transactionId: String(data.id) } });

    if (!existing && userId) {
      await prisma.payment.create({
        data: {
          userId,
          ...(rideId && { rideId }),
          ...(deliveryId && { deliveryId }),
          amount: data.amount,
          currency: 'NGN',
          method: 'CARD',
          status: 'COMPLETED',
          transactionId: String(data.id),
          platformFee: data.amount * 0.20,
          driverEarnings: data.amount * 0.80
        }
      });

      await notificationService.notify({
        userId,
        title: 'Payment Received ✅',
        message: `Your payment of ₦${data.amount.toFixed(2)} was received.`,
        type: notificationService.TYPES.PAYMENT_RECEIVED,
        data: { transactionId: data.id, amount: data.amount }
      });
    }
  }

  res.sendStatus(200);
};

// ─────────────────────────────────────────────
// CASH PAYMENT
// ─────────────────────────────────────────────

/**
 * @desc    Record a cash payment
 * @route   POST /api/payments/cash
 * @access  Private
 */
exports.processCash = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { rideId, deliveryId, amount } = req.body;

  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId }),
      amount,
      currency: 'NGN',
      method: 'CASH',
      status: 'PENDING',
      transactionId: `CASH-${Date.now()}`,
      platformFee: amount * 0.20,
      driverEarnings: amount * 0.80
    }
  });

  res.status(201).json({
    success: true,
    message: 'Cash payment recorded. Driver will confirm collection.',
    data: { payment }
  });
};

// ─────────────────────────────────────────────
// WALLET PAYMENT
// ─────────────────────────────────────────────

/**
 * @desc    Pay for a ride or delivery using wallet balance
 * @route   POST /api/payments/wallet
 * @access  Private
 */
exports.processWalletPayment = async (req, res) => {
  const { rideId, deliveryId, amount } = req.body;

  if (!amount || amount <= 0) throw new AppError('Valid amount is required', 400);
  if (!rideId && !deliveryId) throw new AppError('rideId or deliveryId is required', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet || wallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
  }

  const platformFee = amount * 0.20;
  const earnings = amount * 0.80;

  // Get service for earnings credit
  let earningsUserId = null;
  if (rideId) {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    earningsUserId = ride?.driverId;
  } else if (deliveryId) {
    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    earningsUserId = delivery?.partnerId;
  }

  const txns = [
    prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { decrement: amount } } }),
    prisma.payment.create({
      data: {
        userId: req.user.id,
        ...(rideId && { rideId }),
        ...(deliveryId && { deliveryId }),
        amount,
        currency: 'NGN',
        method: 'WALLET',
        status: 'COMPLETED',
        transactionId: `WALLET-${Date.now()}`,
        platformFee,
        driverEarnings: earnings
      }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amount,
        description: rideId ? 'Ride payment' : 'Delivery payment',
        status: 'COMPLETED',
        reference: `SVC-${rideId || deliveryId}`
      }
    })
  ];

  // Credit earnings to driver/partner
  if (earningsUserId) {
    const earnerWallet = await prisma.wallet.findUnique({ where: { userId: earningsUserId } });
    if (earnerWallet) {
      txns.push(
        prisma.wallet.update({ where: { userId: earningsUserId }, data: { balance: { increment: earnings } } }),
        prisma.walletTransaction.create({
          data: {
            walletId: earnerWallet.id,
            type: 'CREDIT',
            amount: earnings,
            description: rideId ? 'Ride earnings' : 'Delivery earnings',
            status: 'COMPLETED',
            reference: `EARN-${rideId || deliveryId}`
          }
        })
      );
    }
  }

  const results = await prisma.$transaction(txns);
  const payment = results[1];
  const updatedWallet = results[0];

  await notificationService.notify({
    userId: req.user.id,
    title: 'Payment Successful 💳',
    message: `₦${amount.toFixed(2)} paid from wallet. Balance: ₦${updatedWallet.balance.toFixed(2)}`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { amount, newBalance: updatedWallet.balance }
  });

  if (earningsUserId) {
    await notificationService.notify({
      userId: earningsUserId,
      title: 'Payment Received 💰',
      message: `₦${earnings.toFixed(2)} added to your wallet (after 20% platform fee).`,
      type: notificationService.TYPES.PAYMENT_RECEIVED,
      data: { earnings, platformFee }
    });
  }

  res.status(200).json({ success: true, message: 'Wallet payment successful', data: { payment, wallet: updatedWallet } });
};

// ─────────────────────────────────────────────
// REFUND
// ─────────────────────────────────────────────

/**
 * @desc    Request refund
 * @route   POST /api/payments/:id/refund
 * @access  Private
 */
exports.requestRefund = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.userId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (payment.status !== 'COMPLETED') throw new AppError('Only completed payments can be refunded', 400);
  if (payment.method === 'CASH') throw new AppError('Cash payments cannot be refunded automatically. Contact support.', 400);

  if (payment.method === 'WALLET') {
    // Refund back to wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    const refundAmount = amount || payment.amount;

    await prisma.$transaction([
      prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { increment: refundAmount } } }),
      prisma.payment.update({ where: { id }, data: { status: 'REFUNDED', refundAmount, refundedAt: new Date() } }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT',
          amount: refundAmount,
          description: 'Payment refund',
          status: 'COMPLETED',
          reference: `REFUND-${id}`
        }
      })
    ]);

    await notificationService.notify({
      userId: req.user.id,
      title: 'Refund Processed ✅',
      message: `₦${refundAmount.toFixed(2)} has been refunded to your wallet.`,
      type: notificationService.TYPES.PAYMENT_REFUNDED,
      data: { paymentId: id, refundAmount }
    });

    return res.status(200).json({ success: true, message: 'Refund credited to wallet', data: { refundAmount } });
  }

  // Card refund via Paystack
  const refund = await paymentService.paystackRefund(payment.transactionId, amount);

  await prisma.payment.update({
    where: { id },
    data: { status: 'REFUNDED', refundAmount: amount || payment.amount, refundedAt: new Date() }
  });

  await notificationService.notify({
    userId: req.user.id,
    title: 'Refund Initiated ✅',
    message: `Your refund of ₦${(amount || payment.amount).toFixed(2)} has been processed. It may take 3–5 business days.`,
    type: notificationService.TYPES.PAYMENT_REFUNDED,
    data: { paymentId: id, refundAmount: amount || payment.amount }
  });

  res.status(200).json({ success: true, message: 'Refund processed successfully', data: { refund } });
};

// ─────────────────────────────────────────────
// BANK ACCOUNT UTILITIES
// ─────────────────────────────────────────────

/**
 * @desc    List Nigerian banks
 * @route   GET /api/payments/banks
 * @access  Private
 */
exports.listBanks = async (req, res) => {
  const banks = await paymentService.paystackListBanks();
  res.status(200).json({ success: true, data: { banks } });
};

/**
 * @desc    Verify a Nigerian bank account
 * @route   POST /api/payments/verify-account
 * @access  Private
 */
exports.verifyBankAccount = async (req, res) => {
  const { accountNumber, bankCode } = req.body;
  const account = await paymentService.paystackVerifyAccount(accountNumber, bankCode);
  res.status(200).json({ success: true, data: { account } });
};

// ─────────────────────────────────────────────
// HISTORY & STATS
// ─────────────────────────────────────────────

/**
 * @desc    Get payment history
 * @route   GET /api/payments/history
 * @access  Private
 */
exports.getHistory = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const where = { userId: req.user.id, ...(status && { status }) };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        ride: { select: { pickupAddress: true, dropoffAddress: true, completedAt: true } },
        delivery: { select: { pickupAddress: true, dropoffAddress: true, deliveredAt: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit)
    }),
    prisma.payment.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: { payments, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

/**
 * @desc    Get payment by ID
 * @route   GET /api/payments/:id
 * @access  Private
 */
exports.getPaymentById = async (req, res) => {
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      ride: true,
      delivery: true,
      user: { select: { firstName: true, lastName: true, email: true } }
    }
  });

  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.userId !== req.user.id) throw new AppError('Unauthorized', 403);

  res.status(200).json({ success: true, data: { payment } });
};

/**
 * @desc    Get payment stats
 * @route   GET /api/payments/stats
 * @access  Private
 */
exports.getStats = async (req, res) => {
  const { period = 'all' } = req.query;
  let dateFilter = {};

  if (period === 'month') {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    dateFilter = { gte: monthAgo };
  } else if (period === 'year') {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    dateFilter = { gte: yearAgo };
  }

  const payments = await prisma.payment.findMany({
    where: {
      userId: req.user.id,
      status: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
    }
  });

  const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
  const ridePayments = payments.filter(p => p.rideId);
  const deliveryPayments = payments.filter(p => p.deliveryId);

  const byMethod = { CASH: 0, CARD: 0, WALLET: 0 };
  payments.forEach(p => { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; });

  res.status(200).json({
    success: true,
    data: {
      currency: 'NGN',
      totalSpent: totalSpent.toFixed(2),
      totalTransactions: payments.length,
      averageTransaction: payments.length > 0 ? (totalSpent / payments.length).toFixed(2) : '0.00',
      byMethod,
      rides: {
        count: ridePayments.length,
        total: ridePayments.reduce((s, p) => s + p.amount, 0).toFixed(2)
      },
      deliveries: {
        count: deliveryPayments.length,
        total: deliveryPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)
      },
      period
    }
  });
};

module.exports = exports;