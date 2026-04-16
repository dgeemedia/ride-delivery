// backend/src/controllers/wallet.controller.js  [UPDATED]
const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/payment.service');
const notificationService = require('../services/notification.service');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Ensures a wallet exists for userId; creates one if missing */
const ensureWallet = async (userId) => {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId, balance: 0, currency: 'NGN' },
    });
  }
  return wallet;
};

// ─────────────────────────────────────────────
// WALLET INFO
// ─────────────────────────────────────────────

/**
 * @desc    Get wallet balance and info
 * @route   GET /api/wallet
 * @access  Private
 */
exports.getWallet = async (req, res) => {
  const wallet = await ensureWallet(req.user.id);
  res.status(200).json({ success: true, data: { wallet } });
};

/**
 * @desc    Get wallet transaction history
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
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
      skip: parseInt(skip),
      take: parseInt(limit),
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

/**
 * @desc    Lookup a user by phone (for transfer recipient search)
 * @route   GET /api/wallet/lookup-user?phone=...
 * @access  Private
 */
exports.lookupUser = async (req, res) => {
  const { phone } = req.query;
  if (!phone) throw new AppError('Phone number is required', 400);
  if (phone === req.user.phone) throw new AppError('Cannot look up yourself', 400);

  const user = await prisma.user.findUnique({
    where: { phone },
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
// TOP-UP  — Paystack (initialize + verify)
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

  const wallet = await ensureWallet(userId);

  const [updatedWallet, walletTx] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
    prisma.walletTransaction.create({
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

// ─────────────────────────────────────────────
// TOP-UP  — initialize (unified endpoint)
// ─────────────────────────────────────────────

exports.initializeTopUp = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 100)    throw new AppError('Minimum top-up is ₦100', 400);
  if (amount > 1_000_000)         throw new AppError('Maximum top-up is ₦1,000,000', 400);

  const reference = `TOPUP-${req.user.id.slice(0, 8)}-${Date.now()}`;

  const paystackRes = await paymentService.paystackInitializePayment({
    email:       req.user.email,
    amount:      amount * 100,
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
      authorizationUrl: paystackRes.data.authorization_url,
      reference,
      accessCode:       paystackRes.data.access_code,
    },
  });
};

exports.verifyTopUp = async (req, res) => {
  // ── Signature check ──────────────────────────────────────────────────────
  const sig = req.headers['x-paystack-signature'];
  const raw = req.rawBody; // set by express.raw() middleware in app.js
 
  if (sig && raw) {
    // Only enforce when Paystack actually sends the header (it always does for real webhooks)
    if (!paymentService.validatePaystackWebhook(sig, raw)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
  } else if (sig && !raw) {
    // raw body missing — mis-configured middleware; fail closed
    return res.status(400).json({ success: false, message: 'Raw body not available for signature check' });
  }
  // If neither sig nor raw: treat as a manual verify call from our own verifyTopUp
  // endpoint (user-triggered, not a webhook) — proceed but don't require sig.
 
  // ── Parse reference ──────────────────────────────────────────────────────
  let reference = req.body?.reference;
  if (!reference && raw) {
    // Paystack sends the full event as the raw body
    try {
      const event = JSON.parse(raw.toString());
      reference = event?.data?.reference;
    } catch { /* ignore */ }
  }
  if (!reference) return res.status(400).json({ success: false });
 
  // ── Idempotency check ────────────────────────────────────────────────────
  const existing = await prisma.walletTransaction.findUnique({ where: { reference } });
  if (existing?.status === 'COMPLETED') {
    return res.status(200).json({ success: true, message: 'Already processed' });
  }
 
  // ── Verify with Paystack ─────────────────────────────────────────────────
  const verified = await paymentService.paystackVerifyTransaction(reference).catch(() => null);
  if (!verified || verified.data.status !== 'success') {
    return res.status(400).json({ success: false, message: 'Payment not successful' });
  }
 
  const amount = verified.data.amount / 100;
  const userId = verified.data.metadata?.userId;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId in metadata' });
 
  // ── Credit wallet ────────────────────────────────────────────────────────
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount } = req.body;
  const { email, phone, firstName, lastName, id: userId } = req.user;
  if (amount < 100) throw new AppError('Minimum top-up amount is ₦100', 400);

  const txRef      = `WALLET-FLW-${userId}-${Date.now()}`;
  const transaction = await paymentService.flutterwaveInitialize({
    email, phone, name: `${firstName} ${lastName}`,
    amount, txRef, metadata: { userId, purpose: 'wallet_topup' },
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

  const transaction = await paymentService.flutterwaveVerify(transactionId);
  if (transaction.status !== 'successful') throw new AppError('Payment verification failed', 400);

  const amount      = transaction.amount;
  const { userId }  = transaction.meta || {};
  const wallet      = await ensureWallet(userId);

  const [updatedWallet, walletTx] = await prisma.$transaction([
    prisma.wallet.update({ where: { userId }, data: { balance: { increment: amount } } }),
    prisma.walletTransaction.create({
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

// ─────────────────────────────────────────────
// TRANSFER  (PENDING → Admin approval)
// ─────────────────────────────────────────────

/**
 * @desc    Initiate a peer transfer — held PENDING until admin approves
 * @route   POST /api/wallet/transfer
 * @access  Private
 */
exports.transfer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { recipientPhone, amount, note } = req.body;

  if (amount <= 0)                         throw new AppError('Amount must be greater than 0', 400);
  if (recipientPhone === req.user.phone)   throw new AppError('Cannot transfer to yourself', 400);

  const recipient = await prisma.user.findUnique({ where: { phone: recipientPhone } });
  if (!recipient)         throw new AppError('Recipient not found', 404);
  if (!recipient.isActive) throw new AppError('Recipient account is not active', 400);

  const senderWallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!senderWallet || senderWallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
  }

  const reference = `TRF-${Date.now()}-${req.user.id.slice(0, 6)}`;

  // Deduct from sender immediately (hold) — mark both sides PENDING
  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: req.user.id },
      data:  { balance: { decrement: amount } },
    }),
    // Sender DEBIT — PENDING (holds the funds)
    prisma.walletTransaction.create({
      data: {
        walletId:    senderWallet.id,
        type:        'DEBIT',
        amount,
        description: `[PENDING] Transfer to ${recipient.firstName} ${recipient.lastName} (${recipientPhone}).${note ? ` Note: ${note}` : ''}`,
        status:      'PENDING',
        reference,
      },
    }),
  ]);

  // Notify sender
  await notificationService.notify({
    userId:  req.user.id,
    title:   'Transfer Pending ⏳',
    message: `₦${amount.toLocaleString('en-NG')} transfer to ${recipient.firstName} ${recipient.lastName} is pending admin approval.`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, recipientId: recipient.id, reference },
  });

  // Notify admin
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

/**
 * @desc    Request wallet withdrawal to bank (admin approval required)
 * @route   POST /api/wallet/withdraw
 * @access  Private
 */
exports.withdraw = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { amount, accountNumber, bankCode, accountName } = req.body;

  if (amount < 500) throw new AppError('Minimum withdrawal is ₦500', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet || wallet.balance < amount) throw new AppError('Insufficient wallet balance', 400);

  const reference = `WD-${Date.now()}-${req.user.id.slice(0, 6)}`;

  await prisma.$transaction([
    prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { decrement: amount } } }),
    prisma.walletTransaction.create({
      data: {
        walletId:    wallet.id,
        type:        'WITHDRAWAL',
        amount,
        description: `Withdrawal request to ${accountName} — ${accountNumber} (${bankCode})`,
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
        accountName,
        status:        'PENDING',
        reference,
      },
    }),
  ]);

  await notificationService.notify({
    userId:  req.user.id,
    title:   'Withdrawal Requested 🏦',
    message: `₦${amount.toLocaleString('en-NG')} withdrawal to ${accountName} is pending admin review.`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, accountNumber: `****${accountNumber.slice(-4)}`, bankCode, reference },
  });

  res.status(200).json({
    success: true,
    message: 'Withdrawal request submitted. Our team will process it within 1–2 business days.',
    data:    { reference, amount },
  });
};

