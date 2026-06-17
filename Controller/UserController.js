import User from '../Models/User.js';
import HomePage from '../Models/HomePage.js';
import Order from '../Models/Order.js'; 
import Category from '../Models/Category.js';
import NotificationLabel from '../Models/NotificationLabel.js';
import RecommendedProduct from '../Models/RecommendedProducts.js';
import LoginScreenMedia from '../Models/LoginScreenMedia.js';
import Collection from '../Models/Collection.js';
import UpcomingCollection from '../Models/UpcomingCollection.js';
import LatestDesign from '../Models/LatestDesign.js';
import { getFileUrl, deleteFile } from '../utils/fileUtils.js';
import Product from '../Models/Product.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';


const FIXED_OTP = '1234'; // Fixed OTP for all verification
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const OTP_EXPIRY_MINUTES = 10;

// Generate a random auth token
const generateAuthToken = () => crypto.randomBytes(32).toString('hex');

// Generate JWT
const generateJWT = (userId, role) => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '7d' });
};

// Add these helper functions at the very top of your UserController.js file
const normalizePath = (filePath) => filePath.replace(/\\/g, '/');

// Helper to build full image URL
const getImageUrl = (req, filePath) => {
  const normalized = normalizePath(filePath);
  return `${req.protocol}://${req.get('host')}/${normalized}`;
};

/**
 * STEP 1 - Login: Check if mobile number exists
 * POST /api/auth/login
 * Body: { mobile }
 *
 * If mobile NOT found → { exists: false, message: "Please register first" }
 * If mobile found    → send OTP, return { exists: true, token }
 */
