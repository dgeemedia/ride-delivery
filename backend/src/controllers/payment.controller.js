// backend/src/controllers/payment.controller.js
const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/payment.service');
const orangeService = require('../services/orange.service');
const notificationService = require('../services/notification.service');
const emailService = require('../services/email.service');
const { logActivity } = require('../utils/auditLog');
const { getCurrencyForUserId, getCountryForUser } = require('../services/country.service');
const { formatMoney } = require('../utils/currency');

const safeSendEmail = async (fn, label) => {
  try {
    await fn();
  } catch (err) {
    console.error(`[payment.controller] ${label} email failed to send:`, err.message);
  }
};

const assertProviderSupported = (country, provider) => {
  const providers = Array.isArray(country.paymentProviders) ? country.paymentProviders : [];
  if (!providers.includes(provider)) {
    throw new AppError(`${provider} is not available in ${country.name} yet.`, 400);
  }
};

// ─────────────────────────────────────────────
// PAYSTACK FLOWS
// ─────────────────────────────────────────────

exports.paystackInitialize = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount, rideId, deliveryId } = req.body;
  const { email, id: userId } = req.user;
  const chargeCurrency = await getCurrencyForUserId(userId);
  const country = await getCountryForUser(req.user);
  assertProviderSupported(country, 'paystack');

  const transaction = await paymentService.paystackInitialize({
    email,
    amount,
    currency: chargeCurrency,
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

exports.paystackVerify = async (req, res) => {
  const { reference } = req.body;
  if (!reference) throw new AppError('Payment reference is required', 400);

  const transaction = await paymentService.paystackVerify(reference);
  const { userId, rideId, deliveryId } = transaction.metadata;

  const existing = await prisma.payment.findFirst({ where: { transactionId: reference } });
  if (existing) {
    return res.status(200).json({ success: true, message: 'Payment already recorded', data: { payment: existing } });
  }

  const amount = transaction.amount / 100;
  const paymentCurrency = await getCurrencyForUserId(userId);

  const payment = await prisma.payment.create({
    data: {
      userId,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId }),
      amount,
      currency: paymentCurrency,
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
    message: `Your payment of ${formatMoney(amount, paymentCurrency)} was successful.`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { reference, amount, rideId, deliveryId }
  });

  // req.user is the authenticated payer here, so we can email directly
  // without an extra lookup.
  if (req.user?.email) {
    await safeSendEmail(
      () => emailService.sendPaymentReceiptEmail(req.user.email, req.user.firstName, {
        amount,
        method: 'CARD',
        reference,
        service: rideId ? 'ride' : deliveryId ? 'delivery' : null,
      }),
      'Payment receipt (Paystack verify)'
    );
  }

  res.status(201).json({ success: true, message: 'Payment verified and recorded', data: { payment } });
};

exports.paystackWebhook = async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const isValid = paymentService.validatePaystackWebhook(signature, req.rawBody);
  if (!isValid) return res.status(401).json({ success: false, message: 'Invalid signature' });

  const { event, data } = req.body;

  if (event === 'charge.success') {
    const { reference } = data;

    const existing = await prisma.payment.findFirst({ where: { transactionId: reference } });

    if (!existing) {
      let verified;
      try {
        verified = await paymentService.paystackVerify(reference);
      } catch (err) {
        console.error('[paystackWebhook] verification failed:', err.message);
        return res.sendStatus(200);
      }

      const { userId, rideId, deliveryId } = verified.metadata || {};
      const chargedAmount = verified.amount / 100;

      if (userId) {
        const paymentCurrency = await getCurrencyForUserId(userId);
        await prisma.payment.create({
          data: {
            userId,
            ...(rideId && { rideId }),
            ...(deliveryId && { deliveryId }),
            amount: chargedAmount,
            currency: paymentCurrency,
            method: 'CARD',
            status: 'COMPLETED',
            transactionId: reference,
            platformFee: chargedAmount * 0.20,
            driverEarnings: chargedAmount * 0.80
          }
        });

        await notificationService.notify({
          userId,
          title: 'Payment Received ✅',
          message: `Your payment of ${formatMoney(chargedAmount, paymentCurrency)} was received.`,
          type: notificationService.TYPES.PAYMENT_RECEIVED,
          data: { reference, amount: chargedAmount }
        });

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
        if (user?.email) {
          await safeSendEmail(
            () => emailService.sendPaymentReceiptEmail(user.email, user.firstName, {
              amount: chargedAmount,
              method: 'CARD',
              reference,
              service: rideId ? 'ride' : deliveryId ? 'delivery' : null,
            }),
            'Payment receipt (Paystack webhook)'
          );
        }
      }
    }
  }

  res.sendStatus(200);
};

