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
  toggleWishlist,
  getWishlist,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  getCart,
  clearCart,
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,

  // Login screen media
  getLoginScreenMedia,

  // Home page
  getUserHeroSections,
  getUserBannerSections,
  getHomePage,

  // Collection
  getUserCollections,
  getUserCollectionById,

  //HomePage Collection
  getHomepageCollections,

  getRecommendedProducts
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

// Collection routes
router.get('/collections', getUserCollections);
router.get('/collections/:collectionId', getUserCollectionById);

//Home Page Collection
router.get('/homepage/collections', getHomepageCollections);

// Recommended products
router.get('/recommended', getRecommendedProducts);

// Profile routes (no authentication)
router.get('/:userId', getUserById);
router.put('/update/:userId', updateProfile);
router.put('/update-image/:userId', upload.single('profileImage'), updateProfileImage); // Use upload.single
router.delete('/delete-image/:userId', deleteProfileImage);

// Live location routes
router.put('/live-location/:userId', updateLiveLocation);
router.get('/live-location/:userId', getLiveLocation);


// ==================== WISHLIST ROUTES ====================
router.post('/wishlist/:userId/toggle', toggleWishlist);
router.get('/wishlist/:userId', getWishlist);

// ==================== CART ROUTES ====================
router.post('/cart/:userId/add',  addToCart);
router.put('/cart/:userId/update',  updateCartQuantity);
router.delete('/cart/:userId/remove', removeFromCart);
router.get('/cart/:userId', getCart);
router.delete('/cart/:userId/clear', clearCart);

// ==================== ORDER ROUTES ====================
router.post('/order/:userId/create', createOrder);
router.get('/order/:userId', getUserOrders);
router.get('/order/:userId/:orderId', getOrderById);
router.put('/order/:userId/:orderId/cancel', cancelOrder);


//Login screen media routes
router.get('/login-screen/media', getLoginScreenMedia);

// Home page routes
router.get('/home-page/hero', getUserHeroSections);
router.get('/home-page/banner', getUserBannerSections);
router.get('/home-page', getHomePage); 


// Address routes (no authentication)
router.post('/add/:userId', addAddress);
router.get('/all/:userId', getAllAddresses);
router.get('/:userId/:addressId', getAddressById);
router.put('/update/:userId/:addressId', updateAddress);
router.delete('/delete/:userId/:addressId', deleteAddress);


export default router;