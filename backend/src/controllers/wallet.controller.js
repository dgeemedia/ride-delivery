// backend/src/controllers/wallet.controller.js

const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/payment.service');
const notificationService = require('../services/notification.service');
const emailService = require('../services/email.service');
const { logActivity } = require('../utils/auditLog');
const { ensureWallet: ensureWalletShared } = require('../utils/walletHelpers');
const { getCountryForUser, getCurrencyForUserId, getPaymentConfigForUser } = require('../services/country.service');
const orangeService = require('../services/orange.service');
const { formatMoney } = require('../utils/currency');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

// Delegates to the single shared implementation in utils/walletHelpers.js
// so wallet creation currency logic lives in exactly one place. Kept as a
// local wrapper named `ensureWallet` so every existing call site below
// (there are several) needs no other changes.
const ensureWallet = async (userId) => ensureWalletShared(userId);

// Failed email should never block or roll back an already-committed wallet
// operation — the DB write is the source of truth.
const safeSendEmail = async (fn, label) => {
  try {
    await fn();
  } catch (err) {
    console.error(`[wallet.controller] ${label} email failed to send:`, err.message);
  }
};

// ─────────────────────────────────────────────
// WALLET INFO
// ─────────────────────────────────────────────

exports.getWallet = async (req, res) => {
  const wallet = await ensureWallet(req.user.id);
  res.status(200).json({ success: true, data: { wallet } });
};

exports.getTransactions = async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const skip = (page - 1) * limit;

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet) throw new AppError('Wallet not found', 404);

  const where = { walletId: wallet.id };
  if (type) where.type = type.toUpperCase();

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(limit),
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      wallet:      { balance: wallet.balance, currency: wallet.currency },
      transactions,
      pagination:  { total, page: parseInt(page), pages: Math.ceil(total / limit) },
    },
  });
};

exports.lookupUser = async (req, res) => {
  const { phone: rawPhone } = req.query;
  if (!rawPhone) throw new AppError('Phone number is required', 400);

  // The client sends a bare local number (e.g. "0801...") while registration
  // stores full E.164 (e.g. "+234801..."). Build every plausible E.164
  // candidate using the requester's own country dial code, since transfers
  // are effectively domestic today (cross-currency transfers are blocked
  // further down this file anyway).
  const digits = rawPhone.replace(/\D/g, '');
  const country = await getCountryForUser(req.user);
  const dialDigits = country.phoneDialCode.replace('+', '');

  const candidates = [...new Set([
    `+${digits}`,
    `+${dialDigits}${digits.replace(/^0+/, '')}`,
    digits.startsWith('0') ? `+${dialDigits}${digits.slice(1)}` : null,
  ].filter(Boolean))];

  if (candidates.includes(req.user.phone)) throw new AppError('Cannot look up yourself', 400);

  const user = await prisma.user.findFirst({
    where:  { phone: { in: candidates } },
    select: { id: true, firstName: true, lastName: true, phone: true, isActive: true },
  });

  if (!user)          throw new AppError('No account found with this phone number', 404);
  if (!user.isActive) throw new AppError('This account is currently inactive', 400);

  res.status(200).json({
    success: true,
    data: { user: { firstName: user.firstName, lastName: user.lastName, phone: user.phone } },
  });
};

// ─────────────────────────────────────────────
// TOP-UP — Paystack
// ─────────────────────────────────────────────

exports.paystackTopup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount } = req.body;
  const chargeCurrency = await getCurrencyForUserId(req.user.id);
  if (amount < 100) throw new AppError(`Minimum top-up amount is ${formatMoney(100, chargeCurrency)}`, 400);

    const transaction = await paymentService.paystackInitialize({
    email:    req.user.email,
    amount,
    currency: chargeCurrency,
    metadata: { userId: req.user.id, purpose: 'wallet_topup' },
  });

  res.status(200).json({
    success: true,
    data: {
      authorizationUrl: transaction.authorization_url,
      accessCode:       transaction.access_code,
      reference:        transaction.reference,
    },
  });
};

exports.verifyPaystackTopup = async (req, res) => {
  const { reference } = req.body;
  if (!reference) throw new AppError('Payment reference is required', 400);

  const existing = await prisma.walletTransaction.findFirst({ where: { reference } });
  if (existing?.status === 'COMPLETED') {
    return res.status(200).json({ success: true, message: 'Already processed', data: { transaction: existing } });
  }

  // The reference the client has (the one we originally issued) may not be
  // what Paystack settled the charge under — e.g. bank-transfer payments get
  // a Paystack-generated reference instead. Try verifying by the given
  // reference first; if Paystack doesn't recognize it, fall back to
  // matching the client's own PENDING top-up by user + amount.
  let transaction;
  try {
    transaction = await paymentService.paystackVerify(reference);
  } catch (err) {
    if (!existing) throw err; // nothing to fall back to — surface the real error
    const fallback = await prisma.walletTransaction.findFirst({
      where: {
        walletId: existing.walletId,
        status:   'PENDING',
        type:     'CREDIT',
        amount:   existing.amount,
        provider: 'paystack',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!fallback) throw err;
    throw new AppError(
      'We could not verify this reference directly. If you completed payment via bank transfer, please wait a moment for automatic confirmation, or contact support.',
      400
    );
  }
  if (transaction.status !== 'success') throw new AppError('Payment verification failed', 400);

  const amount      = transaction.amount / 100;
  const { userId }  = transaction.metadata;
  const wallet      = await ensureWallet(userId);
  const realRef     = transaction.reference; // the reference Paystack actually settled under

  const pendingMatch = existing ?? await prisma.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      status:   'PENDING',
      type:     'CREDIT',
      amount,
      provider: 'paystack',
    },
    orderBy: { createdAt: 'desc' },
  });

  const [updatedWallet, walletTx] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
    pendingMatch
      ? prisma.walletTransaction.update({
          where: { id: pendingMatch.id },
          data: {
            status:      'COMPLETED',
            amount,
            description: 'Wallet top-up via Paystack',
            reference:   realRef,
            provider:    'paystack',
          },
        })
      : prisma.walletTransaction.create({
          data: {
            walletId:    wallet.id,
            type:        'CREDIT',
            amount,
            description: 'Wallet top-up via Paystack',
            status:      'COMPLETED',
            reference:   realRef,
            provider:    'paystack',
          },
        }),
  ]);

  await notificationService.notify({
    userId,
    title:   'Wallet Topped Up 💰',
    message: `${formatMoney(amount, updatedWallet.currency)} has been added to your wallet. New balance: ${formatMoney(updatedWallet.balance, updatedWallet.currency)}`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, newBalance: updatedWallet.balance, reference: realRef },
  });

  res.status(200).json({ success: true, message: 'Wallet topped up successfully', data: { wallet: updatedWallet, transaction: walletTx } });
};

