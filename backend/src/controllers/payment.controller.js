const { PrismaClient } = require('@prisma/client');
const { validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const stripeService = require('../services/stripe.service');

const prisma = new PrismaClient();

/**
 * @desc    Create payment intent
 * @route   POST /api/payments/create-intent
 * @access  Private
 */
exports.createPaymentIntent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { amount, rideId, deliveryId } = req.body;

  try {
    const paymentIntent = await stripeService.createPaymentIntent(
      amount,
      req.user.id,
      {
        ...(rideId && { rideId }),
        ...(deliveryId && { deliveryId })
      }
    );

    res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  }
};

/**
 * @desc    Process payment (after client confirmation)
 * @route   POST /api/payments/process
 * @access  Private
 */
exports.processPayment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  const { rideId, deliveryId, amount, paymentIntentId, method = 'CARD' } = req.body;

  // Verify payment intent if using Stripe
  if (method === 'CARD' && paymentIntentId) {
    try {
      const paymentIntent = await stripeService.getPaymentIntent(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new AppError('Payment not successful', 400);
      }
    } catch (error) {
      throw new AppError('Payment verification failed: ' + error.message, 400);
    }
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      userId: req.user.id,
      ...(rideId && { rideId }),
      ...(deliveryId && { deliveryId }),
      amount,
      method,
      status: method === 'CASH' ? 'PENDING' : 'COMPLETED',
      transactionId: paymentIntentId || `CASH-${Date.now()}`
    }
  });

  res.status(201).json({
    success: true,
    message: 'Payment processed successfully',
    data: { payment }
  });
};

/**
 * @desc    Get payment history
 * @route   GET /api/payments/history
 * @access  Private
 */
exports.getHistory = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const skip = (page - 1) * limit;

  const whereClause = {
    userId: req.user.id,
    ...(status && { status })
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: whereClause,
      include: {
        ride: {
          select: {
            pickupAddress: true,
            dropoffAddress: true,
            completedAt: true
          }
        },
        delivery: {
          select: {
            pickupAddress: true,
            dropoffAddress: true,
            deliveredAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: parseInt(skip),
      take: parseInt(limit)
    }),
    prisma.payment.count({ where: whereClause })
  ]);

  res.status(200).json({
    success: true,
    data: {
      payments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    }
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
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.userId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  res.status(200).json({
    success: true,
    data: { payment }
  });
};

/**
 * @desc    Create setup intent for saving card
 * @route   POST /api/payments/setup-intent
 * @access  Private
 */
exports.createSetupIntent = async (req, res) => {
  try {
    // In production, store customerId in user record
    const customerId = 'cus_placeholder'; // Get from user record
    
    const setupIntent = await stripeService.createSetupIntent(customerId);

    res.status(200).json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret
      }
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  }
};

/**
 * @desc    Add payment card
 * @route   POST /api/payments/card/add
 * @access  Private
 */
exports.addCard = async (req, res) => {
  const { paymentMethodId, customerId } = req.body;

  try {
    await stripeService.attachPaymentMethod(paymentMethodId, customerId);

    res.status(200).json({
      success: true,
      message: 'Card added successfully'
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  }
};

/**
 * @desc    Get saved payment cards
 * @route   GET /api/payments/cards
 * @access  Private
 */
exports.getCards = async (req, res) => {
  try {
    // In production, get customerId from user record
    const customerId = 'cus_placeholder';
    
    const paymentMethods = await stripeService.listPaymentMethods(customerId);

    const cards = paymentMethods.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year
    }));

    res.status(200).json({
      success: true,
      data: { cards }
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  }
};

/**
 * @desc    Remove payment card
 * @route   DELETE /api/payments/card/:id
 * @access  Private
 */
exports.removeCard = async (req, res) => {
  const { id } = req.params;

  try {
    await stripeService.detachPaymentMethod(id);

    res.status(200).json({
      success: true,
      message: 'Card removed successfully'
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  }
};

/**
 * @desc    Request refund
 * @route   POST /api/payments/:id/refund
 * @access  Private
 */
exports.requestRefund = async (req, res) => {
  const { id } = req.params;
  const { reason, amount } = req.body;

  const payment = await prisma.payment.findUnique({
    where: { id }
  });

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (payment.userId !== req.user.id) {
    throw new AppError('Unauthorized', 403);
  }

  if (payment.status !== 'COMPLETED') {
    throw new AppError('Can only refund completed payments', 400);
  }

  try {
    const refund = await stripeService.createRefund(
      payment.transactionId,
      amount || payment.amount
    );

    // Update payment status
    await prisma.payment.update({
      where: { id },
      data: {
        status: 'REFUNDED'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: { refund }
    });
  } catch (error) {
    throw new AppError(error.message, 500);
  }
};

/**
 * @desc    Get payment statistics
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
      ...(Object.keys(dateFilter).length > 0 && {
        createdAt: dateFilter
      })
    }
  });

  const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
  const averageTransaction = payments.length > 0 ? totalSpent / payments.length : 0;

  // Separate by service type
  const ridePayments = payments.filter(p => p.rideId);
  const deliveryPayments = payments.filter(p => p.deliveryId);

  res.status(200).json({
    success: true,
    data: {
      totalSpent: totalSpent.toFixed(2),
      totalTransactions: payments.length,
      averageTransaction: averageTransaction.toFixed(2),
      rides: {
        count: ridePayments.length,
        total: ridePayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
      },
      deliveries: {
        count: deliveryPayments.length,
        total: deliveryPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
      },
      period
    }
  });
};

module.exports = exports;