import express from 'express';
import {
  loginRequest,
  verifyLoginOtp,
  register,
  verifyRegisterOtp,
  resendOtp,
} from '../Controller/UserController.js';

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

export default router;