exports.initializeTopUp = async (req, res) => {
  const { amount } = req.body;
  const chargeCurrency = await getCurrencyForUserId(req.user.id);
  if (!amount || amount < 100) throw new AppError(`Minimum top-up is ${formatMoney(100, chargeCurrency)}`, 400);

  // ── Fetch admin-configured limits from SystemSettings ──
  const [minSetting, maxSetting] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_min' } }),
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_max' } }),
  ]);

  const minDeposit = minSetting?.value ? parseFloat(minSetting.value) : 100;
  const maxDeposit = maxSetting?.value ? parseFloat(maxSetting.value) : 1_000_000;

  if (amount < minDeposit)
    throw new AppError(`Minimum top-up is ${formatMoney(minDeposit, chargeCurrency)}`, 400);
  if (amount > maxDeposit)
    throw new AppError(`Maximum top-up is ${formatMoney(maxDeposit, chargeCurrency)}`, 400);

  const reference = `TOPUP-${req.user.id.slice(0, 8)}-${Date.now()}`;

    const paystackRes = await paymentService.paystackInitialize({
    email:       req.user.email,
    amount,
    currency:    chargeCurrency,
    reference,
    metadata:    { userId: req.user.id, type: 'wallet_topup', amount },
    callbackUrl: `${process.env.API_BASE_URL}/api/wallet/topup/verify`,
  });

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (wallet) {
    await prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'CREDIT',
        amount,
        description: 'Wallet top-up via Paystack',
        status:      'PENDING',
        reference,
        provider:    'paystack',
      },
    });
  }

  res.status(200).json({
    success: true,
    data: {
      authorizationUrl: paystackRes.authorization_url,
      reference,
      accessCode:       paystackRes.access_code,
      limits: { min: minDeposit, max: maxDeposit },
    },
  });
};

exports.verifyTopUp = async (req, res) => {
  const sig = req.headers['x-paystack-signature'];
  const raw = req.rawBody;

  if (sig && raw) {
    if (!paymentService.validatePaystackWebhook(sig, raw)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
  } else if (sig && !raw) {
    return res.status(400).json({ success: false, message: 'Raw body not available for signature check' });
  }

  let reference = req.body?.reference;
  if (!reference && raw) {
    try {
      const event = JSON.parse(raw.toString());
      reference = event?.data?.reference;
    } catch { /* ignore */ }
  }
  if (!reference) return res.status(400).json({ success: false });

  const existing = await prisma.walletTransaction.findUnique({ where: { reference } });
  if (existing?.status === 'COMPLETED') {
    return res.status(200).json({ success: true, message: 'Already processed' });
  }

    const verified = await paymentService.paystackVerifyTransaction(reference).catch(() => null);
  if (!verified || verified.data.status !== 'success') {
    return res.status(400).json({ success: false, message: 'Payment not successful' });
  }

  const amount = verified.data.amount / 100;
  const userId = verified.data.metadata?.userId;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId in metadata' });

  const wallet = await ensureWallet(userId);

  // Paystack's bank-transfer channel issues its own reference distinct from
  // the one we sent at initialize time, so `reference` here may not match
  // any existing row. Fall back to matching the original PENDING row by
  // wallet + amount + provider instead of by reference.
  const existingByRef = await prisma.walletTransaction.findFirst({ where: { reference } });
  const pendingMatch = existingByRef ?? await prisma.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      status:   'PENDING',
      type:     'CREDIT',
      amount,
      provider: 'paystack',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (pendingMatch?.status === 'COMPLETED') {
    return res.status(200).json({ success: true, message: 'Already processed' });
  }

  await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
    pendingMatch
      ? prisma.walletTransaction.update({
          where: { id: pendingMatch.id },
          data:  { status: 'COMPLETED', reference, provider: 'paystack' },
        })
      : prisma.walletTransaction.create({
          data: {
            walletId:    wallet.id,
            type:        'CREDIT',
            amount,
            description: 'Wallet top-up via Paystack',
            status:      'COMPLETED',
            reference,
            provider:    'paystack',
          },
        }),
  ]);

  await notificationService.notify({
    userId,
    title:   'Wallet Credited 💰',
    message: `${formatMoney(amount, wallet.currency)} added to your wallet. Ref: ${reference}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { amount, reference },
  });

  res.status(200).json({ success: true });
};

// ─────────────────────────────────────────────
// TOP-UP — Orange Money
// ─────────────────────────────────────────────
//
// Orange markets credit their wallet through Orange's hosted Web Payment
// page rather than a card checkout. The shape mirrors the Paystack /
// Flutterwave flows above, so the mobile top-up screen only has to swap
// which endpoint it calls, not how it behaves.

// XOF, XAF and GNF have no minor unit, so a decimal amount is a client bug
// rather than a rounding question. Reject it loudly instead of silently
// truncating the customer's money.
const assertWholeUnits = (amount, currency) => {
  if (['XOF', 'XAF', 'GNF'].includes(currency) && !Number.isInteger(Number(amount))) {
    throw new AppError(`${currency} amounts must be whole numbers.`, 400);
  }
};

const assertOrangeAvailable = async (user) => {
  const config = await getPaymentConfigForUser(user);
  if (!config.creditMethods.includes('ORANGE_MONEY')) {
    throw new AppError(`Orange Money is not available in ${config.countryName}.`, 400);
  }
  if (!orangeService.isOrangeConfigured()) {
    throw new AppError('Orange Money is not activated yet. Please use another payment method.', 503);
  }
  return config;
};

exports.orangeTopup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount } = req.body;
  const country = await getCountryForUser(req.user);
  await assertOrangeAvailable(req.user);

  const currency = country.currencyCode;
  assertWholeUnits(amount, currency);

  // Same admin-configured limits the Paystack flow respects, so a market
  // switching rails doesn't quietly lose its deposit caps.
  const [minSetting, maxSetting] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_min' } }),
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_max' } }),
  ]);
  const minDeposit = minSetting?.value ? parseFloat(minSetting.value) : 100;
  const maxDeposit = maxSetting?.value ? parseFloat(maxSetting.value) : 1_000_000;

  if (amount < minDeposit) throw new AppError(`Minimum top-up is ${formatMoney(minDeposit, currency)}`, 400);
  if (amount > maxDeposit) throw new AppError(`Maximum top-up is ${formatMoney(maxDeposit, currency)}`, 400);

  const orderId = `OM-TOPUP-${req.user.id.slice(0, 8)}-${Date.now()}`;

  const session = await orangeService.initializeWebPayment({
    amount,
    orderId,
    currency,
    countryCode: country.code,
    config:      country.providerConfig?.orange ?? {},
    notifUrl:    `${process.env.API_BASE_URL}/api/wallet/topup/orange/webhook`,
    reference:   'Wallet top-up',
  });

  // Persist pay_token — Orange's status endpoint needs it later and there is
  // no way to recover it from the order_id alone.
  const wallet = await ensureWallet(req.user.id);
  await prisma.walletTransaction.create({
    data: {
      walletId:    wallet.id,
      type:        'CREDIT',
      amount,
      description: 'Wallet top-up via Orange Money',
      status:      'PENDING',
      reference:   orderId,
      provider:    'orange',
      providerRef: session.payToken,
    },
  });

  res.status(200).json({
    success: true,
    data: {
      paymentUrl: session.paymentUrl,
      orderId,
      payToken:   session.payToken,
      limits:     { min: minDeposit, max: maxDeposit },
    },
  });
};

/**
 * Shared credit path used by BOTH the client-driven verify and the Orange
 * webhook. Idempotent on the PENDING WalletTransaction row, so a webhook and
 * a user tapping "I've paid" at the same moment can't double-credit.
 */
const creditOrangeTopUp = async (orderId) => {
  const pending = await prisma.walletTransaction.findUnique({ where: { reference: orderId } });
  if (!pending) return { ok: false, reason: 'Unknown Orange order' };
  if (pending.status === 'COMPLETED') return { ok: true, alreadyProcessed: true };

  const wallet = await prisma.wallet.findUnique({ where: { id: pending.walletId } });
  if (!wallet) return { ok: false, reason: 'Wallet not found' };

  const user = await prisma.user.findUnique({
    where:  { id: wallet.userId },
    select: { id: true, countryCode: true },
  });
  const country = await getCountryForUser(user);

  // Never trust the callback payload's status — always re-ask Orange.
  const status = await orangeService.getTransactionStatus({
    orderId,
    amount:      pending.amount,
    payToken:    pending.providerRef,
    countryCode: country.code,
    config:      country.providerConfig?.orange ?? {},
  });

  if (status.isPending) return { ok: false, pending: true, reason: 'Payment still pending with Orange' };

  if (!status.isSuccess) {
    await prisma.walletTransaction.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
    return { ok: false, reason: `Orange reported status ${status.status}` };
  }

  const [updatedWallet] = await prisma.$transaction([
    prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: pending.amount } } }),
    prisma.walletTransaction.update({
      where: { id: pending.id },
      data:  { status: 'COMPLETED', providerRef: status.txnId ?? pending.providerRef },
    }),
  ]);

  await notificationService.notify({
    userId:  wallet.userId,
    title:   'Wallet Credited 💰',
    message: `${formatMoney(pending.amount, updatedWallet.currency)} added to your wallet via Orange Money. Ref: ${orderId}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { amount: pending.amount, reference: orderId, provider: 'orange' },
  });

  return { ok: true, wallet: updatedWallet, amount: pending.amount };
};

