// backend/src/controllers/wallet.controller.js

const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/payment.service');
const notificationService = require('../services/notification.service');
const emailService = require('../services/email.service');
const { logActivity } = require('../utils/auditLog'); // ← ADDED

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const ensureWallet = async (userId) => {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, balance: 0, currency: 'NGN' },
    });
  }
  return wallet;
};

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
  const { phone } = req.query;
  if (!phone) throw new AppError('Phone number is required', 400);
  if (phone === req.user.phone) throw new AppError('Cannot look up yourself', 400);

  const user = await prisma.user.findUnique({
    where:  { phone },
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
  if (amount < 100) throw new AppError('Minimum top-up amount is ₦100', 400);

  const transaction = await paymentService.paystackInitialize({
    email:    req.user.email,
    amount,
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

  const transaction = await paymentService.paystackVerify(reference);
  if (transaction.status !== 'success') throw new AppError('Payment verification failed', 400);

  const amount   = transaction.amount / 100;
  const { userId } = transaction.metadata;
  const wallet   = await ensureWallet(userId);

  const [updatedWallet, walletTx] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
    existing
      ? prisma.walletTransaction.update({
          where: { id: existing.id },
          data: {
            status:      'COMPLETED',
            amount,
            description: 'Wallet top-up via Paystack',
          },
        })
      : prisma.walletTransaction.create({
          data: {
            walletId:    wallet.id,
            type:        'CREDIT',
            amount,
            description: 'Wallet top-up via Paystack',
            status:      'COMPLETED',
            reference,
          },
        }),
  ]);

  await notificationService.notify({
    userId,
    title:   'Wallet Topped Up 💰',
    message: `₦${amount.toFixed(2)} has been added to your wallet. New balance: ₦${updatedWallet.balance.toFixed(2)}`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, newBalance: updatedWallet.balance, reference },
  });

  res.status(200).json({ success: true, message: 'Wallet topped up successfully', data: { wallet: updatedWallet, transaction: walletTx } });
};