// ─────────────────────────────────────────────
// FLUTTERWAVE FLOWS
// ─────────────────────────────────────────────

exports.flutterwaveInitialize = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount, rideId, deliveryId } = req.body;
  const { email, phone, firstName, lastName, id: userId } = req.user;
  const txRef = `TXN-${userId}-${Date.now()}`;
  const chargeCurrency = await getCurrencyForUserId(userId);
  const country = await getCountryForUser(req.user);
  assertProviderSupported(country, 'flutterwave');

  const transaction = await paymentService.flutterwaveInitialize({
    email,
    phone,
    name: `${firstName} ${lastName}`,
    amount,
    txRef,
    currency: chargeCurrency,
    metadata: {
      userId,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId })
    }
  });

  res.status(200).json({ success: true, data: { paymentLink: transaction.link, txRef } });
};

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
  const paymentCurrency = await getCurrencyForUserId(userId);

  const payment = await prisma.payment.create({
    data: {
      userId,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId }),
      amount,
      currency: paymentCurrency,
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
    message: `Your payment of ${formatMoney(amount, paymentCurrency)} was successful.`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { transactionId, amount }
  });

  if (req.user?.email) {
    await safeSendEmail(
      () => emailService.sendPaymentReceiptEmail(req.user.email, req.user.firstName, {
        amount,
        method: 'CARD',
        reference: String(transactionId),
        service: rideId ? 'ride' : deliveryId ? 'delivery' : null,
      }),
      'Payment receipt (Flutterwave verify)'
    );
  }

  res.status(201).json({ success: true, message: 'Payment verified and recorded', data: { payment } });
};

exports.flutterwaveWebhook = async (req, res) => {
  const signature = req.headers['verif-hash'];
  if (!paymentService.validateFlutterwaveWebhook(signature)) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  const { event, data } = req.body;

  if (event === 'charge.completed' && data.status === 'successful') {
    const existing = await prisma.payment.findFirst({ where: { transactionId: String(data.id) } });

    if (!existing) {
      let verified;
      try {
        verified = await paymentService.flutterwaveVerify(data.id);
      } catch (err) {
        console.error('[flutterwaveWebhook] verification failed:', err.message);
        return res.sendStatus(200);
      }

      const { userId, rideId, deliveryId } = verified.meta || {};
      const amount = verified.amount;

      if (userId) {
        const paymentCurrency = await getCurrencyForUserId(userId);
        await prisma.payment.create({
          data: {
            userId,
            ...(rideId && { rideId }),
            ...(deliveryId && { deliveryId }),
            amount,
            currency: paymentCurrency,
            method: 'CARD',
            status: 'COMPLETED',
            transactionId: String(data.id),
            platformFee: amount * 0.20,
            driverEarnings: amount * 0.80
          }
        });

        await notificationService.notify({
          userId,
          title: 'Payment Received ✅',
          message: `Your payment of ${formatMoney(amount, paymentCurrency)} was received.`,
          type: notificationService.TYPES.PAYMENT_RECEIVED,
          data: { transactionId: data.id, amount }
        });

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
        if (user?.email) {
          await safeSendEmail(
            () => emailService.sendPaymentReceiptEmail(user.email, user.firstName, {
              amount,
              method: 'CARD',
              reference: String(data.id),
              service: rideId ? 'ride' : deliveryId ? 'delivery' : null,
            }),
            'Payment receipt (Flutterwave webhook)'
          );
        }
      }
    }
  }

  res.sendStatus(200);
};