exports.verifyOrangeTopup = async (req, res) => {
  const orderId = req.body?.orderId || req.body?.reference;
  if (!orderId) throw new AppError('Orange order ID is required', 400);

  const result = await creditOrangeTopUp(orderId);

  if (!result.ok) {
    // A still-pending Orange payment isn't a user error — 202 lets the app
    // poll again instead of showing a failure.
    const code = result.pending ? 202 : 400;
    return res.status(code).json({ success: false, pending: !!result.pending, message: result.reason });
  }

  res.status(200).json({
    success: true,
    message: result.alreadyProcessed ? 'Already processed' : 'Wallet topped up successfully',
    data:    { wallet: result.wallet },
  });
};

/**
 * Orange notif_url callback. Public route — authentication comes from the
 * notif_token HMAC we derived from the order_id at checkout creation.
 * Always 200s once the signature checks out so Orange stops retrying.
 */
exports.orangeWebhook = async (req, res) => {
  const orderId    = req.body?.order_id    ?? req.body?.orderId;
  const notifToken = req.body?.notif_token ?? req.body?.notifToken;

  if (!orangeService.validateWebhook(orderId, notifToken)) {
    return res.status(401).json({ success: false, message: 'Invalid Orange notification token' });
  }

  try {
    const result = await creditOrangeTopUp(orderId);
    if (!result.ok && !result.pending) {
      console.warn('[wallet.controller] Orange webhook could not credit', orderId, result.reason);
    }
  } catch (err) {
    console.error('[wallet.controller] Orange webhook failed:', err.message);
  }

  // Ack regardless — a retry storm helps nobody, and both the client-side
  // verify and the admin reconciliation screen cover a missed credit.
  res.sendStatus(200);
};

// ─────────────────────────────────────────────
// TOP-UP — Flutterwave
// ─────────────────────────────────────────────

exports.flutterwaveTopup = async (req, res) => {
  const { amount } = req.body;
  const { email, phone, firstName, lastName, id: userId } = req.user;
  const chargeCurrency = await getCurrencyForUserId(userId);

  if (amount < 100) throw new AppError(`Minimum top-up amount is ${formatMoney(100, chargeCurrency)}`, 400);

  const txRef = `WALLET-FLW-${userId}-${Date.now()}`;
  const transaction = await paymentService.flutterwaveInitialize({
    email,
    phone:    phone || '',          // ← guard: phone may not be on req.user
    name:     `${firstName} ${lastName}`,
    amount,
    txRef,
    currency: chargeCurrency,
    metadata: { userId, purpose: 'wallet_topup' },
  });

    const wallet = await ensureWallet(userId);
  await prisma.walletTransaction.create({
    data: {
      walletId:    wallet.id,
      type:        'CREDIT',
      amount,
      description: 'Wallet top-up via Flutterwave',
      status:      'PENDING',
      reference:   txRef,
      provider:    'flutterwave',
    },
  });

  res.status(200).json({ success: true, data: { paymentLink: transaction.link, txRef } });
};

