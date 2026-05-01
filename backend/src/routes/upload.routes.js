// backend/src/routes/upload.routes.js
const express = require('express');
const { body } = require('express-validator');
const uploadController = require('../controllers/upload.controller');
const uploadService = require('../services/upload.service');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.post('/profile-image', uploadService.uploadSingle('image'), uploadController.uploadProfileImage);
router.post('/driver/license', authorize('DRIVER'), uploadService.uploadSingle('license'), uploadController.uploadDriverLicense);
router.post('/driver/vehicle-registration', authorize('DRIVER'), uploadService.uploadSingle('registration'), uploadController.uploadVehicleRegistration);
router.post('/driver/insurance', authorize('DRIVER'), uploadService.uploadSingle('insurance'), uploadController.uploadInsurance);
router.post('/partner/id', authorize('DELIVERY_PARTNER'), uploadService.uploadSingle('id'), uploadController.uploadPartnerId);
router.post('/partner/vehicle', authorize('DELIVERY_PARTNER'), uploadService.uploadSingle('vehicle'), uploadController.uploadPartnerVehicle);
router.post('/delivery/proof', authorize('DELIVERY_PARTNER'), uploadService.uploadSingle('proof'), uploadController.uploadDeliveryProof);
router.post('/base64', [body('base64Data').notEmpty(), body('folder').optional().isString()], uploadController.uploadBase64);
router.delete('/:publicId', uploadController.deleteFile);

module.exports = router;