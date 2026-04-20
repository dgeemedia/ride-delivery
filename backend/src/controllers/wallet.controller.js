// backend/src/controllers/wallet.controller.js
//
// FIX applied:
//   adminApproveTransfer / adminRejectTransfer — the original located the
//   recipient by regex-parsing the transaction description field:
//     const phoneMatch = senderTx.description.match(/\((\d{10,11})\)/)
//   This is fragile: any description change silently breaks payouts.
//
//   New approach: a dedicated `Transfer` table stores sender/recipient IDs and
//   the reference, making lookups reliable and queryable.
//
//   SCHEMA MIGRATION REQUIRED (add to prisma/schema.prisma):
//   ─────────────────────────────────────────────────────────
//   model Transfer {
//     id          String   @id @default(uuid())
//     reference   String   @unique
//     senderId    String
//     recipientId String
//     amount      Float
//     note        String?
//     status      String   @default("PENDING")  // PENDING | COMPLETED | FAILED
//     createdAt   DateTime @default(now())
//     updatedAt   DateTime @updatedAt
//
//     sender    User @relation("SentTransfers",     fields: [senderId],    references: [id])
//     recipient User @relation("ReceivedTransfers", fields: [recipientId], references: [id])
//   }
//
//   On User model add:
//     sentTransfers     Transfer[] @relation("SentTransfers")
//     receivedTransfers Transfer[] @relation("ReceivedTransfers")
//   ─────────────────────────────────────────────────────────
//   Run: npx prisma migrate dev --name add_transfer_table
//
//   All other functions are unchanged from the previous patch.

const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/payment.service');
const notificationService = require('../services/notification.service');

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

  const amount     = transaction.amount;
  const { userId } = transaction.meta || {};
  const wallet     = await ensureWallet(userId);

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
//
// FIX: Stores sender/recipient IDs in the new `Transfer` table so that
// adminApproveTransfer and adminRejectTransfer can look up the recipient
// by ID instead of regex-parsing the description string.
// ─────────────────────────────────────────────

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

  // Deduct from sender immediately (hold) — create Transfer record + PENDING DEBIT
  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: req.user.id },
      data:  { balance: { decrement: amount } },
    }),
    // FIX: store structured Transfer row (no more description-parsing)
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
    // Sender DEBIT — description is human-readable only, not load-bearing
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

  // Notify sender
  await notificationService.notify({
    userId:  req.user.id,
    title:   'Transfer Pending ⏳',
    message: `₦${amount.toLocaleString('en-NG')} transfer to ${recipient.firstName} ${recipient.lastName} is pending admin approval.`,
    type:    notificationService.TYPES.PAYMENT_RECEIVED,
    data:    { amount, recipientId: recipient.id, reference },
  });

  // Notify admins
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
  let paystackOk    = false;

  try {
    const recipient = await paymentService.paystackCreateTransferRecipient({
      name:          payout.accountName,
      accountNumber: payout.accountNumber,
      bankCode:      payout.bankCode,
    });
    const transfer = await paymentService.paystackInitiateTransfer({
      amount:    payout.amount * 100,
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
      paystack:    paystackOk ? 'ok' : 'failed',
      transferCode,
      ...(transferError && { transferError }),
    },
  });
};

exports.adminRejectPayout = async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  const payout = await prisma.payout.findUnique({ where: { id } });
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

/**
 * FIX: look up Transfer row by reference — no regex on description.
 */
exports.adminApproveTransfer = async (req, res) => {
  const { reference } = req.params;
  const { note }      = req.body;

  // FIX: structured lookup via Transfer table
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
    // Mark Transfer COMPLETED
    prisma.transfer.update({ where: { reference }, data: { status: 'COMPLETED' } }),
    // Mark sender DEBIT tx COMPLETED
    prisma.walletTransaction.updateMany({
      where: { reference, type: 'DEBIT', status: 'PENDING' },
      data:  { status: 'COMPLETED' },
    }),
    // Credit recipient wallet
    prisma.wallet.update({ where: { userId: transfer.recipientId }, data: { balance: { increment: transfer.amount } } }),
    // Create recipient CREDIT tx
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

  res.status(200).json({ success: true, message: 'Transfer approved. Recipient has been credited.' });
};

/**
 * FIX: look up Transfer row by reference — no regex on description.
 */
exports.adminRejectTransfer = async (req, res) => {
  const { reference } = req.params;
  const { reason }    = req.body;

  // FIX: structured lookup via Transfer table
  const transfer = await prisma.transfer.findUnique({
    where:   { reference },
    include: { sender: { include: { wallet: true } } },
  });
  if (!transfer)                    throw new AppError('Transfer not found', 404);
  if (transfer.status !== 'PENDING') throw new AppError('Transfer already processed', 400);

  await prisma.$transaction([
    // Mark Transfer FAILED
    prisma.transfer.update({ where: { reference }, data: { status: 'FAILED' } }),
    // Refund sender balance
    prisma.wallet.update({
      where: { userId: transfer.senderId },
      data:  { balance: { increment: transfer.amount } },
    }),
    // Mark sender DEBIT tx FAILED
    prisma.walletTransaction.updateMany({
      where: { reference, type: 'DEBIT', status: 'PENDING' },
      data:  { status: 'FAILED' },
    }),
    // Create REFUND tx for sender
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

  await notificationService.notify({
    userId:  transfer.senderId,
    title:   'Transfer Rejected',
    message: `Your transfer of ₦${transfer.amount.toLocaleString('en-NG')} was rejected. Funds have been returned to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { reference, amount: transfer.amount, reason },
  });

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

module.exports = exports;