// ─────────────────────────────────────────────
// ORANGE MONEY FLOWS
// ─────────────────────────────────────────────
//
// Used for ride/delivery charges in Orange markets. Structurally identical
// to the Paystack/Flutterwave flows above: initialize -> customer pays on
// Orange's hosted page -> we verify against Orange (never against the
// callback payload) -> a Payment row is written exactly once.

exports.orangeInitialize = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount, rideId, deliveryId } = req.body;
  const { id: userId } = req.user;

  const country = await getCountryForUser(req.user);
  assertProviderSupported(country, 'orange');

  if (!orangeService.isOrangeConfigured()) {
    throw new AppError('Orange Money is not activated yet. Please use another payment method.', 503);
  }

  const currency = country.currencyCode;
  if (['XOF', 'XAF', 'GNF'].includes(currency) && !Number.isInteger(Number(amount))) {
    throw new AppError(`${currency} amounts must be whole numbers.`, 400);
  }

  const orderId = `OM-${rideId ? 'RIDE' : deliveryId ? 'DLV' : 'PAY'}-${userId.slice(0, 8)}-${Date.now()}`;

  const session = await orangeService.initializeWebPayment({
    amount,
    orderId,
    currency,
    countryCode: country.code,
    config:      country.providerConfig?.orange ?? {},
    notifUrl:    `${process.env.API_BASE_URL}/api/payments/orange/webhook`,
    reference:   rideId ? 'Ride payment' : deliveryId ? 'Delivery payment' : 'Payment',
  });

  // Written PENDING so an abandoned checkout is visible to ops instead of
  // vanishing, and so the pay_token survives for verification later.
  await prisma.payment.create({
    data: {
      userId,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId }),
      amount,
      currency,
      method:        'MOBILE_MONEY',
      status:        'PENDING',
      transactionId: orderId,
      provider:      'orange',
      providerRef:   session.payToken,
    },
  });

  res.status(200).json({
    success: true,
    data: {
      paymentUrl: session.paymentUrl,
      orderId,
      payToken:   session.payToken,
    },
  });
};

/**
 * Settle an Orange payment. Shared by the client verify call and the
 * webhook, and idempotent on the PENDING Payment row.
 */
const settleOrangePayment = async (orderId) => {
  const payment = await prisma.payment.findFirst({ where: { transactionId: orderId } });
  if (!payment) return { ok: false, reason: 'Unknown Orange order' };
  if (payment.status === 'COMPLETED') return { ok: true, alreadyProcessed: true, payment };

  const payer = await prisma.user.findUnique({
    where:  { id: payment.userId },
    select: { id: true, email: true, firstName: true, countryCode: true },
  });
  const country = await getCountryForUser(payer);

  const status = await orangeService.getTransactionStatus({
    orderId,
    amount:      payment.amount,
    payToken:    payment.providerRef,
    countryCode: country.code,
    config:      country.providerConfig?.orange ?? {},
  });

  if (status.isPending) return { ok: false, pending: true, reason: 'Payment still pending with Orange' };

  if (!status.isSuccess) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    return { ok: false, reason: `Orange reported status ${status.status}` };
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status:         'COMPLETED',
      platformFee:    payment.amount * 0.20,
      driverEarnings: payment.amount * 0.80,
      providerRef:    status.txnId ?? payment.providerRef,
    },
  });

  await notificationService.notify({
    userId:  payment.userId,
    title:   'Payment Successful ✅',
    message: `Your Orange Money payment of ${formatMoney(payment.amount, payment.currency)} was successful.`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { reference: orderId, amount: payment.amount, rideId: payment.rideId, deliveryId: payment.deliveryId },
  });

  if (payer?.email) {
    await safeSendEmail(
      () => emailService.sendPaymentReceiptEmail(payer.email, payer.firstName, {
        amount:    payment.amount,
        method:    'Orange Money',
        reference: orderId,
        service:   payment.rideId ? 'ride' : payment.deliveryId ? 'delivery' : null,
      }),
      'Payment receipt (Orange verify)'
    );
  }

  return { ok: true, payment: updated };
};

