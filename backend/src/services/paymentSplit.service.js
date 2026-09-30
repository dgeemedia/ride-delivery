// backend/src/services/paymentSplit.service.js
//
// How a payment is divided between the platform and the driver/partner.
//
// This used to be a hard-coded 20% / 80% at seven places in payment.controller,
// so the commission an admin configured never changed what a driver was actually
// credited. The rate now comes from the PAYER'S COUNTRY (rides use the rides
// commission, deliveries the deliveries commission). 0% is a valid rate: the
// platform keeps nothing and the earner gets the whole amount.
'use strict';

const { getPricingContextForUserId } = require('./country.service');
const { getSettings } = require('../utils/fareEngine');
const { isWholeUnitCurrency } = require('../utils/currency');

const roundFor = (value, currency) =>
  isWholeUnitCurrency(currency) ? Math.round(value) : Math.round(value * 100) / 100;

/**
 * @param {string} userId      the payer
 * @param {{rideId?:string, deliveryId?:string}} kind
 * @param {number} amount      what was paid, in the payer's currency
 * @returns {Promise<{platformFee:number, driverEarnings:number, commissionRate:number}>}
 */
const paymentSplit = async (userId, { rideId, deliveryId } = {}, amount) => {
  const { countryCode, currencyCode } = await getPricingContextForUserId(userId);
  const { platform } = await getSettings(countryCode);

  const rate = deliveryId && !rideId ? platform.deliveryCommission : platform.ridesCommission;
  const platformFee = roundFor(Number(amount) * rate, currencyCode);
  // Earner gets the remainder, so the two always add back to exactly `amount`.
  const driverEarnings = roundFor(Number(amount) - platformFee, currencyCode);
  return { platformFee, driverEarnings, commissionRate: rate };
};

module.exports = { paymentSplit };