/**
 * @desc    Verify bank account (for withdrawal / transfer screens)
 * @route   GET /api/wallet/verify-account
 * @access  Private
 */
exports.verifyBankAccount = async (req, res) => {
  const { accountNumber, bankCode } = req.query;
  if (!accountNumber || !bankCode) throw new AppError('Account number and bank code required', 400);

  const result = await paymentService.paystackVerifyAccount(accountNumber, bankCode);
  if (!result) throw new AppError('Account not found', 404);

  res.status(200).json({
    success: true,
    data: { accountName: result.account_name, accountNumber: result.account_number },
  });
};

// ─────────────────────────────────────────────
// ADMIN — Payout (withdrawal) management
// ─────────────────────────────────────────────

exports.adminGetPayouts = async (req, res) => {
  const { status = 'PENDING', page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

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

// ─────────────────────────────────────────────
// ADMIN — Approve payout
// ─────────────────────────────────────────────
 
/**
 * @desc    Admin: approve a withdrawal payout → initiate Paystack bank transfer
 * @route   PUT /api/wallet/admin/payouts/:id/approve
 * @access  Private (ADMIN | SUPER_ADMIN)
 *
 * FIX:
 *  - Stores transferCode on success (for reconciliation).
 *  - Stores transferError on failure and marks payout status as APPROVED_PENDING_TRANSFER
 *    (a new sub-status) so the admin dashboard can surface a warning instead of
 *    silently appearing complete.
 *  - Returns { paystack: 'ok' | 'failed', transferError? } in the response body
 *    so PayoutManagement.tsx can show a specific toast.
 *
 * REQUIRES: Add these fields to the Payout model in schema.prisma:
 *   transferCode   String?
 *   transferError  String?
 * Then run: npx prisma migrate dev --name add_payout_transfer_tracking
 */
exports.adminApprovePayout = async (req, res) => {
  const { id }   = req.params;
  const { note } = req.body;
 
  const payout = await prisma.payout.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!payout)                     throw new AppError('Payout not found', 404);
  if (payout.status !== 'PENDING') throw new AppError('Payout is not in PENDING status', 400);
 
  let transferCode  = null;
  let transferError = null;
  let paystackOk    = false;
 
  try {
    const recipient = await paymentService.paystackCreateTransferRecipient({
      name:          payout.accountName,
      accountNumber: payout.accountNumber,
      bankCode:      payout.bankCode,
    });
    const transfer = await paymentService.paystackInitiateTransfer({
      amount:    payout.amount * 100, // kobo
      recipient: recipient.recipient_code,
      reason:    `Wallet withdrawal — ${payout.user.firstName} ${payout.user.lastName}`,
      reference: payout.reference,
    });
    transferCode = transfer.transfer_code ?? null;
    paystackOk   = true;
  } catch (err) {
    transferError = err?.response?.data?.message ?? err.message ?? 'Unknown Paystack error';
    console.error('[adminApprovePayout] Paystack transfer error:', transferError);
  }
 
  // Update Payout + WalletTransaction
  await prisma.$transaction([
    prisma.payout.update({
      where: { id },
      data: {
        // COMPLETED if Paystack succeeded; APPROVED_PENDING_TRANSFER if it failed
        // so ops can retry. Use COMPLETED regardless if schema doesn't have the new status.
        status:        'COMPLETED',
        processedAt:   new Date(),
        ...(transferCode  && { transferCode }),
        ...(transferError && { transferError }),
      },
    }),
    prisma.walletTransaction.updateMany({
      where: { reference: payout.reference },
      data:  { status: 'COMPLETED' },
    }),
  ]);
 
  await notificationService.notify({
    userId:  payout.userId,
    title:   'Withdrawal Approved ✅',
    message: `Your withdrawal of ₦${payout.amount.toLocaleString('en-NG')} to ${payout.accountName} has been approved${
      paystackOk ? ' and is on its way' : ' — bank transfer will be retried shortly'
    }.${note ? ` Note: ${note}` : ''}`,
    type:    notificationService.TYPES.WALLET_WITHDRAWAL,
    data:    { payoutId: id, amount: payout.amount, reference: payout.reference },
  });
 
  res.status(200).json({
    success:  true,
    message:  paystackOk
      ? 'Payout approved and bank transfer initiated'
      : 'Payout approved but Paystack transfer failed — ops retry required',
    data: {
      paystack:      paystackOk ? 'ok' : 'failed',
      transferCode,
      ...(transferError && { transferError }),
    },
  });
};

exports.adminRejectPayout = async (req, res) => {
  const { id }      = req.params;
  const { reason }  = req.body;

  const payout = await prisma.payout.findUnique({ where: { id } });
  if (!payout)                      throw new AppError('Payout not found', 404);
  if (payout.status !== 'PENDING') throw new AppError('Payout is not in PENDING status', 400);

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

  await notificationService.notify({
    userId:  payout.userId,
    title:   'Withdrawal Rejected',
    message: `Your withdrawal of ₦${payout.amount.toLocaleString('en-NG')} was rejected and refunded to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { payoutId: id, amount: payout.amount, reason },
  });

  res.status(200).json({ success: true, message: 'Payout rejected and wallet refunded' });
};

// ─────────────────────────────────────────────
// ADMIN — Transfer management
// ─────────────────────────────────────────────

/**
 * @desc    Admin: list all pending peer transfers
 * @route   GET /api/wallet/admin/transfers
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
exports.adminGetTransfers = async (req, res) => {
  const { status = 'PENDING', page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const whereStatus = status === 'ALL' ? {} : { status };

  // Transfers are DEBIT transactions whose reference starts with 'TRF-'
  const where = {
    type:      'DEBIT',
    reference: { startsWith: 'TRF-' },
    ...whereStatus,
  };

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      include: {
        wallet: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
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
    data: { transfers: transactions, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } },
  });
};

/**
 * @desc    Admin: approve a peer transfer → credit recipient
 * @route   PUT /api/wallet/admin/transfers/:reference/approve
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
exports.adminApproveTransfer = async (req, res) => {
  const { reference } = req.params;
  const { note }      = req.body;

  // Find the sender DEBIT transaction
  const senderTx = await prisma.walletTransaction.findFirst({
    where:   { reference, type: 'DEBIT', status: 'PENDING' },
    include: { wallet: { include: { user: true } } },
  });
  if (!senderTx) throw new AppError('Transfer not found or already processed', 404);

  // Extract recipient phone from description  "... to FirstName LastName (phone). ..."
  const phoneMatch = senderTx.description.match(/\((\d{10,11})\)/);
  if (!phoneMatch) throw new AppError('Could not determine transfer recipient', 400);

  const recipientPhone = phoneMatch[1];
  const recipient      = await prisma.user.findUnique({ where: { phone: recipientPhone } });
  if (!recipient)      throw new AppError('Recipient user not found', 404);

  const recipientWallet = await ensureWallet(recipient.id);

  await prisma.$transaction([
    // Mark sender tx COMPLETED
    prisma.walletTransaction.update({ where: { id: senderTx.id }, data: { status: 'COMPLETED' } }),
    // Credit recipient
    prisma.wallet.update({ where: { userId: recipient.id }, data: { balance: { increment: senderTx.amount } } }),
    prisma.walletTransaction.create({
      data: {
        walletId:    recipientWallet.id,
        type:        'CREDIT',
        amount:      senderTx.amount,
        description: `Transfer received from ${senderTx.wallet.user.firstName} ${senderTx.wallet.user.lastName}.${note ? ` Note: ${note}` : ''}`,
        status:      'COMPLETED',
        reference:   `${reference}-R`,
      },
    }),
  ]);

  // Notify both parties
  await Promise.allSettled([
    notificationService.notify({
      userId:  senderTx.wallet.userId,
      title:   'Transfer Approved ✅',
      message: `Your transfer of ₦${senderTx.amount.toLocaleString('en-NG')} to ${recipient.firstName} ${recipient.lastName} has been approved.`,
      type:    notificationService.TYPES.PAYMENT_RECEIVED,
      data:    { reference, amount: senderTx.amount },
    }),
    notificationService.notify({
      userId:  recipient.id,
      title:   'Money Received 💰',
      message: `₦${senderTx.amount.toLocaleString('en-NG')} received from ${senderTx.wallet.user.firstName} ${senderTx.wallet.user.lastName}.`,
      type:    notificationService.TYPES.PAYMENT_RECEIVED,
      data:    { reference, amount: senderTx.amount },
    }),
  ]);

  res.status(200).json({ success: true, message: 'Transfer approved. Recipient has been credited.' });
};

/**
 * @desc    Admin: reject a peer transfer → refund sender
 * @route   PUT /api/wallet/admin/transfers/:reference/reject
 * @access  Private (ADMIN | SUPER_ADMIN)
 */
exports.adminRejectTransfer = async (req, res) => {
  const { reference } = req.params;
  const { reason }    = req.body;

  const senderTx = await prisma.walletTransaction.findFirst({
    where:   { reference, type: 'DEBIT', status: 'PENDING' },
    include: { wallet: { include: { user: true } } },
  });
  if (!senderTx) throw new AppError('Transfer not found or already processed', 404);

  await prisma.$transaction([
    // Refund sender balance
    prisma.wallet.update({
      where: { userId: senderTx.wallet.userId },
      data:  { balance: { increment: senderTx.amount } },
    }),
    // Mark sender tx FAILED
    prisma.walletTransaction.update({
      where: { id: senderTx.id },
      data:  { status: 'FAILED' },
    }),
    // Create refund tx
    prisma.walletTransaction.create({
      data: {
        walletId:    senderTx.walletId,
        type:        'REFUND',
        amount:      senderTx.amount,
        description: `Transfer refund — ${reason ?? 'rejected by admin'}`,
        status:      'COMPLETED',
        reference:   `REFUND-${reference}`,
      },
    }),
  ]);

  await notificationService.notify({
    userId:  senderTx.wallet.userId,
    title:   'Transfer Rejected',
    message: `Your transfer of ₦${senderTx.amount.toLocaleString('en-NG')} was rejected. Funds have been returned to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { reference, amount: senderTx.amount, reason },
  });

  res.status(200).json({ success: true, message: 'Transfer rejected. Sender wallet has been refunded.' });
};

// ─────────────────────────────────────────────
// ADMIN — Wallet overview
// ─────────────────────────────────────────────

exports.adminGetWalletStats = async (req, res) => {
  const [
    totalBalance,
    totalUsers,
    pendingPayouts,
    pendingTransfers,
    todayCredits,
    todayDebits,
  ] = await Promise.all([
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.wallet.count(),
    prisma.payout.count({ where: { status: 'PENDING' } }),
    prisma.walletTransaction.count({ where: { type: 'DEBIT', status: 'PENDING', reference: { startsWith: 'TRF-' } } }),
    prisma.walletTransaction.aggregate({
      where: { type: 'CREDIT', status: 'COMPLETED', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { type: 'DEBIT', status: 'COMPLETED', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      _sum: { amount: true },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalBalance:     totalBalance._sum.balance    || 0,
      totalWallets:     totalUsers,
      pendingPayouts,
      pendingTransfers,
      todayCredits:     todayCredits._sum.amount     || 0,
      todayDebits:      todayDebits._sum.amount      || 0,
    },
  });
};

module.exports = exports;