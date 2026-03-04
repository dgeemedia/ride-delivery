const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { AppError } = require('../middleware/errorHandler');

/**
 * Create or get Stripe customer
 */
const getOrCreateCustomer = async (user) => {
  // Check if user already has a Stripe customer ID (you'd store this in DB)
  // For now, create new customer
  
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      metadata: {
        userId: user.id
      }
    });
    
    return customer;
  } catch (error) {
    throw new AppError('Failed to create Stripe customer', 500);
  }
};

/**
 * Create payment intent
 */
exports.createPaymentIntent = async (amount, userId, metadata = {}) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        userId,
        ...metadata
      },
      automatic_payment_methods: {
        enabled: true
      }
    });
    
    return paymentIntent;
  } catch (error) {
    throw new AppError('Failed to create payment intent: ' + error.message, 500);
  }
};

/**
 * Confirm payment
 */
exports.confirmPayment = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new AppError('Failed to confirm payment: ' + error.message, 500);
  }
};

/**
 * Get payment intent status
 */
exports.getPaymentIntent = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    throw new AppError('Failed to retrieve payment: ' + error.message, 500);
  }
};

/**
 * Create setup intent for saving payment method
 */
exports.createSetupIntent = async (customerId) => {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card']
    });
    
    return setupIntent;
  } catch (error) {
    throw new AppError('Failed to create setup intent: ' + error.message, 500);
  }
};

/**
 * Attach payment method to customer
 */
exports.attachPaymentMethod = async (paymentMethodId, customerId) => {
  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });
    
    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });
    
    return true;
  } catch (error) {
    throw new AppError('Failed to attach payment method: ' + error.message, 500);
  }
};

/**
 * List customer payment methods
 */
exports.listPaymentMethods = async (customerId) => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });
    
    return paymentMethods.data;
  } catch (error) {
    throw new AppError('Failed to list payment methods: ' + error.message, 500);
  }
};

/**
 * Detach payment method
 */
exports.detachPaymentMethod = async (paymentMethodId) => {
  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    return paymentMethod;
  } catch (error) {
    throw new AppError('Failed to remove payment method: ' + error.message, 500);
  }
};

/**
 * Create refund
 */
exports.createRefund = async (paymentIntentId, amount) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount && { amount: Math.round(amount * 100) })
    });
    
    return refund;
  } catch (error) {
    throw new AppError('Failed to create refund: ' + error.message, 500);
  }
};

/**
 * Create payout (for driver/partner earnings)
 */
exports.createPayout = async (amount, destination, metadata = {}) => {
  try {
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination,
      metadata
    });
    
    return payout;
  } catch (error) {
    throw new AppError('Failed to create payout: ' + error.message, 500);
  }
};

module.exports = exports;