exports.orangeVerify = async (req, res) => {
  const orderId = req.body?.orderId || req.body?.reference;
  if (!orderId) throw new AppError('Orange order ID is required', 400);

  const result = await settleOrangePayment(orderId);

  if (!result.ok) {
    const code = result.pending ? 202 : 400;
    return res.status(code).json({ success: false, pending: !!result.pending, message: result.reason });
  }

  res.status(result.alreadyProcessed ? 200 : 201).json({
    success: true,
    message: result.alreadyProcessed ? 'Payment already recorded' : 'Payment verified and recorded',
    data:    { payment: result.payment },
  });
};

exports.orangeWebhook = async (req, res) => {
  const orderId    = req.body?.order_id    ?? req.body?.orderId;
  const notifToken = req.body?.notif_token ?? req.body?.notifToken;

  if (!orangeService.validateWebhook(orderId, notifToken)) {
    return res.status(401).json({ success: false, message: 'Invalid Orange notification token' });
  }

  try {
    await settleOrangePayment(orderId);
  } catch (err) {
    console.error('[payment.controller] Orange webhook failed:', err.message);
  }

  res.sendStatus(200);
};

// ─────────────────────────────────────────────
// CASH PAYMENT
// ─────────────────────────────────────────────

exports.processCash = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { rideId, deliveryId, amount } = req.body;
  const paymentCurrency = await getCurrencyForUserId(req.user.id);

  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId }),
      amount,
      currency: paymentCurrency,
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
        currency: wallet.currency,
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

  let earnerWallet = null;
  if (earningsUserId) {
    earnerWallet = await prisma.wallet.findUnique({ where: { userId: earningsUserId } });
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
    message: `${formatMoney(amount, wallet.currency)} paid from wallet. Balance: ${formatMoney(updatedWallet.balance, updatedWallet.currency)}`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { amount, newBalance: updatedWallet.balance }
  });

  if (req.user.email) {
    await safeSendEmail(
      () => emailService.sendPaymentReceiptEmail(req.user.email, req.user.firstName, {
        amount,
        method: 'WALLET',
        reference: `SVC-${rideId || deliveryId}`,
        service: rideId ? 'ride' : 'delivery',
      }),
      'Payment receipt (wallet payment)'
    );
  }

  if (earningsUserId && earnerWallet) {
    await notificationService.notify({
      userId: earningsUserId,
      title: 'Payment Received 💰',
      message: `${formatMoney(earnings, earnerWallet.currency)} added to your wallet (after 20% platform fee).`,
      type: notificationService.TYPES.PAYMENT_RECEIVED,
      data: { earnings, platformFee }
    });

    const earner = await prisma.user.findUnique({ where: { id: earningsUserId }, select: { email: true, firstName: true } });
    if (earner?.email) {
      await safeSendEmail(
        () => emailService.sendEarningsCreditedEmail(earner.email, earner.firstName, {
          amount: earnings,
          platformFee,
          reference: `EARN-${rideId || deliveryId}`,
          service: rideId ? 'ride' : 'delivery',
        }),
        'Earnings credited (wallet payment)'
      );
    }
  }

  res.status(200).json({ success: true, message: 'Wallet payment successful', data: { payment, wallet: updatedWallet } });
};

// ─────────────────────────────────────────────
// REFUND
// ─────────────────────────────────────────────

