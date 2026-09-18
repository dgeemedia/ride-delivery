// backend/src/routes/country.routes.js
const express = require('express');
const router = express.Router();
const countryController = require('../controllers/country.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/', countryController.listRegistrationCountries);

// '/me/config' must be declared before '/:code/config', otherwise Express
// matches 'me' as a country code.
router.get('/me/config', authenticate, countryController.getMyCountryConfig);
router.get('/:code/config', countryController.getCountryConfig);

module.exports = router;
