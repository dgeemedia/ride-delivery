// backend/src/controllers/country.controller.js
const { getRegistrationCountries } = require('../services/country.service');

// GET /api/countries?forRole=DRIVER
// Public, no auth — used on the registration screen before a user has an
// account. forRole is optional; omit it (or pass CUSTOMER) to get every
// payment-capable country regardless of payout support.
exports.listRegistrationCountries = async (req, res) => {
  const { forRole } = req.query;
  const countries = await getRegistrationCountries(forRole);
  res.status(200).json({ success: true, data: { countries } });
};