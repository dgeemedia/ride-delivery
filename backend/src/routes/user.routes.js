const express = require('express');
const { body, param } = require('express-validator');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().isMobilePhone(),
  body('profileImage').optional().isURL()
], userController.updateProfile);

/**
 * @route   PUT /api/users/password
 * @desc    Update password
 * @access  Private
 */
router.put('/password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], userController.updatePassword);

/**
 * @route   POST /api/users/profile-image
 * @desc    Upload profile image
 * @access  Private
 */
router.post('/profile-image', [
  body('imageUrl').isURL()
], userController.uploadProfileImage);

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', userController.getUserStats);

/**
 * @route   DELETE /api/users/account
 * @desc    Delete account
 * @access  Private
 */
router.delete('/account', [
  body('password').notEmpty()
], userController.deleteAccount);

module.exports = router;

/**
 * @route   POST /api/users/profile/image
 * @desc    Upload profile image
 * @access  Private
 * 
 * FUTURE: Implement file upload with multer
 * - Add multer middleware
 * - Upload to S3 or Cloudinary
 * - Update user profileImage field
 */

// FUTURE: Add wallet functionality
// router.get('/wallet', walletController.getWallet);
// router.post('/wallet/topup', walletController.topUp);

module.exports = router;