exports.verifyFlutterwaveTopup = async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) throw new AppError('Transaction ID is required', 400);

  // The client may send back either our own tx_ref (WALLET-FLW-...) or
  // Flutterwave's internal numeric id, depending on the redirect payload —
  // check both so we don't create a duplicate orphan row for the same top-up.
  const existing = await prisma.walletTransaction.findFirst({
    where: {
      OR: [
        { reference: String(transactionId) },
        { reference: { startsWith: 'WALLET-FLW-' }, provider: 'flutterwave', status: 'PENDING' },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing?.status === 'COMPLETED') {
    return res.status(200).json({ success: true, message: 'Already processed', data: { transaction: existing } });
  }

  // Verify against Flutterwave using whichever reference we actually have —
  // prefer the original tx_ref on the matched PENDING row if we found one.
  const verifyRef = existing?.reference ?? String(transactionId);
  const transaction = await paymentService.flutterwaveVerifyByReference(verifyRef);
  if (transaction.status !== 'successful') throw new AppError('Payment verification failed', 400);

  const amount     = transaction.amount;
  const { userId } = transaction.meta || {};
  const wallet     = await ensureWallet(userId);

  const [updatedWallet, walletTx] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
    existing
      ? prisma.walletTransaction.update({
          where: { id: existing.id },
          data:  { status: 'COMPLETED', amount, provider: 'flutterwave' },
        })
      : prisma.walletTransaction.create({
          data: {
            walletId:    wallet.id,
            type:        'CREDIT',
            amount,
            description: 'Wallet top-up via Flutterwave',
            status:      'COMPLETED',
            reference:   String(transactionId),
            provider:    'flutterwave',
          },
        }),
  ]);

  await notificationService.notify({
    userId,
    title:   'Wallet Topped Up 💰',
    message: `${formatMoney(amount, updatedWallet.currency)} has been added to your wallet. New balance: ${formatMoney(updatedWallet.balance, updatedWallet.currency)}`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, newBalance: updatedWallet.balance },
  });

  res.status(200).json({ success: true, message: 'Wallet topped up successfully', data: { wallet: updatedWallet, transaction: walletTx } });
};

exports.verifyFlutterwaveWebhook = async (req, res) => {
  const signature = req.headers['verif-hash'];
  if (!paymentService.validateFlutterwaveWebhook(signature)) {
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  const { event, data } = req.body;
  if (event !== 'charge.completed' || data?.status !== 'successful') {
    return res.sendStatus(200); // ack, nothing to do
  }

  const txRef = data.tx_ref;
  if (!txRef || !txRef.startsWith('WALLET-FLW-')) {
    return res.sendStatus(200); // not a wallet top-up event, ignore
  }

  const existing = await prisma.walletTransaction.findFirst({ where: { reference: txRef } });
  if (existing?.status === 'COMPLETED') {
    return res.sendStatus(200);
  }

  const verified = await paymentService.flutterwaveVerifyByReference(txRef).catch(() => null);
  if (!verified || verified.status !== 'successful') {
    return res.sendStatus(200); // don't credit on unverified webhook payload alone
  }

  const amount = verified.amount;
  const userId = verified.meta?.userId;
  if (!userId) return res.sendStatus(200);

  const wallet = await ensureWallet(userId);

  await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
    existing
      ? prisma.walletTransaction.update({
          where: { id: existing.id },
          data:  { status: 'COMPLETED', provider: 'flutterwave' },
        })
      : prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT',
            amount,
            description: 'Wallet top-up via Flutterwave',
            status: 'COMPLETED',
            reference: txRef,
            provider: 'flutterwave',
          },
        }),
  ]);

  await notificationService.notify({
    userId,
    title: 'Wallet Credited 💰',
    message: `${formatMoney(amount, wallet.currency)} added to your wallet. Ref: ${txRef}`,
    type: notificationService.TYPES.WALLET_CREDITED,
    data: { amount, reference: txRef },
  });

  res.sendStatus(200);
};

exports.transfer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { recipientPhone, amount, note } = req.body;

  if (amount <= 0)                       throw new AppError('Amount must be greater than 0', 400);
  if (recipientPhone === req.user.phone) throw new AppError('Cannot transfer to yourself', 400);

  const recipient = await prisma.user.findUnique({ where: { phone: recipientPhone } });
  if (!recipient)          throw new AppError('Recipient not found', 404);
  if (!recipient.isActive) throw new AppError('Recipient account is not active', 400);

    const senderWallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!senderWallet) throw new AppError('Wallet not found', 404);

  // TODO: move to a per-country SystemSettings value (like wallet_topup_min/max)
  // once transfer minimums need to vary by market instead of being a flat rule.
  const MIN_TRANSFER = 50;
  if (amount < MIN_TRANSFER) {
    throw new AppError(`Minimum transfer is ${formatMoney(MIN_TRANSFER, senderWallet.currency)}`, 400);
  }
  if (senderWallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
  }

  // Guard: sender and recipient may be in different countries/currencies
  // now that Country is seeded beyond NG. A raw balance move here would
  // otherwise turn a ₦5,000 debit into a 5,000 GHS credit for the recipient.
  const recipientWallet = await prisma.wallet.findUnique({ where: { userId: recipient.id } });
  if (recipientWallet && recipientWallet.currency !== senderWallet.currency) {
    throw new AppError('Cross-currency transfers are not supported yet.', 400);
  }

  const reference = `TRF-${Date.now()}-${req.user.id.slice(0, 6)}`;

  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: req.user.id },
      data:  { balance: { decrement: amount } },
    }),
    prisma.transfer.create({
      data: {
        reference,
        senderId:    req.user.id,
        recipientId: recipient.id,
        amount,
        note:        note ?? null,
        status:      'PENDING',
      },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId:    senderWallet.id,
        type:        'DEBIT',
        amount,
        description: `[PENDING] Transfer to ${recipient.firstName} ${recipient.lastName}${note ? `. Note: ${note}` : ''}`,
        status:      'PENDING',
        reference,
      },
    }),
  ]);

  // A self-initiated transfer already debits the sender's wallet
  // (pending admin approval below). Worth its own audit entry distinct from
  // the WalletTransaction row, especially since it names a specific
  // recipient — a pattern worth watching for account-to-account fraud.
  logActivity({
    userId:     req.user.id,
    action:     'wallet_transfer_requested_self',
    entityType: 'Transfer',
    entityId:   reference,
    details:    { amount, recipientId: recipient.id, recipientPhone, reference },
    req,
  });

  await notificationService.notify({
    userId:  req.user.id,
    title:   'Transfer Pending ⏳',
    message: `${formatMoney(amount, senderWallet.currency)} transfer to ${recipient.firstName} ${recipient.lastName} is pending admin approval.`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, recipientId: recipient.id, reference },
  });

  if (req.user.email) {
    await safeSendEmail(
      () => emailService.sendTransferPendingEmail(req.user.email, req.user.firstName, {
        amount,
        recipientName: `${recipient.firstName} ${recipient.lastName}`,
        reference,
        note,
      }),
      'Transfer pending'
    );
  }

  const admins = await prisma.user.findMany({
    where:  { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });
  await Promise.allSettled(
    admins.map(a =>
      notificationService.notify({
        userId:  a.id,
        title:   'New Transfer Request 💸',
        message: `${req.user.firstName} ${req.user.lastName} → ${recipient.firstName} ${recipient.lastName}: ${formatMoney(amount, senderWallet.currency)}`,
        type:    'transfer_pending',
        data:    { reference, senderId: req.user.id, recipientId: recipient.id, amount },
      })
    )
  );

  res.status(200).json({
    success: true,
    message: `Transfer of ${formatMoney(amount, senderWallet.currency)} submitted and pending admin approval. Funds held from your balance.`,
    data:    { reference, amount, recipientName: `${recipient.firstName} ${recipient.lastName}` },
  });
};

