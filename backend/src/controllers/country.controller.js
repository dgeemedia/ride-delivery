// backend/src/controllers/country.controller.js
const {
  getRegistrationCountries,
  getPaymentConfigForCountry,
  getPaymentConfigForUser,
} = require('../services/country.service');

// GET /api/countries?forRole=DRIVER
// Public, no auth — used on the registration screen before a user has an
// account. forRole is optional; omit it (or pass CUSTOMER) to get every
// payment-capable country regardless of payout support.
exports.listRegistrationCountries = async (req, res) => {
  const { forRole } = req.query;
  const countries = await getRegistrationCountries(forRole);
  res.status(200).json({ success: true, data: { countries } });
};

// GET /api/countries/:code/config
// Public. Lets the registration and onboarding screens preview which payment
// methods a country offers (and which language it defaults to) before the
// user has an account to look up.
exports.getCountryConfig = async (req, res) => {
  const config = await getPaymentConfigForCountry(String(req.params.code || '').toUpperCase());
  res.status(200).json({ success: true, data: { config } });
};

// GET /api/countries/me/config
// Authenticated. The single call the mobile app makes on login to decide
// which payment methods to render, which one to preselect, and whether the
// withdrawal screen should show a bank form or a mobile-money form.
exports.getMyCountryConfig = async (req, res) => {
  const config = await getPaymentConfigForUser(req.user);
  res.status(200).json({ success: true, data: { config } });
};