exports.initializeTopUp = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 100) throw new AppError('Minimum top-up is ₦100', 400);

  // ── Fetch admin-configured limits from SystemSettings ──
  const [minSetting, maxSetting] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_min' } }),
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_max' } }),
  ]);

  const minDeposit = minSetting?.value ? parseFloat(minSetting.value) : 100;
  const maxDeposit = maxSetting?.value ? parseFloat(maxSetting.value) : 1_000_000;

  if (amount < minDeposit)
    throw new AppError(`Minimum top-up is ₦${minDeposit.toLocaleString('en-NG')}`, 400);
  if (amount > maxDeposit)
    throw new AppError(`Maximum top-up is ₦${maxDeposit.toLocaleString('en-NG')}`, 400);

  const reference = `TOPUP-${req.user.id.slice(0, 8)}-${Date.now()}`;

  const paystackRes = await paymentService.paystackInitialize({
    email:       req.user.email,
    amount,    
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

  await prisma.$transaction([
    prisma.wallet.upsert({
      where:  { userId },
      update: { balance: { increment: amount } },
      create: { userId, balance: amount },
    }),
    prisma.walletTransaction.updateMany({
      where: { reference },
      data:  { status: 'COMPLETED' },
    }),
  ]);

  await notificationService.notify({
    userId,
    title:   'Wallet Credited 💰',
    message: `₦${amount.toLocaleString('en-NG')} added to your wallet. Ref: ${reference}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { amount, reference },
  });

  res.status(200).json({ success: true });
};

// ─────────────────────────────────────────────
// TOP-UP — Flutterwave
// ─────────────────────────────────────────────

exports.flutterwaveTopup = async (req, res) => {
  const { amount } = req.body;
  const { email, phone, firstName, lastName, id: userId } = req.user;
  
  if (amount < 100) throw new AppError('Minimum top-up amount is ₦100', 400);

  const txRef = `WALLET-FLW-${userId}-${Date.now()}`;
  const transaction = await paymentService.flutterwaveInitialize({
    email,
    phone:    phone || '',          // ← guard: phone may not be on req.user
    name:     `${firstName} ${lastName}`,
    amount,
    txRef,
    metadata: { userId, purpose: 'wallet_topup' },
  });

  // Pre-create a PENDING record so admins can see — and reconcile — this
  // top-up even if the customer never comes back to verify it.
  const wallet = await ensureWallet(userId);
  await prisma.walletTransaction.create({
    data: {
      walletId:    wallet.id,
      type:        'CREDIT',
      amount,
      description: 'Wallet top-up via Flutterwave',
      status:      'PENDING',
      reference:   txRef,
    },
  });

  res.status(200).json({ success: true, data: { paymentLink: transaction.link, txRef } });
};

exports.verifyFlutterwaveTopup = async (req, res) => {
  const { transactionId } = req.body;
  if (!transactionId) throw new AppError('Transaction ID is required', 400);

  const existing = await prisma.walletTransaction.findFirst({ where: { reference: String(transactionId) } });
  if (existing?.status === 'COMPLETED') {
    return res.status(200).json({ success: true, message: 'Already processed', data: { transaction: existing } });
  }

  // transactionId here is actually the tx_ref generated at initialize time
  // (WALLET-FLW-...), not Flutterwave's internal numeric id — verify by reference.
  const transaction = await paymentService.flutterwaveVerifyByReference(transactionId);
  if (transaction.status !== 'successful') throw new AppError('Payment verification failed', 400);

  const amount     = transaction.amount;
  const { userId } = transaction.meta || {};
  const wallet     = await ensureWallet(userId);

  const [updatedWallet, walletTx] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
    existing
      ? prisma.walletTransaction.update({
          where: { id: existing.id },
          data:  { status: 'COMPLETED', amount },
        })
      : prisma.walletTransaction.create({
          data: {
            walletId:    wallet.id,
            type:        'CREDIT',
            amount,
            description: 'Wallet top-up via Flutterwave',
            status:      'COMPLETED',
            reference:   String(transactionId),
          },
        }),
  ]);

  await notificationService.notify({
    userId,
    title:   'Wallet Topped Up 💰',
    message: `₦${amount.toFixed(2)} has been added to your wallet. New balance: ₦${updatedWallet.balance.toFixed(2)}`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, newBalance: updatedWallet.balance },
  });

  res.status(200).json({ success: true, message: 'Wallet topped up successfully', data: { wallet: updatedWallet, transaction: walletTx } });
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
  if (!senderWallet || senderWallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
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

  // ← ADDED — a self-initiated transfer already debits the sender's wallet
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
    message: `₦${amount.toLocaleString('en-NG')} transfer to ${recipient.firstName} ${recipient.lastName} is pending admin approval.`,
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
        message: `${req.user.firstName} ${req.user.lastName} → ${recipient.firstName} ${recipient.lastName}: ₦${amount.toLocaleString('en-NG')}`,
        type:    'transfer_pending',
        data:    { reference, senderId: req.user.id, recipientId: recipient.id, amount },
      })
    )
  );

  res.status(200).json({
    success: true,
    message: `Transfer of ₦${amount.toFixed(2)} submitted and pending admin approval. Funds held from your balance.`,
    data:    { reference, amount, recipientName: `${recipient.firstName} ${recipient.lastName}` },
  });
};

// ─────────────────────────────────────────────
// WITHDRAWAL (bank payout — admin approval flow)
// ─────────────────────────────────────────────

exports.withdraw = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount, accountNumber, bankCode, accountName } = req.body;

  if (amount < 500) throw new AppError('Minimum withdrawal is ₦500', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet || wallet.balance < amount) throw new AppError('Insufficient wallet balance', 400);

  const reference = `WD-${Date.now()}-${req.user.id.slice(0, 6)}`;

  // Auto-resolved from whichever provider is currently active — no client change needed.
  const bankName = await paymentService.resolveBankName(bankCode);

  // ← CHANGED — capture the transaction results (was previously discarded)
  // so we can attach the created Payout's id to the audit log entry below.
  const [, , payoutRecord] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { decrement: amount } } }),
    prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'WITHDRAWAL',
        amount,
        description: `Withdrawal request to ${accountName} — ${accountNumber} (${bankName || bankCode})`,
        status:      'PENDING',
        reference,
      },
    }),
    prisma.payout.create({
      data: {
        userId:        req.user.id,
        amount,
        accountNumber,
        bankCode,
        bankName,
        accountName,
        status:        'PENDING',
        reference,
      },
    }),
  ]);

  // ← ADDED — same action name used by driver.controller.js/partner.controller.js's
  // requestPayout (this is the generic/customer-facing equivalent), with
  // role read dynamically since this endpoint isn't role-restricted.
  logActivity({
    userId:     req.user.id,
    action:     'payout_requested',
    entityType: 'Payout',
    entityId:   payoutRecord.id,
    details: {
      role:          req.user.role,
      amount,
      bankCode,
      accountNumber: `****${accountNumber.slice(-4)}`,
      reference,
    },
    req,
  });

  await notificationService.notify({
    userId:  req.user.id,
    title:   'Withdrawal Requested 🏦',
    message: `₦${amount.toLocaleString('en-NG')} withdrawal to ${accountName} is pending admin review.`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, accountNumber: `****${accountNumber.slice(-4)}`, bankCode, reference },
  });

  if (req.user.email) {
    await safeSendEmail(
      () => emailService.sendWithdrawalUnderReviewEmail(req.user.email, req.user.firstName, {
        amount, reference, accountName, accountNumber,
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

  const result = await paymentService.verifyBankAccountUnified(accountNumber, bankCode);
  if (!result) throw new AppError('Account not found', 404);

  res.status(200).json({
    success: true,
    data: { accountName: result.account_name, accountNumber: result.account_number },
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
  let provider      = paymentService.getActivePayoutProvider();

  try {
    const result = await paymentService.initiatePayoutTransfer({
      amount:        payout.amount,
      accountNumber: payout.accountNumber,
      bankCode:      payout.bankCode,
      accountName:   payout.accountName,
      reason:        `Wallet withdrawal — ${payout.user.firstName} ${payout.user.lastName}`,
      reference:     payout.reference,
    });
    transferCode = result.transferCode;
    provider     = result.provider;
    providerOk   = true;
  } catch (err) {
    transferError = err?.response?.data?.message ?? err.message ?? 'Unknown transfer error';
    console.error(`[adminApprovePayout] ${provider} transfer error:`, transferError);
  }

  await prisma.$transaction([
    prisma.payout.update({
      where: { id },
      data: {
        status:       'COMPLETED',
        processedAt:  new Date(),
        ...(transferCode  && { transferCode }),
        ...(transferError && { transferError }),
      },
    }),
    prisma.walletTransaction.updateMany({
      where: { reference: payout.reference },
      data:  { status: 'COMPLETED' },
    }),
  ]);

  // ← ADDED — this is the single most important audit entry in this file:
  // approving a payout triggers a REAL, irreversible external bank transfer.
  // This action previously had zero ActivityLog coverage anywhere.
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
    message: `Your withdrawal of ₦${payout.amount.toLocaleString('en-NG')} to ${payout.accountName} has been approved${
      providerOk ? ' and is on its way' : ' — bank transfer will be retried shortly'
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
      : `Payout approved but ${provider} transfer failed — ops retry required`,
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

  // ← ADDED
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
    message: `Your withdrawal of ₦${payout.amount.toLocaleString('en-NG')} was rejected and refunded to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
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

  // ← ADDED — an admin decision that moves money from one user's wallet to
  // another's. Same risk class as admin.controller.js's wallet_credit /
  // wallet_debit (already CRITICAL there) — this had no equivalent here.
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
      message: `Your transfer of ₦${transfer.amount.toLocaleString('en-NG')} to ${transfer.recipient.firstName} ${transfer.recipient.lastName} has been approved.`,
      type:    notificationService.TYPES.PAYMENT_RECEIVED,
      data:    { reference, amount: transfer.amount },
    }),
    notificationService.notify({
      userId:  transfer.recipientId,
      title:   'Money Received 💰',
      message: `₦${transfer.amount.toLocaleString('en-NG')} received from ${transfer.sender.firstName} ${transfer.sender.lastName}.`,
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
        walletId:    transfer.sender.wallet.id,
        type:        'REFUND',
        amount:      transfer.amount,
        description: `Transfer refund — ${reason ?? 'rejected by admin'}`,
        status:      'COMPLETED',
        reference:   `REFUND-${reference}`,
      },
    }),
  ]);

  // ← ADDED
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
    message: `Your transfer of ₦${transfer.amount.toLocaleString('en-NG')} was rejected. Funds have been returned to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
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
    totalBalance, totalUsers,
    pendingPayouts, pendingTransfers,
    todayCredits, todayDebits,
  ] = await Promise.all([
    prisma.wallet.aggregate({ _sum: { balance: true } }),
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
      totalBalance:     totalBalance._sum.balance ?? 0,
      totalWallets:     totalUsers,
      pendingPayouts,
      pendingTransfers,
      todayCredits:     todayCredits._sum.amount  ?? 0,
      todayDebits:      todayDebits._sum.amount   ?? 0,
    },
  });
};

exports.getDepositLimits = async (req, res) => {
  const [minSetting, maxSetting] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_min' } }),
    prisma.systemSettings.findUnique({ where: { key: 'wallet_topup_max' } }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      min: minSetting?.value ? parseFloat(minSetting.value) : 100,
      max: maxSetting?.value ? parseFloat(maxSetting.value) : 1_000_000,
      currency: 'NGN',
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

// Reference prefixes tell us which provider a top-up went through
// without needing a separate `provider` column on WalletTransaction.
const detectTopUpProvider = (reference = '') => {
  if (reference.startsWith('TOPUP-'))      return 'paystack';
  if (reference.startsWith('WALLET-FLW-')) return 'flutterwave';
  return 'unknown';
};

exports.adminGetTopUps = async (req, res) => {
  const { status = 'PENDING', page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const where = {
    type: 'CREDIT',
    OR: [
      { reference: { startsWith: 'TOPUP-' } },
      { reference: { startsWith: 'WALLET-FLW-' } },
    ],
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

  const enriched = topups.map(t => ({ ...t, provider: detectTopUpProvider(t.reference) }));

  res.status(200).json({
    success: true,
    data: { topups: enriched, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } },
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
  const provider = detectTopUpProvider(tx.reference);
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
    message: `₦${tx.amount.toLocaleString('en-NG')} has been added to your wallet. New balance: ₦${updatedWallet.balance.toLocaleString('en-NG')}`,
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
    message: `₦${tx.amount.toLocaleString('en-NG')} verified with ${provider} and credited.`,
    data:    { wallet: updatedWallet, transaction: updatedTx },
  });
};

module.exports = exports;
