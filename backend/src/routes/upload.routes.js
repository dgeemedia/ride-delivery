// backend/src/routes/upload.routes.js
const express = require('express');
const { body } = require('express-validator');
const uploadController = require('../controllers/upload.controller');
const uploadService = require('../services/upload.service');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/upload/profile-image
 * @desc    Upload profile image
 * @access  Private
 */
router.post(
  '/profile-image',
  uploadService.uploadSingle('image'),
  uploadController.uploadProfileImage
);

/**
 * @route   POST /api/upload/driver/license
 * @desc    Upload driver license
 * @access  Private (DRIVER)
 */
router.post(
  '/driver/license',
  authorize('DRIVER'),
  uploadService.uploadSingle('license'),
  uploadController.uploadDriverLicense
);

/**
 * @route   POST /api/upload/driver/vehicle-registration
 * @desc    Upload vehicle registration
 * @access  Private (DRIVER)
 */
router.post(
  '/driver/vehicle-registration',
  authorize('DRIVER'),
  uploadService.uploadSingle('registration'),
  uploadController.uploadVehicleRegistration
);

/**
 * @route   POST /api/upload/driver/insurance
 * @desc    Upload insurance document
 * @access  Private (DRIVER)
 */
router.post(
  '/driver/insurance',
  authorize('DRIVER'),
  uploadService.uploadSingle('insurance'),
  uploadController.uploadInsurance
);

/**
 * @route   POST /api/upload/partner/id
 * @desc    Upload partner ID
 * @access  Private (DELIVERY_PARTNER)
 */
router.post(
  '/partner/id',
  authorize('DELIVERY_PARTNER'),
  uploadService.uploadSingle('id'),
  uploadController.uploadPartnerId
);

/**
 * @route   POST /api/upload/partner/vehicle
 * @desc    Upload partner vehicle image
 * @access  Private (DELIVERY_PARTNER)
 */
router.post(
  '/partner/vehicle',
  authorize('DELIVERY_PARTNER'),
  uploadService.uploadSingle('vehicle'),
  uploadController.uploadPartnerVehicle
);

/**
 * @route   POST /api/upload/delivery/proof
 * @desc    Upload delivery proof image
 * @access  Private (DELIVERY_PARTNER)
 */
router.post(
  '/delivery/proof',
  authorize('DELIVERY_PARTNER'),
  uploadService.uploadSingle('proof'),
  uploadController.uploadDeliveryProof
);

/**
 * @route   POST /api/upload/base64
 * @desc    Upload from base64 (for mobile apps)
 * @access  Private
 */
router.post(
  '/base64',
  [
    body('base64Data').notEmpty(),
    body('folder').optional().isString()
  ],
  uploadController.uploadBase64
);

/**
 * @route   DELETE /api/upload/:publicId
 * @desc    Delete uploaded file
 * @access  Private
 */
router.delete('/:publicId', uploadController.deleteFile);

module.exports = router;