export const loginRequest = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({
        success: false,
        exists: false,
        message: 'Mobile number not registered. Please register first.',
      });
    }

    // User exists — generate OTP and auth token
    const otp = FIXED_OTP;
    const authToken = generateAuthToken();
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    user.authToken = authToken;
    user.authTokenExpires = otpExpires;
    await user.save();

    // In production: send OTP via SMS here
    console.log(`[OTP for ${mobile}]: ${otp}`);

    return res.status(200).json({
      success: true,
      exists: true,
      message: 'OTP sent to your mobile number',
      token: authToken, // frontend uses this token to verify OTP
    });
  } catch (error) {
    console.error('loginRequest error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * STEP 2 - Login OTP Verify
 * POST /api/auth/login/verify-otp
 * Body: { mobile, token, otp }
 *
 * Validates token + OTP (must be 1234), returns JWT
 */
export const verifyLoginOtp = async (req, res) => {
  try {
    const { mobile, token, otp } = req.body;

    if (!mobile || !token || !otp) {
      return res.status(400).json({ success: false, message: 'mobile, token and otp are required' });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check token match
    if (user.authToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Check token expiry
    if (!user.authTokenExpires || user.authTokenExpires < new Date()) {
      return res.status(401).json({ success: false, message: 'Token expired. Please request OTP again.' });
    }

    // Check OTP
    if (user.otp !== otp || otp !== FIXED_OTP) {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    // Clear OTP and token fields
    user.otp = undefined;
    user.otpExpires = undefined;
    user.authToken = undefined;
    user.authTokenExpires = undefined;
    user.isVerified = true;
    await user.save();

    const jwtToken = generateJWT(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error('verifyLoginOtp error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * STEP 3 - Register: Create new user and send OTP
 * POST /api/auth/register
 * Body: { name, mobile, email, role }
 *
 * role must be one of: Tailor, Designer, User, Stylist
 */
export const register = async (req, res) => {
  try {
    const { name, mobile, email, role } = req.body;

    if (!name || !mobile || !email || !role) {
      return res.status(400).json({ success: false, message: 'name, mobile, email and role are required' });
    }

    const validRoles = ['Tailor', 'Designer', 'User', 'Stylist'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `role must be one of: ${validRoles.join(', ')}` });
    }

    // Check if mobile already registered
    const existing = await User.findOne({ mobile });
    if (existing) {
      return res.status(409).json({
        success: false,
        exists: true,
        message: 'Mobile number already registered. Please login.',
      });
    }

    // Create user (unverified)
    const otp = FIXED_OTP;
    const authToken = generateAuthToken();
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const newUser = new User({
      name,
      mobile,
      email,
      role,
      otp,
      otpExpires,
      authToken,
      authTokenExpires: otpExpires,
      isVerified: false,
    });
    await newUser.save();

    // In production: send OTP via SMS here
    console.log(`[Registration OTP for ${mobile}]: ${otp}`);

    return res.status(201).json({
      success: true,
      message: 'OTP sent to your mobile for registration verification',
      token: authToken,
    });
  } catch (error) {
    console.error('register error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * STEP 4 - Register OTP Verify → auto login to home
 * POST /api/auth/register/verify-otp
 * Body: { mobile, token, otp }
 */
export const verifyRegisterOtp = async (req, res) => {
  try {
    const { mobile, token, otp } = req.body;

    if (!mobile || !token || !otp) {
      return res.status(400).json({ success: false, message: 'mobile, token and otp are required' });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.authToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (!user.authTokenExpires || user.authTokenExpires < new Date()) {
      return res.status(401).json({ success: false, message: 'Token expired. Please register again.' });
    }

    if (user.otp !== otp || otp !== FIXED_OTP) {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    // Mark verified, clear temp fields
    user.otp = undefined;
    user.otpExpires = undefined;
    user.authToken = undefined;
    user.authTokenExpires = undefined;
    user.isVerified = true;
    await user.save();

    const jwtToken = generateJWT(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Registration successful. Welcome!',
      jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    console.error('verifyRegisterOtp error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Resend OTP (works for both login and register flows)
 * POST /api/auth/resend-otp
 * Body: { mobile }
 */
export const resendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Mobile number not found' });
    }

    const otp = FIXED_OTP;
    const authToken = generateAuthToken();
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    user.authToken = authToken;
    user.authTokenExpires = otpExpires;
    await user.save();

    console.log(`[Resend OTP for ${mobile}]: ${otp}`);

    return res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
      token: authToken,
    });
  } catch (error) {
    console.error('resendOtp error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user (works without indexes)
    const user = await User.findById(userId).select('-otp -otpExpires -authToken -authTokenExpires -deleteToken -deleteTokenExpiration');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // ✅ Get orders from separate Order collection (works without indexes)
    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get order counts by status (works without indexes)
    const orderCounts = await Order.aggregate([
      { $match: { userId } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
    ]);
    
    const orderStatusCounts = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };
    
    orderCounts.forEach(item => {
      if (item && item._id) {
        orderStatusCounts[item._id] = item.count;
      }
    });
    
    // Convert user to object and add full image URL
    const userObj = user.toObject();
    if (userObj.profileImage) {
      const normalizedPath = userObj.profileImage.replace(/\\/g, '/');
      userObj.profileImageUrl = `${req.protocol}://${req.get('host')}/${normalizedPath}`;
    } else {
      userObj.profileImageUrl = null;
    }
    
    // Add orders to response
    userObj.orders = orders;
    userObj.orderStats = {
      totalOrders: orders.length,
      statusCounts: orderStatusCounts
    };
    
    return res.status(200).json({
      success: true,
      user: userObj
    });
    
  } catch (error) {
    console.error('getUserById error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
/**
 * Update user profile
 * PUT /api/profile/update/:userId
 * Body: { name, email, about }
 */

export const updateProfile = async (req, res) => {
  console.log('🔵 updateProfile function was called!');
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);
  
  try {
    const { userId } = req.params;
    const { name, email, about } = req.body;
    
    console.log('Extracted values:', { userId, name, email, about });
    
    // Build update object with only provided fields
    const updateData = {};
    if (name !== undefined && name !== '') updateData.name = name;
    if (email !== undefined && email !== '') updateData.email = email;
    if (about !== undefined) updateData.about = about;
    
    console.log('Update data being sent to DB:', updateData);
    
    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid fields to update' 
      });
    }
    
    // Update user and return the updated document
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true } // new: true returns the updated document
    ).select('-otp -otpExpires -authToken -authTokenExpires -deleteToken -deleteTokenExpiration');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log('User after update:', user);
    
    // Convert to object and add full image URL if profile image exists
    const userObj = user.toObject();
    if (userObj.profileImage) {
      const normalizedPath = userObj.profileImage.replace(/\\/g, '/');
      userObj.profileImageUrl = `${req.protocol}://${req.get('host')}/${normalizedPath}`;
    } else {
      userObj.profileImageUrl = null;
    }
    
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: userObj
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        message: 'Email or mobile already exists' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};
/**
 * Update profile image
 * POST /api/profile/update-image/:userId
 * Form-data: profileImage (file)
 */
export const updateProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      // Delete uploaded file if user not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Delete old profile image if exists
    if (user.profileImage) {
      const oldImagePath = path.join(process.cwd(), user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // Update with new image path
    user.profileImage = req.file.path;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Profile image updated successfully',
      profileImage: getImageUrl(req, req.file.path), // ✅ returns full URL
    });
  } catch (error) {
    console.error('updateProfileImage error:', error);
    // Delete uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Delete profile image
 * DELETE /api/profile/delete-image/:userId
 */

export const deleteProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (user.profileImage) {
      const imagePath = path.join(process.cwd(), user.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      user.profileImage = null;
      await user.save();
    }
    
    return res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully'
    });
  } catch (error) {
    console.error('deleteProfileImage error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Update live location
 * PUT /api/profile/live-location/:userId
 * Body: { latitude, longitude, address }
 */
export const updateLiveLocation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.liveLocation = {
      latitude,
      longitude,
      updatedAt: new Date()
    };
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Live location updated successfully',
      liveLocation: user.liveLocation
    });
  } catch (error) {
    console.error('updateLiveLocation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get live location
 * GET /api/profile/live-location/:userId
 */
export const getLiveLocation = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('liveLocation');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    return res.status(200).json({
      success: true,
      liveLocation: user.liveLocation || null
    });
  } catch (error) {
    console.error('getLiveLocation error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const addAddress = async (req, res) => {
  try {
    const { userId } = req.params;
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "addresses array is required"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    for (const addr of addresses) {
      const {
        type,
        fullName,
        mobile,
        pincode,
        address,
        city,
        state,
        landmark,
        isDefault
      } = addr;

      if (!fullName || !mobile || !pincode || !address || !city || !state) {
        return res.status(400).json({
          success: false,
          message: "All required fields must be filled"
        });
      }

      // Remove old default
      if (isDefault) {
        user.addresses.forEach(a => {
          a.isDefault = false;
        });
      }

      user.addresses.push({
        type: type || "home",
        fullName,
        mobile,
        pincode,
        address,
        city,
        state,
        landmark: landmark || "",
        isDefault: isDefault || false
      });
    }

    await user.save();

    return res.status(201).json({
      success: true,
      message: "Addresses added successfully",
      addresses: user.addresses
    });

  } catch (error) {
    console.error("addAddress error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * Get all addresses
 * GET /api/address/all/:userId
 */
export const getAllAddresses = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('addresses');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      addresses: user.addresses
    });
  } catch (error) {
    console.error('getAllAddresses error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get address by ID
 * GET /api/address/:userId/:addressId
 */
export const getAddressById = async (req, res) => {
  try {
    const { userId, addressId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    return res.status(200).json({
      success: true,
      address
    });
  } catch (error) {
    console.error('getAddressById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Update address
 * PUT /api/address/update/:userId/:addressId
 * Body: { type, fullName, mobile, pincode, address, city, state, landmark, isDefault }
 */
export const updateAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const updateData = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // Update fields
    if (updateData.type) address.type = updateData.type;
    if (updateData.fullName) address.fullName = updateData.fullName;
    if (updateData.mobile) address.mobile = updateData.mobile;
    if (updateData.pincode) address.pincode = updateData.pincode;
    if (updateData.address) address.address = updateData.address;
    if (updateData.city) address.city = updateData.city;
    if (updateData.state) address.state = updateData.state;
    if (updateData.landmark) address.landmark = updateData.landmark;

    // Handle default address update
    if (updateData.isDefault && !address.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
      address.isDefault = true;
    } else if (updateData.isDefault === false) {
      address.isDefault = false;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      address
    });
  } catch (error) {
    console.error('updateAddress error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Delete address
 * DELETE /api/address/delete/:userId/:addressId
 */
export const deleteAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    // Check if deleting default address
    const wasDefault = address.isDefault;

    address.deleteOne();

    // If deleted address was default, set another address as default if exists
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('deleteAddress error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};



// ==================== TOGGLE WISHLIST (Only Product ID) ====================
export const toggleWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId } = req.body;

    console.log('=== TOGGLE WISHLIST ===');
    console.log('userId:', userId);
    console.log('productId:', productId);

    // Validate
    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product ID is required' 
      });
    }

    // Check product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Initialize wishlist if needed
    if (!user.wishlist) {
      user.wishlist = [];
    }

    // Check if already in wishlist (by productId only)
    const existingIndex = user.wishlist.findIndex(
      item => item.productId?.toString() === productId
    );

    let message = '';
    let isInWishlist = false;

    if (existingIndex !== -1) {
      // Remove from wishlist
      user.wishlist.splice(existingIndex, 1);
      message = 'Removed from wishlist';
      isInWishlist = false;
    } else {
      // Add to wishlist - push an OBJECT with productId only
      user.wishlist.push({
        productId: productId,
        addedAt: new Date()
      });
      message = 'Added to wishlist';
      isInWishlist = true;
    }

    await user.save();

    // Get updated wishlist with populated product data
    const updatedUser = await User.findById(userId).populate({
      path: 'wishlist.productId',
      select: 'name description displayPrice displayActualPrice maxDiscount variants averageRating'
    });

    // Transform wishlist items
    const wishlistItems = (updatedUser.wishlist || []).map(item => {
      const productData = item.productId;
      const firstVariant = productData?.variants?.[0];
      const mainImage = firstVariant?.images?.[0] || productData?.mainImages?.[0] || null;
      
      return {
        _id: item._id,
        productId: productData?._id,
        productName: productData?.name,
        productDescription: productData?.description,
        displayPrice: productData?.displayPrice,
        displayActualPrice: productData?.displayActualPrice,
        maxDiscount: productData?.maxDiscount,
        mainImage: mainImage,
        averageRating: productData?.averageRating || 0,
        variantsCount: productData?.variants?.length || 0,
        addedAt: item.addedAt
      };
    });

    return res.status(200).json({
      success: true,
      message: message,
      isInWishlist: isInWishlist,
      count: wishlistItems.length,
      wishlist: wishlistItems
    });

  } catch (error) {
    console.error('toggleWishlist error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // If wishlist is empty or not exists, return empty array
    if (!user.wishlist || user.wishlist.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        wishlist: []
      });
    }

    // ✅ Filter out invalid wishlist items (where productId is undefined or null)
    const validWishlistItems = user.wishlist.filter(item => 
      item && item.productId && item.productId.toString
    );

    // If all items were invalid, clean up and return empty
    if (validWishlistItems.length === 0) {
      user.wishlist = [];
      await user.save();
      return res.status(200).json({
        success: true,
        count: 0,
        cleanedUp: true,
        removedCount: user.wishlist.length,
        wishlist: []
      });
    }

    // Get all product IDs from valid wishlist items
    const productIds = validWishlistItems.map(item => item.productId.toString());
    
    // Find which products actually exist in database
    const existingProducts = await Product.find({
      _id: { $in: productIds }
    }).select('name description displayPrice displayActualPrice maxDiscount variants averageRating mainImages isActive');
    
    // Get IDs of existing products
    const existingProductIds = existingProducts.map(p => p._id.toString());
    
    // Find invalid product IDs (in wishlist but not in database)
    const invalidItems = validWishlistItems.filter(
      item => !existingProductIds.includes(item.productId.toString())
    );
    
    // Remove invalid products from wishlist
    let cleanedUp = false;
    if (invalidItems.length > 0) {
      // Keep only valid wishlist items
      user.wishlist = validWishlistItems.filter(
        item => existingProductIds.includes(item.productId.toString())
      );
      await user.save();
      cleanedUp = true;
      console.log(`🗑️ Removed ${invalidItems.length} invalid product(s) from wishlist`);
    }
    
    // Create a map for quick product lookup
    const productMap = {};
    existingProducts.forEach(product => {
      productMap[product._id.toString()] = product;
    });
    
    // Transform wishlist items
    const wishlistItems = user.wishlist.map(item => {
      const productData = productMap[item.productId.toString()];
      
      if (!productData) return null;
      
      const firstVariant = productData.variants?.[0];
      const mainImage = firstVariant?.images?.[0] || productData.mainImages?.[0] || null;
      
      return {
        _id: item._id,
        productId: productData._id,
        productName: productData.name,
        productDescription: productData.description,
        displayPrice: productData.displayPrice,
        displayActualPrice: productData.displayActualPrice,
        maxDiscount: productData.maxDiscount,
        mainImage: mainImage,
        averageRating: productData.averageRating || 0,
        variantsCount: productData.variants?.length || 0,
        isActive: productData.isActive,
        addedAt: item.addedAt
      };
    }).filter(item => item !== null);
    
    return res.status(200).json({
      success: true,
      count: wishlistItems.length,
      cleanedUp: cleanedUp,
      removedCount: invalidItems.length,
      wishlist: wishlistItems
    });
    
  } catch (error) {
    console.error('getWishlist error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== CART CONTROLLERS ====================

// Add to cart (with productId, variantId, sizeId, quantity)
export const addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId, variantId, sizeId, quantity = 1 } = req.body;

    console.log('=== ADD TO CART ===');
    console.log('userId:', userId);
    console.log('productId:', productId);
    console.log('variantId:', variantId);
    console.log('sizeId:', sizeId);
    console.log('quantity:', quantity);

    // Validate required fields
    if (!productId || !variantId || !sizeId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, Variant ID, and Size ID are required'
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get product and variant
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    // Find the specific size
    const sizeObj = variant.sizes.id(sizeId);
    if (!sizeObj) {
      return res.status(404).json({ success: false, message: 'Size not found' });
    }

    // Check stock
    if (sizeObj.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${sizeObj.stock} items available in stock for size ${sizeObj.size}`
      });
    }

    // Get price
    const price = variant.discountPrice || variant.price;
    const discountPrice = variant.discountPrice;

    // Check if already in cart (same product, variant, AND size)
    const existingItemIndex = user.cart.findIndex(
      item => item.productId.toString() === productId && 
              item.variantId.toString() === variantId && 
              item.sizeId.toString() === sizeId
    );

    let isNewItem = false;

    if (existingItemIndex !== -1) {
      // Update quantity if already exists
      const newQuantity = user.cart[existingItemIndex].quantity + quantity;
      if (newQuantity > sizeObj.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than ${sizeObj.stock} items for size ${sizeObj.size}`
        });
      }
      user.cart[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item to cart
      user.cart.push({
        productId,
        variantId,
        sizeId,
        variant: {
          color: variant.color,
          size: sizeObj.size,
          actualPrice: variant.price,
          discountPrice: discountPrice,
          mainImage: variant.images?.[0] || product.mainImages?.[0] || ''
        },
        quantity,
        price: price,
        addedAt: new Date()
      });
      isNewItem = true;
    }

    await user.save();

    // Get updated cart with populated product details
    const updatedUser = await User.findById(userId).populate({
      path: 'cart.productId',
      select: 'name description displayPrice displayActualPrice maxDiscount'
    });

    // Transform cart items
    const cartItems = updatedUser.cart.map(item => {
      const productData = item.productId;
      return {
        _id: item._id,
        productId: item.productId._id,
        productName: productData?.name,
        productDescription: productData?.description,
        displayPrice: productData?.displayPrice,
        variantId: item.variantId,
        color: item.variant.color,
        size: item.variant.size,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.price * item.quantity,
        mainImage: item.variant.mainImage,
        addedAt: item.addedAt
      };
    });

    // Calculate cart summary
    const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: isNewItem ? 'Added to cart' : 'Cart updated',
      cart: {
        items: cartItems,
        summary: {
          subtotal,
          totalItems
        }
      }
    });

  } catch (error) {
    console.error('addToCart error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get cart
export const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate({
      path: 'cart.productId',
      select: 'name description displayPrice displayActualPrice maxDiscount'
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.cart || user.cart.length === 0) {
      return res.status(200).json({
        success: true,
        cart: {
          items: [],
          summary: {
            subtotal: 0,
            totalItems: 0
          }
        }
      });
    }

    // Verify all cart items still exist and have stock
    let cartUpdated = false;
    const validCartItems = [];

    for (const item of user.cart) {
      const product = await Product.findById(item.productId);
      if (!product) {
        cartUpdated = true;
        console.log(`Removing invalid product: ${item.productId}`);
        continue;
      }

      const variant = product.variants.id(item.variantId);
      if (!variant) {
        cartUpdated = true;
        console.log(`Removing invalid variant: ${item.variantId}`);
        continue;
      }

      const sizeObj = variant.sizes.id(item.sizeId);
      if (!sizeObj) {
        cartUpdated = true;
        console.log(`Removing invalid size: ${item.sizeId}`);
        continue;
      }

      // Update price if changed
      const currentPrice = variant.discountPrice || variant.price;
      if (currentPrice !== item.price) {
        item.price = currentPrice;
        cartUpdated = true;
      }

      // Update variant info if needed
      if (item.variant.color !== variant.color || item.variant.size !== sizeObj.size) {
        item.variant.color = variant.color;
        item.variant.size = sizeObj.size;
        item.variant.mainImage = variant.images?.[0] || product.mainImages?.[0] || '';
        cartUpdated = true;
      }

      // Check if quantity exceeds stock
      if (item.quantity > sizeObj.stock) {
        item.quantity = sizeObj.stock;
        cartUpdated = true;
      }

      validCartItems.push(item);
    }

    if (cartUpdated) {
      user.cart = validCartItems;
      await user.save();
    }

    // Transform cart items
    const cartItems = validCartItems.map(item => {
      const productData = item.productId;
      return {
        _id: item._id,
        productId: item.productId._id,
        productName: productData?.name,
        productDescription: productData?.description,
        displayPrice: productData?.displayPrice,
        displayActualPrice: productData?.displayActualPrice,
        maxDiscount: productData?.maxDiscount,
        variantId: item.variantId,
        color: item.variant.color,
        size: item.variant.size,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.price * item.quantity,
        mainImage: item.variant.mainImage,
        addedAt: item.addedAt
      };
    });

    const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return res.status(200).json({
      success: true,
      cart: {
        items: cartItems,
        summary: {
          subtotal,
          totalItems
        }
      }
    });

  } catch (error) {
    console.error('getCart error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update cart item quantity
export const updateCartQuantity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { cartItemId, quantity } = req.body;

    console.log('=== UPDATE CART QUANTITY ===');
    console.log('userId:', userId);
    console.log('cartItemId:', cartItemId);
    console.log('quantity:', quantity);

    if (!cartItemId) {
      return res.status(400).json({
        success: false,
        message: 'Cart item ID is required'
      });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const cartItem = user.cart.id(cartItemId);
    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    // Check stock
    const product = await Product.findById(cartItem.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const variant = product.variants.id(cartItem.variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    const sizeObj = variant.sizes.id(cartItem.sizeId);
    if (!sizeObj) {
      return res.status(404).json({ success: false, message: 'Size not found' });
    }

    if (sizeObj.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${sizeObj.stock} items available for size ${sizeObj.size}`
      });
    }

    cartItem.quantity = quantity;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cart updated',
      cartItem: {
        _id: cartItem._id,
        productName: product.name,
        color: cartItem.variant.color,
        size: cartItem.variant.size,
        quantity: cartItem.quantity,
        price: cartItem.price,
        totalPrice: cartItem.price * cartItem.quantity
      }
    });

  } catch (error) {
    console.error('updateCartQuantity error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { cartItemId } = req.body;

    console.log('=== REMOVE FROM CART ===');
    console.log('userId:', userId);
    console.log('cartItemId:', cartItemId);

    if (!cartItemId) {
      return res.status(400).json({
        success: false,
        message: 'Cart item ID is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const cartItem = user.cart.id(cartItemId);
    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    user.cart = user.cart.filter(item => item._id.toString() !== cartItemId);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Removed from cart',
      removedItemId: cartItemId
    });

  } catch (error) {
    console.error('removeFromCart error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Clear entire cart
export const clearCart = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log('=== CLEAR CART ===');
    console.log('userId:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const itemCount = user.cart.length;
    user.cart = [];
    await user.save();

    return res.status(200).json({
      success: true,
      message: `${itemCount} item(s) cleared from cart`
    });

  } catch (error) {
    console.error('clearCart error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};




// Generate unique order ID
const generateOrderId = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${timestamp}${random}`;
};


// Create order from cart
export const createOrder = async (req, res) => {
  try {
    const { userId } = req.params;
    const { addressId, paymentMethod } = req.body;

    if (!addressId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Address ID and payment method are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.cart || user.cart.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const deliveryAddress = user.addresses.id(addressId);
    if (!deliveryAddress) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    let totalAmount = 0;
    const orderItems = [];

    // Process cart items
    for (const cartItem of user.cart) {
      const product = await Product.findById(cartItem.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found` });
      }

      const variant = product.variants.id(cartItem.variantId);
      if (!variant) {
        return res.status(404).json({ success: false, message: `Variant not found` });
      }

      const sizeObj = variant.sizes.id(cartItem.sizeId);
      if (!sizeObj) {
        return res.status(404).json({ success: false, message: `Size not found` });
      }

      if (sizeObj.stock < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `${product.name} - ${variant.color} ${sizeObj.size} only ${sizeObj.stock} left`
        });
      }

      // Reduce stock
      sizeObj.stock -= cartItem.quantity;
      await product.save();

      totalAmount += cartItem.price * cartItem.quantity;

      orderItems.push({
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        sizeId: cartItem.sizeId,
        variant: cartItem.variant,
        quantity: cartItem.quantity,
        price: cartItem.price,
        status: 'pending'
      });
    }

    // ✅ Save to separate Order collection
    const newOrder = new Order({
      orderId: generateOrderId(),
      userId,
      items: orderItems,
      subtotal: totalAmount,
      deliveryCharge: 0,
      platformFee: 0,
      totalAmount,
      finalAmount: totalAmount,
      deliveryAddress: deliveryAddress.toObject(),
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      orderStatus: 'pending'
    });

    await newOrder.save();

    // Clear cart
    user.cart = [];
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        _id: newOrder._id,
        orderId: newOrder.orderId,
        finalAmount: newOrder.finalAmount,
        paymentMethod: newOrder.paymentMethod,
        orderStatus: newOrder.orderStatus,
        itemsCount: newOrder.items.length
      }
    });

  } catch (error) {
    console.error('createOrder error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get user orders
export const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let query = { userId };
    if (status && status !== 'all') {
      query.orderStatus = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    // Get order status counts
    const statusCounts = await Order.aggregate([
      { $match: { userId } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
    ]);

    const statusMap = {
      pending: 0, confirmed: 0, processing: 0,
      shipped: 0, delivered: 0, cancelled: 0
    };
    statusCounts.forEach(item => { statusMap[item._id] = item.count; });

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      statusCounts: statusMap,
      orders
    });

  } catch (error) {
    console.error('getUserOrders error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get order by ID
export const getOrderById = async (req, res) => {
  try {
    const { userId, orderId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const order = await Order.findOne({ userId, orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({
      success: true,
      order
    });

  } catch (error) {
    console.error('getOrderById error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel order
export const cancelOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const order = await Order.findOne({ userId, orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.orderStatus !== 'pending' && order.orderStatus !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.orderStatus}`
      });
    }

    // Restore stock
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        const variant = product.variants.id(item.variantId);
        if (variant) {
          const sizeObj = variant.sizes.id(item.sizeId);
          if (sizeObj) {
            sizeObj.stock += item.quantity;
            await product.save();
          }
        }
      }
    }

    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by user';
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        cancelledAt: order.cancelledAt
      }
    });

  } catch (error) {
    console.error('cancelOrder error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * Get active login screen media
 * GET /api/login-screen/media
 */
export const getLoginScreenMedia = async (req, res) => {
  try {
    const media = await LoginScreenMedia.findOne().sort({ createdAt: -1 });

    if (!media) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No login screen media configured'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        type: media.type,
        url: media.url,
        filename: media.filename
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== HOMEPAGE CONTROLLERS ====================

/**
 * Get active hero sections for users
 * GET /api/homepage/hero
 */
export const getUserHeroSections = async (req, res) => {
  try {
    const homePage = await HomePage.findOne();
    
    if (!homePage) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const activeHeroSections = homePage.heroSections
      .filter(h => h.isActive)
      .sort((a, b) => a.order - b.order)
      .map(h => {
        // For YouTube, also provide extracted video ID for easy embedding
        if (h.type === 'youtube') {
          const youtubeId = extractYouTubeId(h.url);
          return {
            type: h.type,
            url: h.url,
            youtubeId: youtubeId,
            filename: h.filename
          };
        }
        return {
          type: h.type,
          url: h.url,
          filename: h.filename
        };
      });

    return res.status(200).json({
      success: true,
      data: activeHeroSections
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get active banner sections for users
 * GET /api/homepage/banner
 */
export const getUserBannerSections = async (req, res) => {
  try {
    const homePage = await HomePage.findOne();
    
    if (!homePage) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const activeBanners = homePage.banners
      .filter(b => b.isActive)
      .sort((a, b) => a.order - b.order);

    return res.status(200).json({
      success: true,
      data: activeBanners
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get complete home page (all sections)
 * GET /api/homepage
 */
export const getHomePage = async (req, res) => {
  try {
    const homePage = await HomePage.findOne();
    
    if (!homePage) {
      return res.status(200).json({
        success: true,
        data: {
          heroSections: [],
          banners: []
        }
      });
    }

    const activeHeroSections = homePage.heroSections
      .filter(h => h.isActive)
      .sort((a, b) => a.order - b.order)
      .map(h => {
        if (h.type === 'youtube') {
          const youtubeId = extractYouTubeId(h.url);
          return {
            type: h.type,
            url: h.url,
            youtubeId: youtubeId,
            filename: h.filename
          };
        }
        return {
          type: h.type,
          url: h.url,
          filename: h.filename
        };
      });

    const activeBanners = homePage.banners
      .filter(b => b.isActive)
      .sort((a, b) => a.order - b.order);

    return res.status(200).json({
      success: true,
      data: {
        heroSections: activeHeroSections,
        banners: activeBanners
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== COLLECTION CONTROLLERS ====================
/**
 * Get all active collections for users
 * GET /api/collections
 */
export const getUserCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ isActive: true })
      .select('title tag description image order')
      .sort({ order: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: collections.length,
      data: collections
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get single collection with full product details
 * GET /api/collections/:collectionId
 */
export const getUserCollectionById = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findOne({ 
      _id: collectionId, 
      isActive: true 
    }).populate('products');  // This gives you collection + all products

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: collection
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Home Page Collections
export const getHomepageCollections = async (req, res) => {
  try {
    const homepage = await HomePage.findOne();
    
    if (!homepage || !homepage.homepageCollections || homepage.homepageCollections.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    // Populate collections with their products
    const populatedHomepage = await HomePage.findById(homepage._id)
      .populate({
        path: 'homepageCollections.collectionId',
        match: { isActive: true },
        populate: {
          path: 'products',
          model: 'Product',
          match: { isActive: true }
        }
      });

    // Filter active collections and sort by order
    const activeCollections = populatedHomepage.homepageCollections
      .filter(item => item.isActive && item.collectionId)
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        _id: item.collectionId._id,
        title: item.collectionId.title,
        tag: item.collectionId.tag,
        description: item.collectionId.description,
        image: item.collectionId.image,
        order: item.order,
        products: item.collectionId.products || []
      }));

    return res.status(200).json({
      success: true,
      count: activeCollections.length,
      data: activeCollections
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getRecommendedProducts = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const recommended = await RecommendedProduct.find({ isActive: true })
      .populate({
        path: 'productId',
        select: 'name description displayPrice displayActualPrice maxDiscount mainImages variants averageRating isActive',
        match: { isActive: true }
      })
      .limit(parseInt(limit));

    const products = recommended
      .filter(item => item.productId !== null)
      .map(item => {
        const product = item.productId;
        if (!product || product.isActive === false) return null;
        const firstVariant = product.variants?.[0];
        const mainImage = firstVariant?.images?.[0] || product.mainImages?.[0] || null;
        return {
          _id: product._id,
          name: product.name,
          description: product.description,
          displayPrice: product.displayPrice,
          displayActualPrice: product.displayActualPrice,
          maxDiscount: product.maxDiscount,
          mainImage: mainImage,
          averageRating: product.averageRating || 0
        };
      })
      .filter(p => p !== null);

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('getRecommendedProducts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Controller/userLatestDesignController.js

export const getActiveLatestDesigns = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const latestDesigns = await LatestDesign.find({ isActive: true })
      .populate({
        path: 'productId',
        select: 'name description displayPrice displayActualPrice maxDiscount mainImages variants averageRating isActive',
        match: { isActive: true }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const products = latestDesigns
      .filter(item => item.productId !== null)
      .map(item => {
        const product = item.productId;
        if (!product || product.isActive === false) return null;
        const firstVariant = product.variants?.[0];
        const mainImage = firstVariant?.images?.[0] || product.mainImages?.[0] || null;
        return {
          _id: product._id,
          name: product.name,
          description: product.description,
          displayPrice: product.displayPrice,
          displayActualPrice: product.displayActualPrice,
          maxDiscount: product.maxDiscount,
          mainImage: mainImage,
          averageRating: product.averageRating || 0
        };
      })
      .filter(p => p !== null);

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('getActiveLatestDesigns error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Menu DropDown

// export const getFullMenu = async (req, res) => {
//   try {
//     const {
//       categoryId,
//       subcategoryId,
//       colors,
//       sizes,
//       minPrice,
//       maxPrice,
//       sortBy = 'newest',
//       page = 1,
//       limit = 20
//     } = req.query;

//     // Get all active categories
//     const categories = await Category.find({ isActive: true })
//       .select('name isActive')
//       .sort({ name: 1 });

//     // If no categoryId, return only categories
//     if (!categoryId) {
//       return res.status(200).json({
//         success: true,
//         data: {
//           categories: categories.map(cat => ({
//             id: cat._id,
//             name: cat.name,
//             isActive: cat.isActive
//           }))
//         }
//       });
//     }

//     // Get selected category
//     const selectedCategory = await Category.findById(categoryId);
//     if (!selectedCategory) {
//       return res.status(404).json({
//         success: false,
//         message: 'Category not found'
//       });
//     }

//     // Get active subcategories
//     const subcategories = selectedCategory.subcategories
//       .filter(sub => sub.isActive === true)
//       .map(sub => ({
//         id: sub._id,
//         name: sub.name,
//         image: sub.image,
//         isActive: sub.isActive
//       }));

//     // If no subcategoryId, return categories and subcategories
//     if (!subcategoryId) {
//       return res.status(200).json({
//         success: true,
//         data: {
//           categories: categories.map(cat => ({
//             id: cat._id,
//             name: cat.name,
//             isActive: cat.isActive
//           })),
//           selectedCategory: {
//             id: selectedCategory._id,
//             name: selectedCategory.name
//           },
//           subcategories
//         }
//       });
//     }

//     // Verify subcategory exists and is active
//     const selectedSubcategory = selectedCategory.subcategories.id(subcategoryId);
//     if (!selectedSubcategory || !selectedSubcategory.isActive) {
//       return res.status(404).json({
//         success: false,
//         message: 'Subcategory not found'
//       });
//     }

//     // Base query for products
//     const baseQuery = {
//       subcategoryId: subcategoryId,
//       isActive: true,
//       approvalStatus: { $in: ['approved', 'not_required'] }
//     };

//     // Get all products in this subcategory for filter extraction
//     const allProductsInSubcategory = await Product.find(baseQuery)
//       .select('variants')
//       .lean();

//     // Extract all unique colors and sizes
//     const allColorsSet = new Set();
//     const allSizesSet = new Set();

//     allProductsInSubcategory.forEach(product => {
//       if (product.variants && Array.isArray(product.variants)) {
//         product.variants.forEach(variant => {
//           // Extract colors
//           if (variant.color && variant.color.trim()) {
//             allColorsSet.add(variant.color);
//           }
          
//           // Extract sizes
//           if (variant.sizes && Array.isArray(variant.sizes)) {
//             variant.sizes.forEach(sizeObj => {
//               if (sizeObj.size && sizeObj.size.trim()) {
//                 allSizesSet.add(sizeObj.size);
//               }
//             });
//           }
//         });
//       }
//     });

//     const allAvailableColors = Array.from(allColorsSet).sort();
//     const allAvailableSizes = Array.from(allSizesSet).sort();

//     // Get price range
//     const priceAggregation = await Product.aggregate([
//       { $match: baseQuery },
//       {
//         $group: {
//           _id: null,
//           minPrice: { $min: '$displayPrice' },
//           maxPrice: { $max: '$displayPrice' }
//         }
//       }
//     ]);

//     const priceRange = priceAggregation.length > 0 && priceAggregation[0].minPrice !== undefined
//       ? { min: priceAggregation[0].minPrice, max: priceAggregation[0].maxPrice }
//       : { min: 0, max: 0 };

//     // Build filtered query for products
//     let filteredQuery = { ...baseQuery };

//     // Apply filters
//     if (colors && colors.trim()) {
//       const colorArray = colors.split(',').map(c => c.trim());
//       filteredQuery['variants.color'] = { $in: colorArray };
//     }

//     if (sizes && sizes.trim()) {
//       const sizeArray = sizes.split(',').map(s => s.trim());
//       filteredQuery['variants.sizes.size'] = { $in: sizeArray };
//     }

//     if (minPrice || maxPrice) {
//       filteredQuery.displayPrice = {};
//       if (minPrice) filteredQuery.displayPrice.$gte = parseFloat(minPrice);
//       if (maxPrice) filteredQuery.displayPrice.$lte = parseFloat(maxPrice);
//     }

//     // Pagination
//     const pageNum = parseInt(page) || 1;
//     const limitNum = parseInt(limit) || 20;
//     const skip = (pageNum - 1) * limitNum;

//     // Sorting
//     let sort = {};
//     switch (sortBy) {
//       case 'price_asc':
//         sort.displayPrice = 1;
//         break;
//       case 'price_desc':
//         sort.displayPrice = -1;
//         break;
//       case 'rating_desc':
//         sort.averageRating = -1;
//         break;
//       case 'newest':
//         sort.createdAt = -1;
//         break;
//       default:
//         sort.createdAt = -1;
//     }

//     // Get filtered products
//     const products = await Product.find(filteredQuery)
//       .sort(sort)
//       .skip(skip)
//       .limit(limitNum);

//     const total = await Product.countDocuments(filteredQuery);

//     // Transform products
//     const transformedProducts = products.map(product => {
//       const productObj = product.toObject();
      
//       const productColors = [];
//       const productSizes = [];
      
//       if (productObj.variants && Array.isArray(productObj.variants)) {
//         productObj.variants.forEach(variant => {
//           if (variant.color && !productColors.includes(variant.color)) {
//             productColors.push(variant.color);
//           }
          
//           if (variant.sizes && Array.isArray(variant.sizes)) {
//             variant.sizes.forEach(sizeObj => {
//               if (sizeObj.size && !productSizes.includes(sizeObj.size)) {
//                 productSizes.push(sizeObj.size);
//               }
//             });
//           }
//         });
//       }
      
//       const firstVariant = productObj.variants?.find(v => v.images && v.images.length > 0);
//       const mainImage = firstVariant?.images?.[0] || productObj.mainImages?.[0] || null;
      
//       return {
//         id: productObj._id,
//         name: productObj.name,
//         description: productObj.description,
//         displayPrice: productObj.displayPrice,
//         originalPrice: productObj.displayActualPrice,
//         discount: productObj.maxDiscount,
//         mainImage: mainImage,
//         colors: productColors,
//         sizes: productSizes,
//         rating: productObj.averageRating || 0,
//         createdAt: productObj.createdAt
//       };
//     });

//     // Get available colors/sizes based on current filters
//     let availableColors = allAvailableColors;
//     let availableSizes = allAvailableSizes;

//     if (colors || sizes || minPrice || maxPrice) {
//       const filteredProducts = await Product.find(filteredQuery)
//         .select('variants')
//         .lean();
      
//       const filteredColorsSet = new Set();
//       const filteredSizesSet = new Set();
      
//       filteredProducts.forEach(product => {
//         if (product.variants && Array.isArray(product.variants)) {
//           product.variants.forEach(variant => {
//             if (variant.color && variant.color.trim()) {
//               filteredColorsSet.add(variant.color);
//             }
//             if (variant.sizes && Array.isArray(variant.sizes)) {
//               variant.sizes.forEach(sizeObj => {
//                 if (sizeObj.size && sizeObj.size.trim()) {
//                   filteredSizesSet.add(sizeObj.size);
//                 }
//               });
//             }
//           });
//         }
//       });
      
//       availableColors = Array.from(filteredColorsSet).sort();
//       availableSizes = Array.from(filteredSizesSet).sort();
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         categories: categories.map(cat => ({
//           id: cat._id,
//           name: cat.name,
//           isActive: cat.isActive
//         })),
//         selectedCategory: {
//           id: selectedCategory._id,
//           name: selectedCategory.name
//         },
//         subcategories,
//         selectedSubcategory: {
//           id: selectedSubcategory._id,
//           name: selectedSubcategory.name,
//           image: selectedSubcategory.image,
//           isActive: selectedSubcategory.isActive
//         },
//         filters: {
//           allColors: allAvailableColors,
//           allSizes: allAvailableSizes,
//           availableColors: availableColors,
//           availableSizes: availableSizes,
//           priceRange: priceRange,
//           activeFilters: {
//             colors: colors ? colors.split(',').map(c => c.trim()) : [],
//             sizes: sizes ? sizes.split(',').map(s => s.trim()) : [],
//             minPrice: minPrice ? parseFloat(minPrice) : null,
//             maxPrice: maxPrice ? parseFloat(maxPrice) : null
//           }
//         },
//         products: {
//           data: transformedProducts,
//           pagination: {
//             total: total,
//             filtered: total,
//             page: pageNum,
//             pages: Math.ceil(total / limitNum),
//             limit: limitNum
//           }
//         }
//       }
//     });

//   } catch (error) {
//     console.error('getFullMenu error:', error);
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// export const getFullMenu = async (req, res) => {
//   try {
//     const {
//       categoryId,
//       subcategoryId,
//       colors,
//       sizes,
//       minPrice,
//       maxPrice,
//       sortBy = 'newest',
//       page = 1,
//       limit = 20
//     } = req.query;

//     // Get all active categories with their subcategories
//     const categories = await Category.find({ isActive: true })
//       .select('name image description isActive subcategories')
//       .sort({ name: 1 });

//     // Transform categories to include subcategories
//     const transformedCategories = categories.map(cat => ({
//       id: cat._id,
//       name: cat.name,
//       image: cat.image || null,
//       description: cat.description || null,
//       isActive: cat.isActive,
//       subcategories: cat.subcategories
//         .filter(sub => sub.isActive === true)
//         .map(sub => ({
//           id: sub._id,
//           name: sub.name,
//           image: sub.image || null,
//           description: sub.description || null,
//           isActive: sub.isActive
//         }))
//     }));

//     // Level 1: If no categoryId, return all categories with subcategories
//     if (!categoryId) {
//       return res.status(200).json({
//         success: true,
//         level: 'categories',
//         data: {
//           categories: transformedCategories
//         }
//       });
//     }

//     // Find selected category
//     const selectedCategory = categories.find(cat => cat._id.toString() === categoryId);
//     if (!selectedCategory) {
//       return res.status(404).json({
//         success: false,
//         message: 'Category not found'
//       });
//     }

//     // Get active subcategories for selected category
//     const subcategories = selectedCategory.subcategories
//       .filter(sub => sub.isActive === true)
//       .map(sub => ({
//         id: sub._id,
//         name: sub.name,
//         image: sub.image || null,
//         description: sub.description || null,
//         isActive: sub.isActive
//       }));

//     // Level 2: If no subcategoryId, return categories with subcategories and mark selected
//     if (!subcategoryId) {
//       return res.status(200).json({
//         success: true,
//         level: 'subcategories',
//         data: {
//           categories: transformedCategories.map(cat => ({
//             ...cat,
//             isSelected: cat.id === categoryId
//           })),
//           selectedCategory: {
//             id: selectedCategory._id,
//             name: selectedCategory.name,
//             image: selectedCategory.image || null,
//             description: selectedCategory.description || null
//           },
//           subcategories
//         }
//       });
//     }

//     // Verify subcategory exists and is active
//     const selectedSubcategory = selectedCategory.subcategories.find(
//       sub => sub._id.toString() === subcategoryId && sub.isActive === true
//     );
    
//     if (!selectedSubcategory) {
//       return res.status(404).json({
//         success: false,
//         message: 'Subcategory not found'
//       });
//     }

//     // Level 3: Return full menu with products and filters
//     // Base query for products
//     const baseQuery = {
//       subcategoryId: subcategoryId,
//       isActive: true,
//       approvalStatus: { $in: ['approved', 'not_required'] }
//     };

//     // Get all products in this subcategory for filter extraction
//     const allProductsInSubcategory = await Product.find(baseQuery)
//       .select('variants displayPrice')
//       .lean();

//     // Extract all unique colors and sizes
//     const allColorsSet = new Set();
//     const allSizesSet = new Set();
//     let minProductPrice = Infinity;
//     let maxProductPrice = -Infinity;

//     allProductsInSubcategory.forEach(product => {
//       if (product.variants && Array.isArray(product.variants)) {
//         product.variants.forEach(variant => {
//           // Extract colors
//           if (variant.color && typeof variant.color === 'string' && variant.color.trim()) {
//             allColorsSet.add(variant.color);
//           }
          
//           // Extract sizes
//           if (variant.sizes && Array.isArray(variant.sizes)) {
//             variant.sizes.forEach(sizeObj => {
//               if (sizeObj.size && typeof sizeObj.size === 'string' && sizeObj.size.trim()) {
//                 allSizesSet.add(sizeObj.size);
//               }
//             });
//           }
//         });
//       }
      
//       // Track price range
//       if (product.displayPrice !== undefined && product.displayPrice !== null) {
//         minProductPrice = Math.min(minProductPrice, product.displayPrice);
//         maxProductPrice = Math.max(maxProductPrice, product.displayPrice);
//       }
//     });

//     const allAvailableColors = Array.from(allColorsSet).sort();
//     const allAvailableSizes = Array.from(allSizesSet).sort();
//     const priceRange = {
//       min: minProductPrice !== Infinity ? minProductPrice : 0,
//       max: maxProductPrice !== -Infinity ? maxProductPrice : 0
//     };

//     // Build filtered query for products
//     let filteredQuery = { ...baseQuery };

//     // Apply color filter
//     if (colors && colors.trim()) {
//       const colorArray = colors.split(',').map(c => c.trim());
//       filteredQuery['variants.color'] = { $in: colorArray };
//     }

//     // Apply size filter
//     if (sizes && sizes.trim()) {
//       const sizeArray = sizes.split(',').map(s => s.trim());
//       filteredQuery['variants.sizes.size'] = { $in: sizeArray };
//     }

//     // Apply price filter
//     if (minPrice || maxPrice) {
//       filteredQuery.displayPrice = {};
//       if (minPrice) filteredQuery.displayPrice.$gte = parseFloat(minPrice);
//       if (maxPrice) filteredQuery.displayPrice.$lte = parseFloat(maxPrice);
//     }

//     // Pagination
//     const pageNum = parseInt(page) || 1;
//     const limitNum = parseInt(limit) || 20;
//     const skip = (pageNum - 1) * limitNum;

//     // Sorting
//     let sort = {};
//     switch (sortBy) {
//       case 'price_asc':
//         sort.displayPrice = 1;
//         break;
//       case 'price_desc':
//         sort.displayPrice = -1;
//         break;
//       case 'rating_desc':
//         sort.averageRating = -1;
//         break;
//       case 'newest':
//         sort.createdAt = -1;
//         break;
//       default:
//         sort.createdAt = -1;
//     }

//     // Get filtered products
//     const products = await Product.find(filteredQuery)
//       .sort(sort)
//       .skip(skip)
//       .limit(limitNum);

//     const total = await Product.countDocuments(filteredQuery);

//     // Transform products
//     const transformedProducts = products.map(product => {
//       const productObj = product.toObject();
      
//       const productColors = [];
//       const productSizes = [];
      
//       if (productObj.variants && Array.isArray(productObj.variants)) {
//         productObj.variants.forEach(variant => {
//           if (variant.color && !productColors.includes(variant.color)) {
//             productColors.push(variant.color);
//           }
          
//           if (variant.sizes && Array.isArray(variant.sizes)) {
//             variant.sizes.forEach(sizeObj => {
//               if (sizeObj.size && !productSizes.includes(sizeObj.size)) {
//                 productSizes.push(sizeObj.size);
//               }
//             });
//           }
//         });
//       }
      
//       const firstVariant = productObj.variants?.find(v => v.images && v.images.length > 0);
//       const mainImage = firstVariant?.images?.[0] || productObj.mainImages?.[0] || null;
      
//       return {
//         id: productObj._id,
//         name: productObj.name,
//         description: productObj.description,
//         displayPrice: productObj.displayPrice,
//         originalPrice: productObj.displayActualPrice,
//         discount: productObj.maxDiscount,
//         mainImage: mainImage,
//         colors: productColors,
//         sizes: productSizes,
//         rating: productObj.averageRating || 0,
//         createdAt: productObj.createdAt
//       };
//     });

//     // Get available colors/sizes based on current filters
//     let availableColors = allAvailableColors;
//     let availableSizes = allAvailableSizes;

//     if (colors || sizes || minPrice || maxPrice) {
//       const filteredProducts = await Product.find(filteredQuery)
//         .select('variants')
//         .lean();
      
//       const filteredColorsSet = new Set();
//       const filteredSizesSet = new Set();
      
//       filteredProducts.forEach(product => {
//         if (product.variants && Array.isArray(product.variants)) {
//           product.variants.forEach(variant => {
//             if (variant.color && variant.color.trim()) {
//               filteredColorsSet.add(variant.color);
//             }
//             if (variant.sizes && Array.isArray(variant.sizes)) {
//               variant.sizes.forEach(sizeObj => {
//                 if (sizeObj.size && sizeObj.size.trim()) {
//                   filteredSizesSet.add(sizeObj.size);
//                 }
//               });
//             }
//           });
//         }
//       });
      
//       availableColors = Array.from(filteredColorsSet).sort();
//       availableSizes = Array.from(filteredSizesSet).sort();
//     }

//     // Final response with full menu
//     return res.status(200).json({
//       success: true,
//       level: 'products',
//       data: {
//         categories: transformedCategories.map(cat => ({
//           ...cat,
//           isSelected: cat.id === categoryId
//         })),
//         selectedCategory: {
//           id: selectedCategory._id,
//           name: selectedCategory.name,
//           image: selectedCategory.image || null,
//           description: selectedCategory.description || null
//         },
//         subcategories: subcategories.map(sub => ({
//           ...sub,
//           isSelected: sub.id === subcategoryId
//         })),
//         selectedSubcategory: {
//           id: selectedSubcategory._id,
//           name: selectedSubcategory.name,
//           image: selectedSubcategory.image || null,
//           description: selectedSubcategory.description || null,
//           isActive: selectedSubcategory.isActive
//         },
//         filters: {
//           allColors: allAvailableColors,
//           allSizes: allAvailableSizes,
//           availableColors: availableColors,
//           availableSizes: availableSizes,
//           priceRange: priceRange,
//           activeFilters: {
//             colors: colors ? colors.split(',').map(c => c.trim()) : [],
//             sizes: sizes ? sizes.split(',').map(s => s.trim()) : [],
//             minPrice: minPrice ? parseFloat(minPrice) : null,
//             maxPrice: maxPrice ? parseFloat(maxPrice) : null
//           }
//         },
//         products: {
//           data: transformedProducts,
//           pagination: {
//             total: total,
//             filtered: total,
//             page: pageNum,
//             pages: Math.ceil(total / limitNum),
//             limit: limitNum,
//             hasNextPage: pageNum < Math.ceil(total / limitNum),
//             hasPrevPage: pageNum > 1
//           }
//         }
//       }
//     });

//   } catch (error) {
//     console.error('getFullMenu error:', error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || 'Internal server error'
//     });
//   }
// };

export const getFullMenu = async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      colors,
      sizes,
      minPrice,
      maxPrice,
      sortBy = 'newest',
      page = 1,
      limit = 20
    } = req.query;

    // Get all active categories with their subcategories
    const categories = await Category.find({ isActive: true })
      .select('name image description isActive subcategories')
      .sort({ name: 1 });

    // Transform categories and fetch filters for each subcategory
    const transformedCategories = await Promise.all(categories.map(async (cat) => ({
      id: cat._id,
      name: cat.name,
      image: cat.image || null,
      description: cat.description || null,
      isActive: cat.isActive,
      subcategories: await Promise.all(cat.subcategories
        .filter(sub => sub.isActive === true)
        .map(async (sub) => {
          // Get filters for this subcategory
          const subcategoryFilters = await getSubcategoryFilters(sub._id);
          return {
            id: sub._id,
            name: sub.name,
            image: sub.image || null,
            description: sub.description || null,
            isActive: sub.isActive,
            filters: subcategoryFilters // Add filters to each subcategory
          };
        }))
    })));

    // Level 1: If no categoryId, return all categories with subcategories and their filters
    if (!categoryId) {
      return res.status(200).json({
        success: true,
        level: 'categories',
        data: {
          categories: transformedCategories
        }
      });
    }

    // Find selected category
    const selectedCategory = categories.find(cat => cat._id.toString() === categoryId);
    if (!selectedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get active subcategories for selected category with filters
    const subcategories = await Promise.all(selectedCategory.subcategories
      .filter(sub => sub.isActive === true)
      .map(async (sub) => {
        const subcategoryFilters = await getSubcategoryFilters(sub._id);
        return {
          id: sub._id,
          name: sub.name,
          image: sub.image || null,
          description: sub.description || null,
          isActive: sub.isActive,
          filters: subcategoryFilters
        };
      }));

    // Level 2: If no subcategoryId, return categories with subcategories and mark selected
    if (!subcategoryId) {
      return res.status(200).json({
        success: true,
        level: 'subcategories',
        data: {
          categories: transformedCategories.map(cat => ({
            ...cat,
            isSelected: cat.id === categoryId
          })),
          selectedCategory: {
            id: selectedCategory._id,
            name: selectedCategory.name,
            image: selectedCategory.image || null,
            description: selectedCategory.description || null
          },
          subcategories
        }
      });
    }

    // Verify subcategory exists and is active
    const selectedSubcategory = selectedCategory.subcategories.find(
      sub => sub._id.toString() === subcategoryId && sub.isActive === true
    );
    
    if (!selectedSubcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }

    // Level 3: Return full menu with products and filters
    // Base query for products
    const baseQuery = {
      subcategoryId: subcategoryId,
      isActive: true,
      approvalStatus: { $in: ['approved', 'not_required'] }
    };

    // Get all products in this subcategory for filter extraction
    const allProductsInSubcategory = await Product.find(baseQuery)
      .select('variants displayPrice')
      .lean();

    // Extract all unique colors and sizes
    const allColorsSet = new Set();
    const allSizesSet = new Set();
    let minProductPrice = Infinity;
    let maxProductPrice = -Infinity;

    allProductsInSubcategory.forEach(product => {
      if (product.variants && Array.isArray(product.variants)) {
        product.variants.forEach(variant => {
          // Extract colors
          if (variant.color && typeof variant.color === 'string' && variant.color.trim()) {
            allColorsSet.add(variant.color);
          }
          
          // Extract sizes
          if (variant.sizes && Array.isArray(variant.sizes)) {
            variant.sizes.forEach(sizeObj => {
              if (sizeObj.size && typeof sizeObj.size === 'string' && sizeObj.size.trim()) {
                allSizesSet.add(sizeObj.size);
              }
            });
          }
        });
      }
      
      // Track price range
      if (product.displayPrice !== undefined && product.displayPrice !== null) {
        minProductPrice = Math.min(minProductPrice, product.displayPrice);
        maxProductPrice = Math.max(maxProductPrice, product.displayPrice);
      }
    });

    const allAvailableColors = Array.from(allColorsSet).sort();
    const allAvailableSizes = Array.from(allSizesSet).sort();
    const priceRange = {
      min: minProductPrice !== Infinity ? minProductPrice : 0,
      max: maxProductPrice !== -Infinity ? maxProductPrice : 0
    };

    // Build filtered query for products
    let filteredQuery = { ...baseQuery };

    // Apply color filter
    if (colors && colors.trim()) {
      const colorArray = colors.split(',').map(c => c.trim());
      filteredQuery['variants.color'] = { $in: colorArray };
    }

    // Apply size filter
    if (sizes && sizes.trim()) {
      const sizeArray = sizes.split(',').map(s => s.trim());
      filteredQuery['variants.sizes.size'] = { $in: sizeArray };
    }

    // Apply price filter
    if (minPrice || maxPrice) {
      filteredQuery.displayPrice = {};
      if (minPrice) filteredQuery.displayPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filteredQuery.displayPrice.$lte = parseFloat(maxPrice);
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    let sort = {};
    switch (sortBy) {
      case 'price_asc':
        sort.displayPrice = 1;
        break;
      case 'price_desc':
        sort.displayPrice = -1;
        break;
      case 'rating_desc':
        sort.averageRating = -1;
        break;
      case 'newest':
        sort.createdAt = -1;
        break;
      default:
        sort.createdAt = -1;
    }

    // Get filtered products
    const products = await Product.find(filteredQuery)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments(filteredQuery);

    // Transform products
    const transformedProducts = products.map(product => {
      const productObj = product.toObject();
      
      const productColors = [];
      const productSizes = [];
      
      if (productObj.variants && Array.isArray(productObj.variants)) {
        productObj.variants.forEach(variant => {
          if (variant.color && !productColors.includes(variant.color)) {
            productColors.push(variant.color);
          }
          
          if (variant.sizes && Array.isArray(variant.sizes)) {
            variant.sizes.forEach(sizeObj => {
              if (sizeObj.size && !productSizes.includes(sizeObj.size)) {
                productSizes.push(sizeObj.size);
              }
            });
          }
        });
      }
      
      const firstVariant = productObj.variants?.find(v => v.images && v.images.length > 0);
      const mainImage = firstVariant?.images?.[0] || productObj.mainImages?.[0] || null;
      
      return {
        id: productObj._id,
        name: productObj.name,
        description: productObj.description,
        displayPrice: productObj.displayPrice,
        originalPrice: productObj.displayActualPrice,
        discount: productObj.maxDiscount,
        mainImage: mainImage,
        colors: productColors,
        sizes: productSizes,
        rating: productObj.averageRating || 0,
        createdAt: productObj.createdAt
      };
    });

    // Get available colors/sizes based on current filters
    let availableColors = allAvailableColors;
    let availableSizes = allAvailableSizes;

    if (colors || sizes || minPrice || maxPrice) {
      const filteredProducts = await Product.find(filteredQuery)
        .select('variants')
        .lean();
      
      const filteredColorsSet = new Set();
      const filteredSizesSet = new Set();
      
      filteredProducts.forEach(product => {
        if (product.variants && Array.isArray(product.variants)) {
          product.variants.forEach(variant => {
            if (variant.color && variant.color.trim()) {
              filteredColorsSet.add(variant.color);
            }
            if (variant.sizes && Array.isArray(variant.sizes)) {
              variant.sizes.forEach(sizeObj => {
                if (sizeObj.size && sizeObj.size.trim()) {
                  filteredSizesSet.add(sizeObj.size);
                }
              });
            }
          });
        }
      });
      
      availableColors = Array.from(filteredColorsSet).sort();
      availableSizes = Array.from(filteredSizesSet).sort();
    }

    // Final response with full menu
    return res.status(200).json({
      success: true,
      level: 'products',
      data: {
        categories: transformedCategories.map(cat => ({
          ...cat,
          isSelected: cat.id === categoryId
        })),
        selectedCategory: {
          id: selectedCategory._id,
          name: selectedCategory.name,
          image: selectedCategory.image || null,
          description: selectedCategory.description || null
        },
        subcategories: subcategories.map(sub => ({
          ...sub,
          isSelected: sub.id === subcategoryId
        })),
        selectedSubcategory: {
          id: selectedSubcategory._id,
          name: selectedSubcategory.name,
          image: selectedSubcategory.image || null,
          description: selectedSubcategory.description || null,
          isActive: selectedSubcategory.isActive
        },
        filters: {
          allColors: allAvailableColors,
          allSizes: allAvailableSizes,
          availableColors: availableColors,
          availableSizes: availableSizes,
          priceRange: priceRange,
          activeFilters: {
            colors: colors ? colors.split(',').map(c => c.trim()) : [],
            sizes: sizes ? sizes.split(',').map(s => s.trim()) : [],
            minPrice: minPrice ? parseFloat(minPrice) : null,
            maxPrice: maxPrice ? parseFloat(maxPrice) : null
          }
        },
        products: {
          data: transformedProducts,
          pagination: {
            total: total,
            filtered: total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            limit: limitNum,
            hasNextPage: pageNum < Math.ceil(total / limitNum),
            hasPrevPage: pageNum > 1
          }
        }
      }
    });

  } catch (error) {
    console.error('getFullMenu error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Helper function to get filters for a subcategory
async function getSubcategoryFilters(subcategoryId) {
  try {
    const baseQuery = {
      subcategoryId: subcategoryId,
      isActive: true,
      approvalStatus: { $in: ['approved', 'not_required'] }
    };

    // Get products in this subcategory
    const products = await Product.find(baseQuery)
      .select('variants displayPrice')
      .lean();

    // Extract colors and sizes
    const colorsSet = new Set();
    const sizesSet = new Set();
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    products.forEach(product => {
      if (product.variants && Array.isArray(product.variants)) {
        product.variants.forEach(variant => {
          if (variant.color && variant.color.trim()) {
            colorsSet.add(variant.color);
          }
          
          if (variant.sizes && Array.isArray(variant.sizes)) {
            variant.sizes.forEach(sizeObj => {
              if (sizeObj.size && sizeObj.size.trim()) {
                sizesSet.add(sizeObj.size);
              }
            });
          }
        });
      }
      
      if (product.displayPrice !== undefined && product.displayPrice !== null) {
        minPrice = Math.min(minPrice, product.displayPrice);
        maxPrice = Math.max(maxPrice, product.displayPrice);
      }
    });

    return {
      colors: Array.from(colorsSet).sort(),
      sizes: Array.from(sizesSet).sort(),
      priceRange: {
        min: minPrice !== Infinity ? minPrice : 0,
        max: maxPrice !== -Infinity ? maxPrice : 0
      },
      productCount: products.length
    };
  } catch (error) {
    console.error(`Error getting filters for subcategory ${subcategoryId}:`, error);
    return {
      colors: [],
      sizes: [],
      priceRange: { min: 0, max: 0 },
      productCount: 0
    };
  }
}

export const searchProducts = async (req, res) => {
  try {
    const {
      q,
      categoryId,
      subcategoryId,
      colors,
      sizes,
      minPrice,
      maxPrice,
      rating,
      tags,
      sortBy = 'newest',
      page = 1,
      limit = 20
    } = req.query;

    let query = {};

    if (q && q.trim()) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ];
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (subcategoryId) {
      query.subcategoryId = subcategoryId;
    }

    if (minPrice || maxPrice) {
      query.displayPrice = {};
      if (minPrice) query.displayPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.displayPrice.$lte = parseFloat(maxPrice);
    }

    if (colors) {
      const colorArray = colors.split(',');
      query['variants.color'] = { $in: colorArray };
    }

    if (sizes) {
      const sizeArray = sizes.split(',');
      query['variants.sizes.size'] = { $in: sizeArray };
    }

    if (rating) {
      query.averageRating = { $gte: parseFloat(rating) };
    }

    if (tags) {
      const tagsArray = tags.split(',');
      query.tags = { $in: tagsArray };
    }

    query.isActive = true;
    query.approvalStatus = { $in: ['approved', 'not_required'] };

    const colorAggregation = await Product.aggregate([
      { $match: query },
      { $unwind: '$variants' },
      { $group: { _id: '$variants.color' } },
      { $sort: { _id: 1 } }
    ]);
    const availableColors = colorAggregation.map(c => c._id).filter(c => c);

    const sizeAggregation = await Product.aggregate([
      { $match: query },
      { $unwind: '$variants' },
      { $unwind: '$variants.sizes' },
      { $group: { _id: '$variants.sizes.size' } },
      { $sort: { _id: 1 } }
    ]);
    const availableSizes = sizeAggregation.map(s => s._id).filter(s => s);

    const priceAggregation = await Product.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$displayPrice' },
          maxPrice: { $max: '$displayPrice' }
        }
      }
    ]);
    const priceRange = priceAggregation.length > 0
      ? { min: priceAggregation[0].minPrice, max: priceAggregation[0].maxPrice }
      : { min: 0, max: 0 };

    let categoryInfo = null;
    let subcategoryInfo = null;
    
    if (categoryId) {
      const category = await Category.findById(categoryId);
      if (category) {
        categoryInfo = {
          id: category._id,
          name: category.name
        };
        
        if (subcategoryId) {
          const subcategory = category.subcategories.id(subcategoryId);
          if (subcategory) {
            subcategoryInfo = {
              id: subcategory._id,
              name: subcategory.name,
              image: subcategory.image
            };
          }
        }
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let sort = {};
    switch (sortBy) {
      case 'price_asc':
        sort.displayPrice = 1;
        break;
      case 'price_desc':
        sort.displayPrice = -1;
        break;
      case 'rating_desc':
        sort.averageRating = -1;
        break;
      case 'newest':
        sort.createdAt = -1;
        break;
      default:
        sort.createdAt = -1;
        break;
    }

    const products = await Product.find(query)
      .populate('categoryId', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    const transformedProducts = products.map(product => {
      const productObj = product.toObject();
      
      const productColors = [...new Set(productObj.variants?.map(v => v.color) || [])];
      
      const productSizes = [];
      productObj.variants?.forEach(variant => {
        variant.sizes?.forEach(size => {
          if (!productSizes.includes(size.size)) {
            productSizes.push(size.size);
          }
        });
      });
      
      const firstVariant = productObj.variants?.[0];
      const mainImage = firstVariant?.images?.[0] || productObj.mainImages?.[0] || null;
      
      return {
        id: productObj._id,
        name: productObj.name,
        description: productObj.description,
        price: productObj.displayPrice,
        originalPrice: productObj.displayActualPrice,
        discount: productObj.maxDiscount,
        mainImage: mainImage,
        colors: productColors,
        sizes: productSizes,
        rating: productObj.averageRating || 0,
        category: productObj.categoryId,
        createdAt: productObj.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      search: {
        query: q || '',
        totalResults: total,
        resultsCount: transformedProducts.length
      },
      filters: {
        selected: {
          categories: categoryInfo ? [categoryInfo] : [],
          subcategories: subcategoryInfo ? [subcategoryInfo] : [],
          colors: colors ? colors.split(',') : [],
          sizes: sizes ? sizes.split(',') : [],
          priceRange: {
            min: minPrice ? parseFloat(minPrice) : null,
            max: maxPrice ? parseFloat(maxPrice) : null
          },
          rating: rating ? parseFloat(rating) : null,
          tags: tags ? tags.split(',') : [],
          sortBy: sortBy
        },
        available: {
          colors: availableColors,
          sizes: availableSizes,
          priceRange: priceRange
        }
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: skip + parseInt(limit) < total,
        hasPrevPage: page > 1
      },
      products: transformedProducts
    });

  } catch (error) {
    console.error('searchProducts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ==================== UPCOMING COLLECTIONS ====================

export const getUpcomingCollections = async (req, res) => {
  try {
    const now = new Date();
    
    const upcoming = await UpcomingCollection.find({
      isActive: true,
      goLiveDateTime: { $gt: now }
    })
      .populate('collectionId')
      .sort({ goLiveDateTime: 1 });

    const data = upcoming.map(item => {
      const diff = item.goLiveDateTime - now;
      
      // Calculate countdown
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (86400000)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (3600000)) / (1000 * 60));
      const seconds = Math.floor((diff % (60000)) / 1000);
      
      // Format date for display
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      
      return {
        id: item._id,
        collection: {
          id: item.collectionId._id,
          title: item.collectionId.title,
          tag: item.collectionId.tag,
          description: item.collectionId.description,
          image: item.collectionId.image,
          isActive: item.collectionId.isActive
        },
        goLiveDateTime: item.goLiveDateTime,
        formattedDate: item.goLiveDateTime.toLocaleDateString('en-US', options),
        countdown: {
          days,
          hours,
          minutes,
          seconds,
          total: diff
        },
        isExpired: false
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data: data
    });

  } catch (error) {
    console.error('getUpcomingCollections error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Public: Get single upcoming collection details with products
export const getUpcomingCollectionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    
    const upcoming = await UpcomingCollection.findById(id)
      .populate({
        path: 'collectionId',
        populate: {
          path: 'products',
          model: 'Product',
          match: { isActive: true }
        }
      });
    
    if (!upcoming) {
      return res.status(404).json({ 
        success: false, 
        message: 'Upcoming collection not found' 
      });
    }
    
    const isExpired = upcoming.goLiveDateTime < now;
    const diff = upcoming.goLiveDateTime - now;
    
    const response = {
      id: upcoming._id,
      collection: {
        id: upcoming.collectionId._id,
        title: upcoming.collectionId.title,
        tag: upcoming.collectionId.tag,
        description: upcoming.collectionId.description,
        image: upcoming.collectionId.image
      },
      goLiveDateTime: upcoming.goLiveDateTime,
      isExpired,
      products: isExpired ? upcoming.collectionId.products || [] : [],
      productCount: isExpired ? (upcoming.collectionId.products?.length || 0) : 0,
      countdown: isExpired ? null : {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (86400000)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (3600000)) / (1000 * 60)),
        seconds: Math.floor((diff % (60000)) / 1000)
      }
    };
    
    // If not expired, don't send products
    if (!isExpired) {
      delete response.products;
    }

    return res.status(200).json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('getUpcomingCollectionDetails error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};


// ==================== Notifications Label ====================

// User: Get active notifications only
export const getActiveNotifications = async (req, res) => {
  try {
    const notificationDoc = await NotificationLabel.findOne();
    
    if (!notificationDoc || !notificationDoc.isActive || notificationDoc.notifications.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        isActive: false,
        count: 0,
        message: 'No active notifications'
      });
    }

    return res.status(200).json({
      success: true,
      data: notificationDoc.notifications,
      isActive: notificationDoc.isActive,
      count: notificationDoc.notifications.length
    });

  } catch (error) {
    console.error('getActiveNotifications error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ====================== WALLET =====================

export const getWalletData = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      type, 
      startDate, 
      endDate,
      sort = 'desc'
    } = req.query;
    
    // Get user with wallet
    const user = await User.findById(userId).select('wallet name email mobile profileImage');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const transactions = user.wallet.transactions || [];
    
    // ==================== 1. WALLET BALANCE & INFO ====================
    const balance = user.wallet.balance || 0;
    const isActive = user.wallet.isActive !== undefined ? user.wallet.isActive : true;
    
    // ==================== 2. TRANSACTION STATISTICS ====================
    const totalCredits = transactions
      .filter(t => t.type === 'credit' || t.type === 'refund' || t.type === 'cashback')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalDebits = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // ==================== 3. DAILY & MONTHLY SUMMARY ====================
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const todayTransactions = transactions.filter(t => new Date(t.createdAt) >= today);
    const todayCredits = todayTransactions.filter(t => t.type === 'credit' || t.type === 'refund' || t.type === 'cashback')
      .reduce((sum, t) => sum + t.amount, 0);
    const todayDebits = todayTransactions.filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const thisMonthTransactions = transactions.filter(t => new Date(t.createdAt) >= thisMonth);
    const thisMonthCredits = thisMonthTransactions.filter(t => t.type === 'credit' || t.type === 'refund' || t.type === 'cashback')
      .reduce((sum, t) => sum + t.amount, 0);
    const thisMonthDebits = thisMonthTransactions.filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // ==================== 4. FILTER & PAGINATE TRANSACTIONS ====================
    let filteredTransactions = [...transactions];
    
    if (type && ['credit', 'debit', 'refund', 'cashback'].includes(type)) {
      filteredTransactions = filteredTransactions.filter(t => t.type === type);
    }
    
    if (startDate || endDate) {
      filteredTransactions = filteredTransactions.filter(t => {
        const date = new Date(t.createdAt);
        if (startDate && new Date(startDate) > date) return false;
        if (endDate && new Date(endDate) < date) return false;
        return true;
      });
    }
    
    filteredTransactions.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return sort === 'desc' ? dateB - dateA : dateA - dateB;
    });
    
    const total = filteredTransactions.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedTransactions = filteredTransactions.slice(skip, skip + parseInt(limit));
    
    // ==================== 5. TRANSACTION TYPE BREAKDOWN ====================
    const typeBreakdown = {
      credit: transactions.filter(t => t.type === 'credit').length,
      debit: transactions.filter(t => t.type === 'debit').length,
      refund: transactions.filter(t => t.type === 'refund').length,
      cashback: transactions.filter(t => t.type === 'cashback').length
    };
    
    // ==================== 6. RESPONSE ====================
    return res.status(200).json({
      success: true,
      data: {
        // User Info
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          profileImage: user.profileImage
        },
        
        // Wallet Balance
        wallet: {
          balance: balance,
          isActive: isActive,
          lastUpdated: user.wallet.updatedAt || user.updatedAt
        },
        
        // Summary Statistics
        summary: {
          totalCredits: totalCredits,
          totalDebits: totalDebits,
          netBalance: totalCredits - totalDebits,
          totalTransactions: transactions.length,
          typeBreakdown: typeBreakdown
        },
        
        // Daily & Monthly Stats
        stats: {
          today: {
            credits: todayCredits,
            debits: todayDebits,
            net: todayCredits - todayDebits,
            count: todayTransactions.length
          },
          thisMonth: {
            credits: thisMonthCredits,
            debits: thisMonthDebits,
            net: thisMonthCredits - thisMonthDebits,
            count: thisMonthTransactions.length
          }
        },
        
        // Transactions (Paginated)
        transactions: {
          data: paginatedTransactions,
          pagination: {
            total: total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            limit: parseInt(limit),
            hasNextPage: skip + parseInt(limit) < total,
            hasPrevPage: parseInt(page) > 1
          }
        }
      }
    });
    
  } catch (error) {
    console.error('getWalletData error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== KEEP SEPARATE CONTROLLERS FOR SPECIFIC NEEDS ====================

// Simple balance check (lightweight)
export const checkBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('wallet.balance wallet.isActive');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        balance: user.wallet.balance || 0,
        isActive: user.wallet.isActive !== undefined ? user.wallet.isActive : true
      }
    });
    
  } catch (error) {
    console.error('checkBalance error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add money to wallet
export const addMoneyToWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, description, paymentMethod = 'manual' } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.wallet.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Wallet is currently inactive'
      });
    }
    
    const newBalance = user.wallet.balance + amount;
    
    const transaction = {
      type: 'credit',
      amount: amount,
      description: description || `Money added via ${paymentMethod}`,
      referenceType: 'recharge',
      status: 'completed',
      balance: newBalance
    };
    
    user.wallet.transactions.push(transaction);
    user.wallet.balance = newBalance;
    user.wallet.updatedAt = new Date();
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: `₹${amount} added to wallet successfully`,
      data: {
        balance: user.wallet.balance,
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          type: transaction.type,
          description: transaction.description,
          balance: transaction.balance,
          createdAt: transaction.createdAt
        }
      }
    });
    
  } catch (error) {
    console.error('addMoneyToWallet error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Pay from wallet
export const payFromWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, orderId, description } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.wallet.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Wallet is currently inactive'
      });
    }
    
    if (user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        data: {
          available: user.wallet.balance,
          required: amount,
          shortfall: amount - user.wallet.balance
        }
      });
    }
    
    const newBalance = user.wallet.balance - amount;
    
    const transaction = {
      type: 'debit',
      amount: amount,
      description: description || `Payment for order ${orderId || ''}`,
      referenceId: orderId || null,
      referenceType: 'order',
      status: 'completed',
      balance: newBalance
    };
    
    user.wallet.transactions.push(transaction);
    user.wallet.balance = newBalance;
    user.wallet.updatedAt = new Date();
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: `₹${amount} deducted from wallet`,
      data: {
        balance: user.wallet.balance,
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          type: transaction.type,
          description: transaction.description,
          referenceId: transaction.referenceId,
          balance: transaction.balance,
          createdAt: transaction.createdAt
        }
      }
    });
    
  } catch (error) {
    console.error('payFromWallet error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};