// ─────────────────────────────────────────────
// WITHDRAWAL (bank payout — admin approval flow)
// ─────────────────────────────────────────────

exports.withdraw = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount, accountNumber, bankCode, accountName, mobileNumber } = req.body;

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet) throw new AppError('Wallet not found', 404);

  if (amount < 500) throw new AppError(`Minimum withdrawal is ${formatMoney(500, wallet.currency)}`, 400);
  if (wallet.balance < amount) throw new AppError('Insufficient wallet balance', 400);

  const country = await getCountryForUser(req.user);
  const payoutMethods = country.payoutMethods;

  // A market is payout-capable once it has at least one real rail. Markets
  // still on UNSUPPORTED fail clearly here rather than sending an
  // unroutable account number into a transfer API downstream. Mirrors the
  // guard in driver.controller.js / partner.controller.js's requestPayout.
  if (!payoutMethods.some(m => m !== 'UNSUPPORTED')) {
    throw new AppError(`Payouts for ${country.name} aren't supported yet. Contact support.`, 400);
  }

  const isOrangePayout = payoutMethods.includes('ORANGE_MONEY');

  // ── Normalise the destination per rail ────────────────────────────────────
  // Orange markets pay out to an Orange Money wallet, so the "account
  // number" is an MSISDN and there is no bank code to resolve. Bank markets
  // keep the existing NUBAN behaviour untouched.
  let destination, resolvedBankCode, bankName, payoutMethod;

  if (isOrangePayout) {
    const raw = mobileNumber || accountNumber;
    if (!raw) throw new AppError('Your Orange Money number is required', 400);
    if (!orangeService.isValidMsisdn(raw, country.code)) {
      throw new AppError('That does not look like a valid Orange Money number for your country.', 400);
    }
    destination      = orangeService.normalizeMsisdn(raw, country.code);
    resolvedBankCode = 'ORANGE_MONEY';
    bankName         = 'Orange Money';
    payoutMethod     = 'ORANGE_MONEY';
  } else {
    if (!accountNumber || !bankCode) throw new AppError('Account number and bank code are required', 400);
    destination      = accountNumber;
    resolvedBankCode = bankCode;
    // Auto-resolved from whichever provider is currently active.
    bankName         = await paymentService.resolveBankName(bankCode, country.code);
    payoutMethod     = payoutMethods.find(m => m !== 'UNSUPPORTED' && m !== 'MANUAL') || 'NG_BANK_TRANSFER';
  }

  const reference = `WD-${Date.now()}-${req.user.id.slice(0, 6)}`;

  // ← CHANGED — capture the transaction results (was previously discarded)
  // so we can attach the created Payout's id to the audit log entry below.
  const [, , payoutRecord] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { decrement: amount } } }),
    prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'WITHDRAWAL',
        amount,
        description: `Withdrawal request to ${accountName || destination} — ${destination} (${bankName || resolvedBankCode})`,
        status:      'PENDING',
        reference,
        provider:    isOrangePayout ? 'orange' : paymentService.getActivePayoutProvider(),
      },
    }),
    prisma.payout.create({
      data: {
        userId:        req.user.id,
        amount,
        currency:      wallet.currency,
        accountNumber: destination,
        bankCode:      resolvedBankCode,
        bankName,
        // Orange gives us no subscriber name, so fall back to the requester's
        // own name rather than storing an empty string on the payout record.
        accountName:   accountName || `${req.user.firstName} ${req.user.lastName}`.trim(),
        status:        'PENDING',
        reference,
        payoutMethod,
        payoutDetails: isOrangePayout
          ? { rail: 'ORANGE_MONEY', msisdn: destination, countryCode: country.code, autoSettle: orangeService.isB2CEnabled() }
          : { rail: payoutMethod, countryCode: country.code },
      },
    }),
  ]);

  logActivity({
    userId:     req.user.id,
    action:     'payout_requested',
    entityType: 'Payout',
    entityId:   payoutRecord.id,
    details: {
      role:          req.user.role,
      amount,
      bankCode:      resolvedBankCode,
      payoutMethod,
      countryCode:   country.code,
      accountNumber: `****${destination.slice(-4)}`,
      reference,
    },
    req,
  });

  await notificationService.notify({
    userId:  req.user.id,
    title:   'Withdrawal Requested 🏦',
    message: `${formatMoney(amount, wallet.currency)} withdrawal to ${bankName} is pending admin review.`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, accountNumber: `****${destination.slice(-4)}`, bankCode: resolvedBankCode, payoutMethod, reference },
  });

  if (req.user.email) {
    await safeSendEmail(
      () => emailService.sendWithdrawalUnderReviewEmail(req.user.email, req.user.firstName, {
        amount, reference,
        accountName:   accountName || bankName,
        accountNumber: destination,
      }),
      'Withdrawal under review'
    );
  }

  res.status(200).json({
    success: true,
    message: 'Withdrawal request submitted. Our team will process it within 1–2 business days.',
    data:    { reference, amount },
  });
};

