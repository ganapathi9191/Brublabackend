import express from 'express';
import {
  loginRequest,
  verifyLoginOtp,
  register,
  verifyRegisterOtp,
  resendOtp,
 getUserById,
  updateProfile,
  updateProfileImage,
  deleteProfileImage,
  updateLiveLocation,
  getLiveLocation,
  addAddress,
  getAllAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
} from '../Controller/UserController.js';
import { uploadProfileImage } from '../config/multerConfig.js';

const router = express.Router();

/**
 * AUTH FLOW:
 *
 * LOGIN FLOW:
 *   1. POST /api/auth/login           → check mobile, send OTP + token if exists
 *   2. POST /api/auth/login/verify-otp → verify token + OTP (1234) → returns JWT
 *
 * REGISTER FLOW (only if mobile not found):
 *   3. POST /api/auth/register           → create user, send OTP + token
 *   4. POST /api/auth/register/verify-otp → verify token + OTP (1234) → returns JWT (auto-login)
 *
 * COMMON:
 *   5. POST /api/auth/resend-otp → resend OTP for any flow
 */

// Login
router.post('/login', loginRequest);
router.post('/login/verify-otp', verifyLoginOtp);

// Register
router.post('/register', register);
router.post('/register/verify-otp', verifyRegisterOtp);

// Common
router.post('/resend-otp', resendOtp);

// Profile routes (no authentication)
router.get('/:userId', getUserById);
router.put('/update/:userId', updateProfile);
router.put('/update-image/:userId', uploadProfileImage, updateProfileImage);
router.delete('/delete-image/:userId', deleteProfileImage);

// Live location routes
router.put('/live-location/:userId', updateLiveLocation);
router.get('/live-location/:userId', getLiveLocation);

// Address routes (no authentication)
router.put('/add/:userId', addAddress);
router.get('/all/:userId', getAllAddresses);
router.get('/:userId/:addressId', getAddressById);
router.put('/update/:userId/:addressId', updateAddress);
router.delete('/delete/:userId/:addressId', deleteAddress);

export default router;