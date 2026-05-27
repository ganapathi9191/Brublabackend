// Routes/userRoutes.js
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
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  checkWishlist,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  getCart,
  clearCart,
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder
} from '../Controller/UserController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { upload } from '../config/multerConfig.js';
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
router.put('/update-image/:userId', upload.single('profileImage'), updateProfileImage); // Use upload.single
router.delete('/delete-image/:userId', deleteProfileImage);

// Live location routes
router.put('/live-location/:userId', updateLiveLocation);
router.get('/live-location/:userId', getLiveLocation);


// ==================== WISHLIST ROUTES ====================
router.post('/wishlist/:userId/add', authenticateToken, addToWishlist);
router.delete('/wishlist/:userId/remove', authenticateToken, removeFromWishlist);
router.get('/wishlist/:userId', authenticateToken, getWishlist);
router.get('/wishlist/:userId/check', authenticateToken, checkWishlist);

// Address routes (no authentication)
router.post('/add/:userId', addAddress);
router.get('/all/:userId', getAllAddresses);
router.get('/:userId/:addressId', getAddressById);
router.put('/update/:userId/:addressId', updateAddress);
router.delete('/delete/:userId/:addressId', deleteAddress);

// ==================== CART ROUTES ====================
router.post('/cart/:userId/add', authenticateToken, addToCart);
router.put('/cart/:userId/update', authenticateToken, updateCartQuantity);
router.delete('/cart/:userId/remove', authenticateToken, removeFromCart);
router.get('/cart/:userId', authenticateToken, getCart);
router.delete('/cart/:userId/clear', authenticateToken, clearCart);

// ==================== ORDER ROUTES ====================
router.post('/order/:userId/create', authenticateToken, createOrder);
router.get('/order/:userId', authenticateToken, getUserOrders);
router.get('/order/:userId/:orderId', authenticateToken, getOrderById);
router.put('/order/:userId/:orderId/cancel', authenticateToken, cancelOrder);



export default router;