exports.verifyBankAccount = async (req, res) => {
  const { accountNumber, bankCode } = req.query;
  if (!accountNumber || !bankCode) throw new AppError('Account number and bank code required', 400);

  const country = await getCountryForUser(req.user);
  const result = await paymentService.verifyBankAccountUnified(accountNumber, bankCode, country.code, country);
  if (!result) throw new AppError('Account not found', 404);

  res.status(200).json({
    success: true,
    data: {
      accountName:    result.account_name,
      accountNumber:  result.account_number,
      // Orange can't confirm the wallet holder's name — the client shows a
      // "double-check this number" hint instead of a green verified state.
      unverifiedName: !!result.unverifiedName,
    },
  });
};

// ─────────────────────────────────────────────
// ADMIN — Payout management
// ─────────────────────────────────────────────

exports.adminGetPayouts = async (req, res) => {
  const { status = 'PENDING', page = 1, limit = 20 } = req.query;
  const skip  = (page - 1) * limit;
  const where = {};
  if (status !== 'ALL') where.status = status;

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(limit),
    }),
    prisma.payout.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: { payouts, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } },
  });
};

exports.adminApprovePayout = async (req, res) => {
  const { id }   = req.params;
  const { note } = req.body;

  const payout = await prisma.payout.findUnique({ where: { id }, include: { user: true } });
  if (!payout)                     throw new AppError('Payout not found', 404);
  if (payout.status !== 'PENDING') throw new AppError('Payout is not in PENDING status', 400);

  let transferCode  = null;
  let transferError = null;
  let providerOk    = false;

  // Route by the payout owner's country, not a single global provider —
  // an Orange market settles through Orange Money cash-out while a
  // Nigerian payout still goes out over Paystack/Flutterwave.
  const payoutCountry = await getCountryForUser(payout.user);
  let provider = paymentService.resolvePayoutProviderForCountry(payoutCountry);

  try {
    const result = await paymentService.initiatePayoutTransfer({
      amount:        payout.amount,
      accountNumber: payout.accountNumber,
      bankCode:      payout.bankCode,
      accountName:   payout.accountName,
      reason:        `Wallet withdrawal — ${payout.user.firstName} ${payout.user.lastName}`,
      reference:     payout.reference,
      currency:      payout.currency,
      country:       payoutCountry,
      msisdn:        payout.payoutDetails?.msisdn ?? null,
    });
    transferCode = result.transferCode;
    provider     = result.provider;
    providerOk   = true;
  } catch (err) {
    transferError = err?.response?.data?.message ?? err.message ?? 'Unknown transfer error';
    console.error(`[adminApprovePayout] ${provider} transfer error:`, transferError);
  }

  // When the provider call failed the money has NOT left yet. Marking the
  // payout COMPLETED regardless would tell the driver they've been paid and
  // hide the row from the ops queue. Orange markets hit this path routinely
  // until the B2C cash-out contract goes live, so the failure case has to
  // stay visible and retryable rather than being swallowed.
  const settledStatus = providerOk ? 'COMPLETED' : 'PROCESSING';

  await prisma.$transaction([
    prisma.payout.update({
      where: { id },
      data: {
        status:       settledStatus,
        ...(providerOk && { processedAt: new Date() }),
        ...(transferCode  && { transferCode }),
        ...(transferError && { transferError }),
      },
    }),
    prisma.walletTransaction.updateMany({
      where: { reference: payout.reference },
      data:  { status: providerOk ? 'COMPLETED' : 'PENDING' },
    }),
  ]);

  // This is the single most important audit entry in this file: approving
  // a payout triggers a REAL, irreversible external bank transfer.
  logActivity({
    userId:     req.user.id, // the admin who approved it, not the payout owner
    action:     'admin_payout_approved',
    entityType: 'Payout',
    entityId:   id,
    details: {
      targetUserId:  payout.userId,
      amount:        payout.amount,
      provider,
      providerOk,
      transferCode,
      transferError,
      note,
    },
    req,
  });

  await notificationService.notify({
    userId:  payout.userId,
    title:   'Withdrawal Approved ✅',
    message: `Your withdrawal of ${formatMoney(payout.amount, payout.currency)} to ${payout.bankName || payout.accountName} has been approved${
      providerOk ? ' and is on its way' : ' — the transfer is being processed and will complete shortly'
    }.${note ? ` Note: ${note}` : ''}`,
    type:    notificationService.TYPES.WALLET_WITHDRAWAL,
    data:    { payoutId: id, amount: payout.amount, reference: payout.reference },
  });

  if (providerOk && payout.user.email) {
    await safeSendEmail(
      () => emailService.sendWithdrawalApprovedEmail(payout.user.email, payout.user.firstName, {
        amount: payout.amount,
        reference: payout.reference,
        accountName: payout.accountName,
        accountNumber: payout.accountNumber,
        bankName: payout.bankName || payout.bankCode,
      }),
      'Withdrawal approved'
    );
  }

  res.status(200).json({
    success:  true,
    message:  providerOk
      ? `Payout approved and ${provider} transfer initiated`
      : `Payout approved but the ${provider} transfer did not go through — left as PROCESSING for manual settlement`,
    data: {
      provider,
      [provider]: providerOk ? 'ok' : 'failed',
      transferCode,
      ...(transferError && { transferError }),
    },
  });
};