exports.requestRefund = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) throw new AppError('Payment not found', 404);
  if (payment.userId !== req.user.id) throw new AppError('Unauthorized', 403);
  if (payment.status !== 'COMPLETED') throw new AppError('Only completed payments can be refunded', 400);
  if (payment.method === 'CASH') throw new AppError('Cash payments cannot be refunded automatically. Contact support.', 400);

  if (payment.method === 'WALLET') {
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

    // Self-service refund, distinct from admin.controller.js's
    // 'admin_refund_issued' (staff-initiated). Same underlying money
    // movement, different actor, so worth telling apart in the audit trail.
    logActivity({
      userId:     req.user.id,
      action:     'refund_requested_self',
      entityType: 'Payment',
      entityId:   id,
      details:    { method: 'WALLET', refundAmount },
      req,
    });

    await notificationService.notify({
      userId: req.user.id,
      title: 'Refund Processed ✅',
      message: `${formatMoney(refundAmount, wallet.currency)} has been refunded to your wallet.`,
      type: notificationService.TYPES.PAYMENT_REFUNDED,
      data: { paymentId: id, refundAmount }
    });

    if (req.user.email) {
      await safeSendEmail(
        () => emailService.sendRefundProcessedEmail(req.user.email, req.user.firstName, {
          amount: refundAmount,
          method: 'WALLET',
          reference: `REFUND-${id}`,
        }),
        'Refund processed (wallet)'
      );
    }

    return res.status(200).json({ success: true, message: 'Refund credited to wallet', data: { refundAmount } });
  }

  const refund = await paymentService.refundUnified(payment.provider ?? 'paystack', payment.transactionId, amount);
  const refundAmount = amount || payment.amount;

  await prisma.payment.update({
    where: { id },
    data: { status: 'REFUNDED', refundAmount, refundedAt: new Date() }
  });

  logActivity({
    userId:     req.user.id,
    action:     'refund_requested_self',
    entityType: 'Payment',
    entityId:   id,
    details:    { method: payment.method, refundAmount, provider: payment.provider ?? 'paystack' },
    req,
  });

  await notificationService.notify({
    userId: req.user.id,
    title: 'Refund Initiated ✅',
    message: `Your refund of ${formatMoney(refundAmount, payment.currency)} has been processed. It may take 3–5 business days.`,
    type: notificationService.TYPES.PAYMENT_REFUNDED,
    data: { paymentId: id, refundAmount }
  });

  if (req.user.email) {
    await safeSendEmail(
      () => emailService.sendRefundProcessedEmail(req.user.email, req.user.firstName, {
        amount: refundAmount,
        method: payment.method,
        reference: payment.transactionId,
      }),
      'Refund processed (card)'
    );
  }

  res.status(200).json({ success: true, message: 'Refund processed successfully', data: { refund } });
};

// ─────────────────────────────────────────────
// BANK ACCOUNT UTILITIES
// ─────────────────────────────────────────────

exports.listBanks = async (req, res) => {
  const country = await getCountryForUser(req.user);
  const banks = await paymentService.listBanksUnified(country.code, country);
  res.status(200).json({ success: true, data: { banks } });
};

exports.verifyBankAccount = async (req, res) => {
  const { accountNumber, bankCode } = req.body;
  const country = await getCountryForUser(req.user);
  const account = await paymentService.verifyBankAccountUnified(accountNumber, bankCode, country.code, country);
  res.status(200).json({ success: true, data: { account } });
};

// ─────────────────────────────────────────────
// HISTORY & STATS
// ─────────────────────────────────────────────

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
  const statsCurrency = await getCurrencyForUserId(req.user.id);

  const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
  const ridePayments = payments.filter(p => p.rideId);
  const deliveryPayments = payments.filter(p => p.deliveryId);

  const byMethod = { CASH: 0, CARD: 0, WALLET: 0 };
  payments.forEach(p => { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; });

  res.status(200).json({
    success: true,
    data: {
      currency: statsCurrency,
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