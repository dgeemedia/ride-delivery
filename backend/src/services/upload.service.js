// backend/src/services/upload.service.js
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
// Note: multer-storage-cloudinary v4 works with cloudinary v2 despite the peer warning
const path = require('path');
const { AppError } = require('../middleware/errorHandler');

// ─── Configure Cloudinary ─────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Helper: pick folder from request path ────────────────────────────────────
const getFolderFromPath = (reqPath) => {
  if (reqPath.includes('license'))              return 'duoride/documents/licenses';
  if (reqPath.includes('vehicle-registration')) return 'duoride/documents/vehicles';
  if (reqPath.includes('insurance'))            return 'duoride/documents/insurance';
  if (reqPath.includes('profile'))              return 'duoride/profiles';
  if (reqPath.includes('delivery'))             return 'duoride/deliveries/proof';
  if (reqPath.includes('partner/id'))           return 'duoride/documents/ids';
  if (reqPath.includes('partner/vehicle'))      return 'duoride/documents/vehicles';
  return 'duoride/general';
};

// ─── Cloudinary storage (multer-storage-cloudinary v5) ───────────────────────
// v5 changed: params must be a plain object or async fn returning plain object.
// transformation is now a top-level key, not nested inside params.
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:          getFolderFromPath(req.path),
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    public_id:       `${Date.now()}-${path.parse(file.originalname).name}`,
    transformation:  [{ width: 1000, height: 1000, crop: 'limit' }],
  }),
});

// ─── File filter ─────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const validExt  = allowed.test(path.extname(file.originalname).toLowerCase());
  const validMime = allowed.test(file.mimetype);

  if (validExt && validMime) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPEG, PNG, and PDF files are allowed', 400));
  }
};

// ─── Multer instance ──────────────────────────────────────────────────────────
// multer v2: `limits.fileSize` API is unchanged; fileFilter signature is unchanged.
const upload = multer({
  storage,
  limits:     { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

// ─── Exported middleware factories ────────────────────────────────────────────

/**
 * Single-file upload middleware
 * @param {string} fieldName — form field name
 */
exports.uploadSingle = (fieldName) => upload.single(fieldName);

/**
 * Multi-file upload middleware
 * @param {string} fieldName
 * @param {number} maxCount
 */
exports.uploadMultiple = (fieldName, maxCount = 10) =>
  upload.array(fieldName, maxCount);

// ─── Direct Cloudinary helpers ────────────────────────────────────────────────

/**
 * Upload a base64 data-URI directly (used by mobile /upload/base64 endpoint)
 */
exports.uploadBase64 = async (base64Data, folder = 'duoride/general') => {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'auto',
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch (err) {
    throw new AppError('Failed to upload file: ' + err.message, 500);
  }
};

/**
 * Delete a file from Cloudinary by public_id
 */
exports.deleteFile = async (publicId) => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    throw new AppError('Failed to delete file: ' + err.message, 500);
  }
};

/**
 * Build a signed/transformed URL for an existing public_id
 */
exports.getFileUrl = (publicId, options = {}) =>
  cloudinary.url(publicId, { secure: true, ...options });

module.exports = exports;