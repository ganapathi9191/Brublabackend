import User from '../Models/User.js';
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
    
    const user = await User.findById(userId).select('-otp -otpExpires -authToken -authTokenExpires -deleteToken -deleteTokenExpiration');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Convert user to object and add full image URL
    const userObj = user.toObject();
    if (userObj.profileImage) {
      const normalizedPath = userObj.profileImage.replace(/\\/g, '/');
      userObj.profileImageUrl = `${req.protocol}://${req.get('host')}/${normalizedPath}`;
    } else {
      userObj.profileImageUrl = null;
    }
    
    return res.status(200).json({
      success: true,
      user: userObj
    });
  } catch (error) {
    console.error('getUserById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
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



// ==================== WISHLIST CONTROLLERS ====================

// Add to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already in wishlist
    if (user.wishlist.includes(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist'
      });
    }

    user.wishlist.push(productId);
    await user.save();

    // Populate wishlist items
    await user.populate('wishlist', 'name displayPrice variants');

    return res.status(200).json({
      success: true,
      message: 'Added to wishlist',
      wishlist: user.wishlist
    });

  } catch (error) {
    console.error('addToWishlist error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Remove from wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();

    await user.populate('wishlist', 'name displayPrice variants');

    return res.status(200).json({
      success: true,
      message: 'Removed from wishlist',
      wishlist: user.wishlist
    });

  } catch (error) {
    console.error('removeFromWishlist error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get wishlist
export const getWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('wishlist', 'name description displayPrice displayActualPrice maxDiscount variants averageRating');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Transform wishlist items
    const wishlistItems = user.wishlist.map(product => {
      const productObj = product.toObject();
      const mainImage = productObj.variants?.[0]?.mainImage || 
                        productObj.variants?.[0]?.images?.[0] || 
                        null;
      
      return {
        _id: productObj._id,
        name: productObj.name,
        description: productObj.description,
        displayPrice: productObj.displayPrice,
        displayActualPrice: productObj.displayActualPrice,
        maxDiscount: productObj.maxDiscount,
        mainImage: mainImage,
        averageRating: productObj.averageRating,
        variantsCount: productObj.variants?.length || 0
      };
    });

    return res.status(200).json({
      success: true,
      count: wishlistItems.length,
      wishlist: wishlistItems
    });

  } catch (error) {
    console.error('getWishlist error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Check if product is in wishlist
export const checkWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isInWishlist = user.wishlist.includes(productId);

    return res.status(200).json({
      success: true,
      isInWishlist
    });

  } catch (error) {
    console.error('checkWishlist error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};



// ==================== CART CONTROLLERS ====================

// Add to cart
export const addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId, variantId, quantity = 1 } = req.body;

    if (!productId || !variantId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and Variant ID are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get product and variant details
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    // Check stock
    if (variant.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${variant.stock} items available in stock`
      });
    }

    // Check if already in cart
    const existingItem = user.cart.find(
      item => item.productId.toString() === productId && item.variantId.toString() === variantId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      if (existingItem.quantity > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than ${variant.stock} items`
        });
      }
    } else {
      user.cart.push({
        productId,
        variantId,
        variant: {
          color: variant.color,
          size: variant.size,
          actualPrice: variant.actualPrice,
          discountPrice: variant.discountPrice,
          mainImage: variant.mainImage || variant.images?.[0]
        },
        quantity,
        price: variant.discountPrice || variant.actualPrice
      });
    }

    await user.save();

    // Populate cart items
    await user.populate('cart.productId', 'name description');

    return res.status(200).json({
      success: true,
      message: 'Added to cart',
      cart: user.cart
    });

  } catch (error) {
    console.error('addToCart error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update cart item quantity
export const updateCartQuantity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { cartItemId, quantity } = req.body;

    if (!cartItemId || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Cart item ID and valid quantity are required'
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
    const variant = product.variants.id(cartItem.variantId);
    
    if (variant.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${variant.stock} items available`
      });
    }

    cartItem.quantity = quantity;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: user.cart
    });

  } catch (error) {
    console.error('updateCartQuantity error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Remove from cart
export const removeFromCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { cartItemId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.cart = user.cart.filter(item => item._id.toString() !== cartItemId);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Removed from cart',
      cart: user.cart
    });

  } catch (error) {
    console.error('removeFromCart error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get cart
export const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('cart.productId', 'name description');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let subtotal = 0;
    let totalDiscount = 0;

    const cartItems = user.cart.map(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      
      if (item.variant.actualPrice && item.variant.discountPrice) {
        totalDiscount += (item.variant.actualPrice - item.variant.discountPrice) * item.quantity;
      }

      return {
        _id: item._id,
        productId: item.productId,
        variantId: item.variantId,
        variant: item.variant,
        quantity: item.quantity,
        price: item.price,
        totalPrice: itemTotal
      };
    });

    return res.status(200).json({
      success: true,
      cart: {
        items: cartItems,
        summary: {
          subtotal,
          totalDiscount,
          finalAmount: subtotal
        },
        totalItems: user.cart.length
      }
    });

  } catch (error) {
    console.error('getCart error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Clear cart
export const clearCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.cart = [];
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cart cleared',
      cart: []
    });

  } catch (error) {
    console.error('clearCart error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ==================== ORDER CONTROLLERS ====================

// Generate unique order ID
const generateOrderId = () => {
  return 'ORD' + Date.now() + crypto.randomBytes(4).toString('hex').toUpperCase();
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

    if (user.cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Get delivery address
    const deliveryAddress = user.addresses.id(addressId);
    if (!deliveryAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    let totalAmount = 0;
    let discountAmount = 0;
    const orderItems = [];

    // Process each cart item
    for (const cartItem of user.cart) {
      const product = await Product.findById(cartItem.productId);
      if (!product) {
        throw new Error(`Product not found: ${cartItem.productId}`);
      }

      const variant = product.variants.id(cartItem.variantId);
      if (!variant) {
        throw new Error(`Variant not found: ${cartItem.variantId}`);
      }

      // Check stock
      if (variant.stock < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `${product.name} - ${variant.color} ${variant.size} has only ${variant.stock} items in stock`
        });
      }

      // Reduce stock
      variant.stock -= cartItem.quantity;

      const itemPrice = cartItem.price;
      const itemTotal = itemPrice * cartItem.quantity;
      totalAmount += itemTotal;
      
      if (variant.actualPrice && variant.discountPrice) {
        discountAmount += (variant.actualPrice - variant.discountPrice) * cartItem.quantity;
      }

      orderItems.push({
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        variant: cartItem.variant,
        quantity: cartItem.quantity,
        price: cartItem.price,
        status: 'pending'
      });
    }

    await product.save();

    const finalAmount = totalAmount;

    const order = {
      orderId: generateOrderId(),
      items: orderItems,
      totalAmount,
      discountAmount,
      finalAmount,
      deliveryAddress: deliveryAddress.toObject(),
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      orderStatus: 'pending',
      createdAt: new Date()
    };

    user.orders.push(order);
    user.cart = []; // Clear cart
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        orderId: order.orderId,
        finalAmount: order.finalAmount,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        items: order.items.length
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

    let orders = [...user.orders];
    
    // Filter by status if provided
    if (status) {
      orders = orders.filter(order => order.orderStatus === status);
    }

    // Sort by latest first
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedOrders = orders.slice(skip, skip + parseInt(limit));

    // Populate product details for each order
    const ordersWithDetails = await Promise.all(paginatedOrders.map(async (order) => {
      const itemsWithDetails = await Promise.all(order.items.map(async (item) => {
        const product = await Product.findById(item.productId).select('name description');
        return {
          ...item.toObject(),
          productName: product?.name,
          productDescription: product?.description
        };
      }));
      
      return {
        ...order.toObject(),
        items: itemsWithDetails
      };
    }));

    return res.status(200).json({
      success: true,
      count: ordersWithDetails.length,
      total: orders.length,
      page: parseInt(page),
      pages: Math.ceil(orders.length / parseInt(limit)),
      orders: ordersWithDetails
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

    const order = user.orders.find(o => o.orderId === orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Populate product details
    const itemsWithDetails = await Promise.all(order.items.map(async (item) => {
      const product = await Product.findById(item.productId).select('name description');
      return {
        ...item.toObject(),
        productName: product?.name,
        productDescription: product?.description
      };
    }));

    const orderWithDetails = {
      ...order.toObject(),
      items: itemsWithDetails
    };

    return res.status(200).json({
      success: true,
      order: orderWithDetails
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

    const order = user.orders.find(o => o.orderId === orderId);
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
          variant.stock += item.quantity;
          await product.save();
        }
      }
    }

    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by user';
    order.updatedAt = new Date();

    await user.save();

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