exports.adminRejectPayout = async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  const payout = await prisma.payout.findUnique({ where: { id }, include: { user: true } });
  if (!payout)                      throw new AppError('Payout not found', 404);
  if (payout.status !== 'PENDING')  throw new AppError('Payout is not in PENDING status', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: payout.userId } });

  await prisma.$transaction([
    prisma.wallet.update({ where: { userId: payout.userId }, data: { balance: { increment: payout.amount } } }),
    prisma.payout.update({ where: { id }, data: { status: 'FAILED', failureReason: reason, processedAt: new Date() } }),
    prisma.walletTransaction.updateMany({ where: { reference: payout.reference }, data: { status: 'FAILED' } }),
    prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'REFUND',
        amount:      payout.amount,
        description: `Withdrawal refund — ${reason ?? 'rejected by admin'}`,
        status:      'COMPLETED',
        reference:   `REFUND-${id}`,
      },
    }),
  ]);

  logActivity({
    userId:     req.user.id,
    action:     'admin_payout_rejected',
    entityType: 'Payout',
    entityId:   id,
    details:    { targetUserId: payout.userId, amount: payout.amount, reason },
    req,
  });

  await notificationService.notify({
    userId:  payout.userId,
    title:   'Withdrawal Rejected',
    message: `Your withdrawal of ${formatMoney(payout.amount, payout.currency)} was rejected and refunded to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { payoutId: id, amount: payout.amount, reason },
  });

  if (payout.user.email) {
    await safeSendEmail(
      () => emailService.sendWithdrawalRejectedEmail(payout.user.email, payout.user.firstName, {
        amount: payout.amount,
        reference: payout.reference,
        reason,
      }),
      'Withdrawal rejected'
    );
  }

  res.status(200).json({ success: true, message: 'Payout rejected and wallet refunded' });
};

// ─────────────────────────────────────────────
// ADMIN — Transfer management
//
// FIX: adminApproveTransfer and adminRejectTransfer now query the Transfer
// table by reference instead of regex-parsing the description field.
// ─────────────────────────────────────────────

exports.adminGetTransfers = async (req, res) => {
  const { status = 'PENDING', page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const where = {};
  if (status !== 'ALL') where.status = status;

  const [transfers, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: {
        sender:    { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        recipient: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(limit),
    }),
    prisma.transfer.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: { transfers, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } },
  });
};

exports.adminApproveTransfer = async (req, res) => {
  const { reference } = req.params;
  const { note }      = req.body;

  const transfer = await prisma.transfer.findUnique({
    where:   { reference },
    include: {
      sender:    { include: { wallet: true } },
      recipient: true,
    },
  });
  if (!transfer)                    throw new AppError('Transfer not found', 404);
  if (transfer.status !== 'PENDING') throw new AppError('Transfer already processed', 400);

  const senderWallet    = transfer.sender.wallet;
  const recipientWallet = await ensureWallet(transfer.recipientId);

  await prisma.$transaction([
    prisma.transfer.update({ where: { reference }, data: { status: 'COMPLETED' } }),
    prisma.walletTransaction.updateMany({
      where: { reference, type: 'DEBIT', status: 'PENDING' },
      data:  { status: 'COMPLETED' },
    }),
    prisma.wallet.update({ where: { userId: transfer.recipientId }, data: { balance: { increment: transfer.amount } } }),
    prisma.walletTransaction.create({
      data: {
        walletId:    recipientWallet.id,
        type:        'CREDIT',
        amount:      transfer.amount,
        description: `Transfer received from ${transfer.sender.firstName} ${transfer.sender.lastName}.${note ? ` Note: ${note}` : ''}`,
        status:      'COMPLETED',
        reference:   `${reference}-R`,
      },
    }),
  ]);

  // An admin decision that moves money from one user's wallet to another's.
  // Same risk class as admin.controller.js's wallet_credit / wallet_debit
  // (already CRITICAL there) — this had no equivalent here.
  logActivity({
    userId:     req.user.id,
    action:     'admin_transfer_approved',
    entityType: 'Transfer',
    entityId:   reference,
    details: {
      senderId:    transfer.senderId,
      recipientId: transfer.recipientId,
      amount:      transfer.amount,
      note,
    },
    req,
  });

  await Promise.allSettled([
    notificationService.notify({
      userId:  transfer.senderId,
      title:   'Transfer Approved ✅',
      message: `Your transfer of ${formatMoney(transfer.amount, senderWallet.currency)} to ${transfer.recipient.firstName} ${transfer.recipient.lastName} has been approved.`,
      type:    notificationService.TYPES.PAYMENT_RECEIVED,
      data:    { reference, amount: transfer.amount },
    }),
    notificationService.notify({
      userId:  transfer.recipientId,
      title:   'Money Received 💰',
      message: `${formatMoney(transfer.amount, senderWallet.currency)} received from ${transfer.sender.firstName} ${transfer.sender.lastName}.`,
      type:    notificationService.TYPES.PAYMENT_RECEIVED,
      data:    { reference, amount: transfer.amount },
    }),
  ]);

  await Promise.allSettled([
    transfer.sender.email
      ? safeSendEmail(
          () => emailService.sendTransferApprovedEmail(transfer.sender.email, transfer.sender.firstName, {
            amount: transfer.amount,
            recipientName: `${transfer.recipient.firstName} ${transfer.recipient.lastName}`,
            reference,
            note,
          }),
          'Transfer approved (sender)'
        )
      : Promise.resolve(),
    transfer.recipient.email
      ? safeSendEmail(
          () => emailService.sendMoneyReceivedEmail(transfer.recipient.email, transfer.recipient.firstName, {
            amount: transfer.amount,
            senderName: `${transfer.sender.firstName} ${transfer.sender.lastName}`,
            reference,
            note,
          }),
          'Money received (recipient)'
        )
      : Promise.resolve(),
  ]);

  res.status(200).json({ success: true, message: 'Transfer approved. Recipient has been credited.' });
};

exports.adminRejectTransfer = async (req, res) => {
  const { reference } = req.params;
  const { reason }    = req.body;

  const transfer = await prisma.transfer.findUnique({
    where:   { reference },
    include: {
      sender:    { include: { wallet: true } },
      recipient: true,
    },
  });
  if (!transfer)                    throw new AppError('Transfer not found', 404);
  if (transfer.status !== 'PENDING') throw new AppError('Transfer already processed', 400);

  const senderWallet = transfer.sender.wallet;

  await prisma.$transaction([
    prisma.transfer.update({ where: { reference }, data: { status: 'FAILED' } }),
    prisma.wallet.update({
      where: { userId: transfer.senderId },
      data:  { balance: { increment: transfer.amount } },
    }),
    prisma.walletTransaction.updateMany({
      where: { reference, type: 'DEBIT', status: 'PENDING' },
      data:  { status: 'FAILED' },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId:    senderWallet.id,
        type:        'REFUND',
        amount:      transfer.amount,
        description: `Transfer refund — ${reason ?? 'rejected by admin'}`,
        status:      'COMPLETED',
        reference:   `REFUND-${reference}`,
      },
    }),
  ]);

  logActivity({
    userId:     req.user.id,
    action:     'admin_transfer_rejected',
    entityType: 'Transfer',
    entityId:   reference,
    details: {
      senderId:    transfer.senderId,
      recipientId: transfer.recipientId,
      amount:      transfer.amount,
      reason,
    },
    req,
  });

  await notificationService.notify({
    userId:  transfer.senderId,
    title:   'Transfer Rejected',
    message: `Your transfer of ${formatMoney(transfer.amount, senderWallet.currency)} was rejected. Funds have been returned to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { reference, amount: transfer.amount, reason },
  });

  if (transfer.sender.email) {
    await safeSendEmail(
      () => emailService.sendTransferRejectedEmail(transfer.sender.email, transfer.sender.firstName, {
        amount: transfer.amount,
        recipientName: `${transfer.recipient.firstName} ${transfer.recipient.lastName}`,
        reference,
        reason,
      }),
      'Transfer rejected'
    );
  }

  res.status(200).json({ success: true, message: 'Transfer rejected. Sender wallet has been refunded.' });
};

