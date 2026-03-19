// backend/src/controllers/wallet.controller.js
const prisma = require('../lib/prisma');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/payment.service');
const notificationService = require('../services/notification.service');

/**
 * @desc    Get wallet balance and info
 * @route   GET /api/wallet
 * @access  Private
 */
exports.getWallet = async (req, res) => {
  let wallet = await prisma.wallet.findUnique({
    where: { userId: req.user.id }
  });

  // Auto-create wallet if missing
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { userId: req.user.id, balance: 0, currency: 'NGN' }
    });
  }

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
      take: parseInt(limit)
    }),
    prisma.walletTransaction.count({ where })
  ]);

  res.status(200).json({
    success: true,
    data: {
      wallet: { balance: wallet.balance, currency: wallet.currency },
      transactions,
      pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
    }
  });
};

/**
 * @desc    Initialize Paystack top-up
 * @route   POST /api/wallet/topup/paystack
 * @access  Private
 */
exports.paystackTopup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount } = req.body;
  const { email, id: userId } = req.user;

  if (amount < 100) throw new AppError('Minimum top-up amount is ₦100', 400);

  const transaction = await paymentService.paystackInitialize({
    email,
    amount,
    metadata: { userId, purpose: 'wallet_topup' }
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
 * @desc    Verify Paystack top-up and credit wallet
 * @route   POST /api/wallet/topup/paystack/verify
 * @access  Private
 */
exports.verifyPaystackTopup = async (req, res) => {
  const { reference } = req.body;

  if (!reference) throw new AppError('Payment reference is required', 400);

  const existing = await prisma.walletTransaction.findFirst({
    where: { reference }
  });
  if (existing) {
    return res.status(200).json({ success: true, message: 'Already processed', data: { transaction: existing } });
  }

  const transaction = await paymentService.paystackVerify(reference);

  if (transaction.status !== 'success') {
    throw new AppError('Payment verification failed', 400);
  }

  const amount = transaction.amount / 100; // kobo to NGN
  const { userId } = transaction.metadata;

  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId, balance: 0, currency: 'NGN' } });
  }

  const [updatedWallet, walletTx] = await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        description: 'Wallet top-up via Paystack',
        status: 'COMPLETED',
        reference
      }
    })
  ]);

  await notificationService.notify({
    userId,
    title: 'Wallet Topped Up 💰',
    message: `₦${amount.toFixed(2)} has been added to your wallet. New balance: ₦${updatedWallet.balance.toFixed(2)}`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { amount, newBalance: updatedWallet.balance, reference }
  });

  res.status(200).json({
    success: true,
    message: 'Wallet topped up successfully',
    data: { wallet: updatedWallet, transaction: walletTx }
  });
};

/**
 * @desc    Initialize Flutterwave top-up
 * @route   POST /api/wallet/topup/flutterwave
 * @access  Private
 */
exports.flutterwaveTopup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount } = req.body;
  const { email, phone, firstName, lastName, id: userId } = req.user;

  if (amount < 100) throw new AppError('Minimum top-up amount is ₦100', 400);

  const txRef = `WALLET-FLW-${userId}-${Date.now()}`;

  const transaction = await paymentService.flutterwaveInitialize({
    email,
    phone,
    name: `${firstName} ${lastName}`,
    amount,
    txRef,
    metadata: { userId, purpose: 'wallet_topup' }
  });

  res.status(200).json({
    success: true,
    data: { paymentLink: transaction.link, txRef }
  });
};

/**
 * @desc    Verify Flutterwave top-up
 * @route   POST /api/wallet/topup/flutterwave/verify
 * @access  Private
 */
exports.verifyFlutterwaveTopup = async (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId) throw new AppError('Transaction ID is required', 400);

  const existing = await prisma.walletTransaction.findFirst({
    where: { reference: String(transactionId) }
  });
  if (existing) {
    return res.status(200).json({ success: true, message: 'Already processed', data: { transaction: existing } });
  }

  const transaction = await paymentService.flutterwaveVerify(transactionId);

  if (transaction.status !== 'successful') {
    throw new AppError('Payment verification failed', 400);
  }

  const amount = transaction.amount;
  const { userId } = transaction.meta || {};

  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId, balance: 0, currency: 'NGN' } });
  }

  const [updatedWallet, walletTx] = await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        description: 'Wallet top-up via Flutterwave',
        status: 'COMPLETED',
        reference: String(transactionId)
      }
    })
  ]);

  await notificationService.notify({
    userId,
    title: 'Wallet Topped Up 💰',
    message: `₦${amount.toFixed(2)} has been added to your wallet. New balance: ₦${updatedWallet.balance.toFixed(2)}`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { amount, newBalance: updatedWallet.balance }
  });

  res.status(200).json({
    success: true,
    message: 'Wallet topped up successfully',
    data: { wallet: updatedWallet, transaction: walletTx }
  });
};

/**
 * @desc    Transfer funds to another user
 * @route   POST /api/wallet/transfer
 * @access  Private
 */
