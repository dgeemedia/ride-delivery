// backend/src/routes/country.routes.js
const express = require('express');
const router = express.Router();
const countryController = require('../controllers/country.controller');

router.get('/', countryController.listRegistrationCountries);

module.exports = router;