// ─────────────────────────────────────────────
// ADMIN — Wallet overview
// ─────────────────────────────────────────────

exports.adminGetWalletStats = async (req, res) => {
  const [
    balancesByCurrency, totalUsers,
    pendingPayouts, pendingTransfers,
    todayCredits, todayDebits,
  ] = await Promise.all([
    // Grouped by currency instead of a single sum — a raw sum across NGN,
    // GHS, and XOF wallets would be a meaningless number once non-NG
    // wallets exist.
    prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true }, _count: true }),
    prisma.wallet.count(),
    prisma.payout.count({ where: { status: 'PENDING' } }),
    // FIX: count from Transfer table instead of WalletTransaction description heuristic
    prisma.transfer.count({ where: { status: 'PENDING' } }),
    prisma.walletTransaction.aggregate({
      where: { type: 'CREDIT', status: 'COMPLETED', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _sum:  { amount: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { type: 'DEBIT', status: 'COMPLETED', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _sum:  { amount: true },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      balancesByCurrency: balancesByCurrency.map(b => ({
        currency:    b.currency,
        total:       b._sum.balance ?? 0,
        walletCount: b._count,
      })),
      totalWallets:     totalUsers,
      pendingPayouts,
      pendingTransfers,
      todayCredits:     todayCredits._sum.amount  ?? 0,
      todayDebits:      todayDebits._sum.amount   ?? 0,
    },
  });
};

exports.getDepositLimits = async (req, res) => {
  const [minSetting, maxSetting, wallet, country] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_min' } }),
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_max' } }),
    prisma.wallet.findUnique({ where: { userId: req.user.id }, select: { currency: true } }),
    getCountryForUser(req.user),
  ]);

  res.status(200).json({
    success: true,
    data: {
      min: minSetting?.value ? parseFloat(minSetting.value) : 100,
      max: maxSetting?.value ? parseFloat(maxSetting.value) : 1_000_000,
      currency: wallet?.currency ?? 'NGN',
      paymentProviders: country.paymentProviders ?? ['paystack', 'flutterwave'],
    },
  });
};

// ─────────────────────────────────────────────
// EMAIL TRANSACTION HISTORY
// ─────────────────────────────────────────────

exports.emailTransactionHistory = async (req, res) => {
  const { from, to, type, email } = req.body;

  if (!email || !email.includes('@')) throw new AppError('Valid email address is required', 400);

  const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const toDate   = to   ? new Date(to)   : new Date();
  toDate.setHours(23, 59, 59, 999);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet) throw new AppError('Wallet not found', 404);

  const where = {
    walletId:  wallet.id,
    createdAt: { gte: fromDate, lte: toDate },
  };
  if (type && type !== 'ALL') where.type = type.toUpperCase();

  const transactions = await prisma.walletTransaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  // All HTML generation now lives in email.service.js — controller just
  // hands over the data.
  await emailService.sendTransactionHistoryStatement(email, {
    transactions,
    fromDate,
    toDate,
    type: type || 'ALL',
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  res.status(200).json({
    success: true,
    message: `Transaction history sent to ${email}`,
    data: { count: transactions.length, from: fmtDate(fromDate), to: fmtDate(toDate) },
  });
};

// ─────────────────────────────────────────────
// ADMIN — Wallet Top-Up Visibility & Reconciliation
// ─────────────────────────────────────────────

exports.adminGetTopUps = async (req, res) => {
  const { status = 'PENDING', page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  // Any CREDIT wallet transaction with a provider set is a top-up — no more
  // guessing from the reference string, so we catch every provider/reference
  // format regardless of which flow (initialize/webhook/verify) created it.
  const where = {
    type:     'CREDIT',
    provider: { in: ['paystack', 'flutterwave'] },
  };
  if (status !== 'ALL') where.status = status;

  const [topups, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      include: {
        wallet: {
          select: {
            userId: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip:    parseInt(skip),
      take:    parseInt(limit),
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: { topups, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } },
  });
};

exports.adminReconcileTopUp = async (req, res) => {
  const { id } = req.params;

  const tx = await prisma.walletTransaction.findUnique({
    where:   { id },
    include: { wallet: { select: { id: true, userId: true } } },
  });
  if (!tx) throw new AppError('Top-up record not found', 404);
  if (tx.status === 'COMPLETED') {
    return res.status(200).json({ success: true, message: 'Already credited', data: { transaction: tx } });
  }

  // Always re-verify with the provider before crediting — never trust the
  // admin's word alone that a payment succeeded.
  const provider = tx.provider;
  let verified;
  if (provider === 'paystack') {
    verified = await paymentService.paystackVerify(tx.reference);
    if (verified.status !== 'success') throw new AppError('Paystack has not confirmed this payment as successful', 400);
  } else if (provider === 'flutterwave') {
    verified = await paymentService.flutterwaveVerifyByReference(tx.reference);
    if (verified.status !== 'successful') throw new AppError('Flutterwave has not confirmed this payment as successful', 400);
  } else {
    throw new AppError('Could not determine payment provider from reference', 400);
  }

  const [updatedWallet, updatedTx] = await prisma.$transaction([
    prisma.wallet.update({ where: { id: tx.wallet.id }, data: { balance: { increment: tx.amount } } }),
    prisma.walletTransaction.update({ where: { id: tx.id }, data: { status: 'COMPLETED' } }),
  ]);

  await notificationService.notify({
    userId:  tx.wallet.userId,
    title:   'Wallet Topped Up 💰',
    message: `${formatMoney(tx.amount, updatedWallet.currency)} has been added to your wallet. New balance: ${formatMoney(updatedWallet.balance, updatedWallet.currency)}`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount: tx.amount, newBalance: updatedWallet.balance, reference: tx.reference },
  });

  await logActivity({
    userId:     req.user.id,
    action:     'admin_topup_reconciled',
    entityType: 'WalletTransaction',
    entityId:   tx.id,
    details:    { targetUserId: tx.wallet.userId, amount: tx.amount, provider, reference: tx.reference },
    req,
  });

  res.status(200).json({
    success: true,
    message: `${formatMoney(tx.amount, updatedWallet.currency)} verified with ${provider} and credited.`,
    data:    { wallet: updatedWallet, transaction: updatedTx },
  });
};

module.exports = exports;