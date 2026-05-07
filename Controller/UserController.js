import User from '../Models/User.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const FIXED_OTP = '1234'; // Fixed OTP for all verification
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const OTP_EXPIRY_MINUTES = 10;

// Generate a random auth token
const generateAuthToken = () => crypto.randomBytes(32).toString('hex');

// Generate JWT
const generateJWT = (userId, role) => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '7d' });
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