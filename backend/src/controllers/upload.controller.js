const uploadService = require('../services/upload.service');
const { AppError } = require('../middleware/errorHandler');

/**
 * @desc    Upload profile image
 * @route   POST /api/upload/profile-image
 * @access  Private
 */
exports.uploadProfileImage = async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  res.status(200).json({
    success: true,
    message: 'Profile image uploaded successfully',
    data: {
      url: req.file.path,
      publicId: req.file.filename
    }
  });
};

/**
 * @desc    Upload driver license
 * @route   POST /api/upload/driver/license
 * @access  Private (DRIVER)
 */
exports.uploadDriverLicense = async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  res.status(200).json({
    success: true,
    message: 'License uploaded successfully',
    data: {
      url: req.file.path,
      publicId: req.file.filename
    }
  });
};

/**
 * @desc    Upload vehicle registration
 * @route   POST /api/upload/driver/vehicle-registration
 * @access  Private (DRIVER)
 */
exports.uploadVehicleRegistration = async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  res.status(200).json({
    success: true,
    message: 'Vehicle registration uploaded successfully',
    data: {
      url: req.file.path,
      publicId: req.file.filename
    }
  });
};

/**
 * @desc    Upload insurance document
 * @route   POST /api/upload/driver/insurance
 * @access  Private (DRIVER)
 */
exports.uploadInsurance = async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  res.status(200).json({
    success: true,
    message: 'Insurance document uploaded successfully',
    data: {
      url: req.file.path,
      publicId: req.file.filename
    }
  });
};

/**
 * @desc    Upload partner ID
 * @route   POST /api/upload/partner/id
 * @access  Private (DELIVERY_PARTNER)
 */
exports.uploadPartnerId = async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  res.status(200).json({
    success: true,
    message: 'ID uploaded successfully',
    data: {
      url: req.file.path,
      publicId: req.file.filename
    }
  });
};

/**
 * @desc    Upload partner vehicle image
 * @route   POST /api/upload/partner/vehicle
 * @access  Private (DELIVERY_PARTNER)
 */
exports.uploadPartnerVehicle = async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  res.status(200).json({
    success: true,
    message: 'Vehicle image uploaded successfully',
    data: {
      url: req.file.path,
      publicId: req.file.filename
    }
  });
};

/**
 * @desc    Upload delivery proof image
 * @route   POST /api/upload/delivery/proof
 * @access  Private (DELIVERY_PARTNER)
 */
exports.uploadDeliveryProof = async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  res.status(200).json({
    success: true,
    message: 'Delivery proof uploaded successfully',
    data: {
      url: req.file.path,
      publicId: req.file.filename
    }
  });
};

/**
 * @desc    Upload from base64 (for mobile apps)
 * @route   POST /api/upload/base64
 * @access  Private
 */
exports.uploadBase64 = async (req, res) => {
  const { base64Data, folder } = req.body;

  if (!base64Data) {
    throw new AppError('No base64 data provided', 400);
  }

  const result = await uploadService.uploadBase64(base64Data, folder);

  res.status(200).json({
    success: true,
    message: 'File uploaded successfully',
    data: result
  });
};

/**
 * @desc    Delete uploaded file
 * @route   DELETE /api/upload/:publicId
 * @access  Private
 */
exports.deleteFile = async (req, res) => {
  const { publicId } = req.params;

  await uploadService.deleteFile(publicId);

  res.status(200).json({
    success: true,
    message: 'File deleted successfully'
  });
};

module.exports = exports;