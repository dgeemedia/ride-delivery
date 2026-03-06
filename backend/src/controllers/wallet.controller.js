const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/payment.service');
const notificationService = require('../services/notification.service');

const prisma = new PrismaClient();

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

module.exports = exports;