exports.transfer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { recipientPhone, amount, note } = req.body;

  if (amount <= 0) throw new AppError('Amount must be greater than 0', 400);
  if (recipientPhone === req.user.phone) throw new AppError('Cannot transfer to yourself', 400);

  const recipient = await prisma.user.findUnique({ where: { phone: recipientPhone } });
  if (!recipient) throw new AppError('Recipient not found', 404);

  const senderWallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!senderWallet || senderWallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
  }

  let recipientWallet = await prisma.wallet.findUnique({ where: { userId: recipient.id } });
  if (!recipientWallet) {
    recipientWallet = await prisma.wallet.create({ data: { userId: recipient.id, balance: 0, currency: 'NGN' } });
  }

  const reference = `TRF-${Date.now()}`;

  await prisma.$transaction([
    prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { decrement: amount } } }),
    prisma.wallet.update({ where: { userId: recipient.id }, data: { balance: { increment: amount } } }),
    prisma.walletTransaction.create({
      data: {
        walletId: senderWallet.id,
        type: 'DEBIT',
        amount,
        description: `Transfer to ${recipient.firstName} ${recipient.lastName}. ${note || ''}`,
        status: 'COMPLETED',
        reference
      }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: recipientWallet.id,
        type: 'CREDIT',
        amount,
        description: `Transfer from ${req.user.firstName} ${req.user.lastName}. ${note || ''}`,
        status: 'COMPLETED',
        reference: `${reference}-R`
      }
    })
  ]);

  // Notify both parties
  await notificationService.notify({
    userId: req.user.id,
    title: 'Transfer Sent ✅',
    message: `₦${amount.toFixed(2)} sent to ${recipient.firstName} ${recipient.lastName}.`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { amount, recipientId: recipient.id }
  });

  await notificationService.notify({
    userId: recipient.id,
    title: 'Money Received 💰',
    message: `₦${amount.toFixed(2)} received from ${req.user.firstName} ${req.user.lastName}. ${note || ''}`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { amount, senderId: req.user.id }
  });

  const updatedWallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });

  res.status(200).json({
    success: true,
    message: `₦${amount.toFixed(2)} transferred successfully`,
    data: { wallet: updatedWallet, reference }
  });
};

/**
 * @desc    Request wallet withdrawal to bank
 * @route   POST /api/wallet/withdraw
 * @access  Private
 */
exports.withdraw = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { amount, accountNumber, bankCode, accountName } = req.body;

  if (amount < 500) throw new AppError('Minimum withdrawal is ₦500', 400);

  const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
  if (!wallet || wallet.balance < amount) {
    throw new AppError('Insufficient wallet balance', 400);
  }

  // Create transfer recipient on Paystack
  const recipient = await paymentService.paystackCreateTransferRecipient({
    accountNumber,
    bankCode,
    name: accountName
  });

  // Initiate transfer
  const transfer = await paymentService.paystackInitiateTransfer({
    amount: amount * 100, // NGN to kobo
    recipient: recipient.recipient_code,
    reason: `Wallet withdrawal for ${req.user.firstName} ${req.user.lastName}`
  });

  const reference = transfer.transfer_code || `WD-${Date.now()}`;

  await prisma.$transaction([
    prisma.wallet.update({ where: { userId: req.user.id }, data: { balance: { decrement: amount } } }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'WITHDRAWAL',
        amount,
        description: `Bank withdrawal to ${accountNumber} (${bankCode})`,
        status: 'PENDING',
        reference
      }
    })
  ]);

  await notificationService.notify({
    userId: req.user.id,
    title: 'Withdrawal Initiated 🏦',
    message: `₦${amount.toFixed(2)} withdrawal to your bank account is being processed.`,
    type: notificationService.TYPES.PAYMENT_RECEIVED,
    data: { amount, accountNumber: `****${accountNumber.slice(-4)}`, bankCode }
  });

  res.status(200).json({
    success: true,
    message: 'Withdrawal initiated. Funds will arrive within 1-2 business days.',
    data: { reference, amount }
  });
};

/**
 * @desc    Initialize Paystack top-up for wallet
 * @route   POST /api/wallet/topup/initialize
 * @access  Private
 */
exports.initializeTopUp = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 100) throw new AppError('Minimum top-up is ₦100', 400);
  if (amount > 1000000)        throw new AppError('Maximum top-up is ₦1,000,000', 400);

  const reference = `TOPUP-${req.user.id.slice(0, 8)}-${Date.now()}`;

  const paystackRes = await paymentService.paystackInitializePayment({
    email:     req.user.email,
    amount:    amount * 100, // kobo
    reference,
    metadata:  { userId: req.user.id, type: 'wallet_topup', amount },
    callbackUrl: `${process.env.API_BASE_URL}/api/wallet/topup/verify`,
  });

  // Store pending transaction so webhook can match it
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
      }
    });
  }

  res.status(200).json({
    success: true,
    data: {
      authorizationUrl: paystackRes.data.authorization_url,
      reference,
      accessCode:       paystackRes.data.access_code,
    }
  });
};

