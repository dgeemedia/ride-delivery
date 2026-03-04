const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { AppError } = require('../middleware/errorHandler');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Define storage for different file types
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine folder based on file type
    let folder = 'duoride/general';
    
    if (req.path.includes('license')) {
      folder = 'duoride/documents/licenses';
    } else if (req.path.includes('vehicle')) {
      folder = 'duoride/documents/vehicles';
    } else if (req.path.includes('insurance')) {
      folder = 'duoride/documents/insurance';
    } else if (req.path.includes('profile')) {
      folder = 'duoride/profiles';
    } else if (req.path.includes('delivery')) {
      folder = 'duoride/deliveries/proof';
    } else if (req.path.includes('id')) {
      folder = 'duoride/documents/ids';
    }

    return {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' }
      ],
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`
    };
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images and PDFs only
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new AppError('Only images (jpeg, jpg, png) and PDF files are allowed', 400));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

/**
 * Upload single file to Cloudinary
 */
exports.uploadSingle = (fieldName) => {
  return upload.single(fieldName);
};

/**
 * Upload multiple files to Cloudinary
 */
exports.uploadMultiple = (fieldName, maxCount = 10) => {
  return upload.array(fieldName, maxCount);
};

/**
 * Delete file from Cloudinary
 */
exports.deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new AppError('Failed to delete file: ' + error.message, 500);
  }
};

/**
 * Upload file from base64
 */
exports.uploadBase64 = async (base64Data, folder = 'duoride/general') => {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: folder,
      resource_type: 'auto'
    });
    
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    throw new AppError('Failed to upload file: ' + error.message, 500);
  }
};

/**
 * Get file URL from Cloudinary
 */
exports.getFileUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    secure: true,
    ...options
  });
};

// ALTERNATIVE: AWS S3 Upload Service (commented out)
/*
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

exports.uploadToS3 = async (file, folder = 'general') => {
  const fileExtension = path.extname(file.originalname);
  const fileName = `${folder}/${uuidv4()}${fileExtension}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read'
  };

  try {
    const result = await s3.upload(params).promise();
    return {
      url: result.Location,
      key: result.Key
    };
  } catch (error) {
    throw new AppError('Failed to upload to S3: ' + error.message, 500);
  }
};

exports.deleteFromS3 = async (key) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key
  };

  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    throw new AppError('Failed to delete from S3: ' + error.message, 500);
  }
};
*/

module.exports = exports;