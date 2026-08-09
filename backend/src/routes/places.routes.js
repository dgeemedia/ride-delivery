// backend/src/routes/places.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const placesController = require('../controllers/places.controller');
const { protect } = require('../middleware/auth.middleware');

// Both routes require an authenticated user (customer app) so random
// unauthenticated traffic can't run up your Places bill. `protect` is the
// alias for `authenticate` exported from auth.middleware.js — same one
// used across your other route files.

router.post(
  '/autocomplete',
  protect,
  [
    body('input').isString().trim().notEmpty().withMessage('input is required'),
    body('sessionToken').isString().notEmpty().withMessage('sessionToken is required'),
    body('lat').optional().isFloat(),
    body('lng').optional().isFloat(),
  ],
  placesController.autocomplete
);

router.post(
  '/details',
  protect,
  [
    body('placeId').isString().notEmpty().withMessage('placeId is required'),
    body('sessionToken').isString().notEmpty().withMessage('sessionToken is required'),
  ],
  placesController.placeDetails
);

module.exports = router;

// ── In your main app/router file (e.g. app.js or routes/index.js), add: ──
// app.use('/api/places', require('./routes/places.routes'));