/**
 * @desc    Verify Paystack top-up (called by webhook or callback)
 * @route   POST /api/wallet/topup/verify
 * @access  Public (Paystack webhook)
 */
exports.verifyTopUp = async (req, res) => {
  const { reference } = req.body;
  if (!reference) return res.status(400).json({ success: false });

  const verified = await paymentService.paystackVerifyTransaction(reference).catch(() => null);
  if (!verified || verified.data.status !== 'success') {
    return res.status(400).json({ success: false, message: 'Payment not successful' });
  }

  const amount   = verified.data.amount / 100; // convert from kobo
  const metadata = verified.data.metadata;
  const userId   = metadata?.userId;

  if (!userId) return res.status(400).json({ success: false });

  // Idempotency — don't credit twice
  const existing = await prisma.walletTransaction.findUnique({ where: { reference } });
  if (existing?.status === 'COMPLETED') {
    return res.status(200).json({ success: true, message: 'Already processed' });
  }

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
    message: `₦${amount.toLocaleString('en-NG')} has been added to your wallet. Reference: ${reference}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { amount, reference },
  });

  res.status(200).json({ success: true });
};

/**
 * @desc    Verify bank account (for withdrawal screen)
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
    data: { accountName: result.account_name, accountNumber: result.account_number }
  });
};

/**
 * @desc    Admin: get all pending payout requests
 * @route   GET /api/admin/payouts
 * @access  Private (ADMIN)
 */
exports.adminGetPayouts = async (req, res) => {
  const { status = 'PENDING', page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where: { status },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: parseInt(skip),
      take: parseInt(limit),
    }),
    prisma.payout.count({ where: { status } }),
  ]);

  res.status(200).json({
    success: true,
    data: { payouts, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } }
  });
};

/**
 * @desc    Admin: approve a payout (mark as PROCESSING → COMPLETED)
 * @route   PUT /api/admin/payouts/:id/approve
 * @access  Private (ADMIN)
 */
exports.adminApprovePayout = async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const payout = await prisma.payout.findUnique({
    where: { id },
    include: { user: true }
  });
  if (!payout) throw new AppError('Payout not found', 404);
  if (payout.status !== 'PENDING') throw new AppError('Payout is not in PENDING status', 400);

  // Update payout status + wallet transaction
  await prisma.$transaction([
    prisma.payout.update({
      where: { id },
      data:  { status: 'COMPLETED', processedAt: new Date() }
    }),
    prisma.walletTransaction.updateMany({
      where: { reference: payout.reference },
      data:  { status: 'COMPLETED' }
    }),
  ]);

  await notificationService.notify({
    userId:  payout.userId,
    title:   'Withdrawal Approved ✅',
    message: `Your withdrawal of ₦${payout.amount.toLocaleString('en-NG')} to ${payout.accountName} has been approved and sent to your bank. ${note ?? ''}`,
    type:    notificationService.TYPES.WALLET_WITHDRAWAL,
    data:    { payoutId: id, amount: payout.amount, reference: payout.reference }
  });

  res.status(200).json({ success: true, message: 'Payout approved and marked as completed' });
};

/**
 * @desc    Admin: reject a payout (refund wallet balance)
 * @route   PUT /api/admin/payouts/:id/reject
 * @access  Private (ADMIN)
 */
exports.adminRejectPayout = async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  const payout = await prisma.payout.findUnique({ where: { id } });
  if (!payout) throw new AppError('Payout not found', 404);
  if (payout.status !== 'PENDING') throw new AppError('Payout is not in PENDING status', 400);

  // Refund wallet + update payout status
  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: payout.userId },
      data:  { balance: { increment: payout.amount } },
    }),
    prisma.payout.update({
      where: { id },
      data:  { status: 'FAILED', failureReason: reason, processedAt: new Date() }
    }),
    prisma.walletTransaction.updateMany({
      where: { reference: payout.reference },
      data:  { status: 'FAILED' }
    }),
    prisma.walletTransaction.create({
      data: {
        walletId:    (await prisma.wallet.findUnique({ where: { userId: payout.userId } })).id,
        type:        'REFUND',
        amount:      payout.amount,
        description: `Withdrawal refund — ${reason ?? 'rejected by admin'}`,
        status:      'COMPLETED',
        reference:   `REFUND-${id}`,
      }
    }),
  ]);

  await notificationService.notify({
    userId:  payout.userId,
    title:   'Withdrawal Rejected',
    message: `Your withdrawal of ₦${payout.amount.toLocaleString('en-NG')} was rejected. ₦${payout.amount.toLocaleString('en-NG')} has been returned to your wallet. ${reason ? `Reason: ${reason}` : ''}`,
    type:    notificationService.TYPES.WALLET_CREDITED,
    data:    { payoutId: id, amount: payout.amount, reason }
  });

  res.status(200).json({ success: true, message: 'Payout rejected and wallet refunded' });
};

module.exports = exports;