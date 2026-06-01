import User from '../Models/User.js';
import Order from '../Models/Order.js';
import LoginScreenMedia from '../Models/LoginScreenMedia.js';
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
      .map(h => ({
        type: h.type,
        url: h.url,
        filename: h.filename
      }));

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
      .map(h => ({
        type: h.type,
        url: h.url,
        filename: h.filename
      }));

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