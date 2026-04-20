import jwt from 'jsonwebtoken'; // For JWT token generation
import dotenv from 'dotenv';
import User from '../Models/User.js';
import multer from 'multer'; // Import multer for file handling
import path from 'path';  // To resolve file paths
import cloudinary from '../config/cloudinary.js';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import fs from "fs";
import PriceConfig from '../Models/PriceConfig.js';
import StylistBooking from '../Models/StylistBooking.js';



dotenv.config();

    const BASE_URL = "http://localhost:4077";


cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});



export const sendOtp = async (req, res) => {
  console.log("👉 sendOtp API HIT");
  console.log("📦 Body:", req.body);

  const { mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({ message: "Mobile number required" });
  }

  const mobilePattern = /^[0-9]{10}$/;
  if (!mobilePattern.test(mobile)) {
    return res.status(400).json({ message: "Invalid mobile number" });
  }

  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    console.log("✅ Generated OTP:", otp);

    let user = await User.findOne({ mobile });

    if (!user) {
      console.log("🆕 New user, creating...");
      user = new User({ mobile });
    } else {
      console.log("👤 Existing user found");
    }

    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();

    return res.status(200).json({
      message: "OTP sent successfully",
      otp: otp   // ✅ yaha add kiya
    });

  } catch (error) {
    console.error("❌ SEND OTP ERROR 👉", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// =======================
// 🔐 VERIFY OTP (LOGIN + REGISTER FLOW)
// =======================
export const verifyOtp = async (req, res) => {
  console.log("👉 verifyOtp API HIT");
  console.log("📦 Body:", req.body);

  const { mobile, otp } = req.body;

  if (!mobile || !otp) {
    return res.status(400).json({
      message: "Mobile and OTP required"
    });
  }

  try {
    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({
        message: "User not found. Please request OTP first"
      });
    }

    console.log("🔎 DB OTP:", user.otp);
    console.log("🧾 Entered OTP:", otp);

    // ❌ OTP mismatch
    if (user.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    // ❌ OTP expired
    if (user.otpExpires && user.otpExpires < Date.now()) {
      return res.status(400).json({
        message: "OTP expired"
      });
    }

    // ✅ clear OTP after success
    user.otp = null;
    user.otpExpires = null;

    await user.save();

    // =========================
    // 🟢 CASE 1: USER ALREADY REGISTERED → LOGIN
    // =========================
    if (user.name && user.role) {
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        message: "Login successful",
        isNewUser: false,
        token,
        user
      });
    }

    // =========================
    // 🟡 CASE 2: NEW USER → REGISTER REQUIRED
    // =========================
    return res.status(200).json({
      message: "OTP verified. Complete registration",
      isNewUser: true,
      userId: user._id
    });

  } catch (error) {
    console.error("❌ VERIFY OTP ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// =======================
// 👤 REGISTER USER
// =======================
export const registerUser = async (req, res) => {
  console.log("👉 registerUser API HIT");
  console.log("📦 Body:", req.body);

  try {
    const { name, mobile, email, role } = req.body;

    if (!name || !mobile || !role) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ message: "User not found. Verify OTP first" });
    }

    // update user details
    user.name = name;
    user.email = email;
    user.role = role;

    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    return res.status(201).json({
      message: "Registration successful",
      token,
      user
    });

  } catch (error) {
    console.error("❌ REGISTER ERROR 👉", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const loginUser = async (req, res) => {
  console.log("👉 loginUser API HIT");
  console.log("📦 Body:", req.body);

  const { mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({ message: "Mobile number required" });
  }

  const mobilePattern = /^[0-9]{10}$/;
  if (!mobilePattern.test(mobile)) {
    return res.status(400).json({ message: "Invalid mobile number" });
  }

  try {
    let user = await User.findOne({ mobile });

    // 🔥 agar user nahi hai to create basic user
    if (!user) {
      user = new User({ mobile });
    }

    // 🔐 OTP generate
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    console.log("🔐 LOGIN OTP:", otp);

    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();

    return res.status(200).json({
      message: "OTP sent for login",
      otp: otp // ❌ remove in production
    });

  } catch (error) {
    console.error("❌ LOGIN ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// Get current directory for handling paths correctly in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up storage for profile images using Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads', 'profiles')); // Folder where profile images will be saved
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Use timestamp to avoid conflicts
  },
});

// Filter to ensure only image files can be uploaded
const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg|png/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    return cb(new Error('Invalid file type. Only JPG, JPEG, and PNG files are allowed.'));
  }
};

// Initialize multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: fileFilter,
});

export const createProfile = async (req, res) => {
  try {
    console.log("👉 createProfile API HIT");
    console.log("📌 Params:", req.params);

    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!req.files || !req.files.profileImage) {
      return res.status(400).json({ message: "Profile image required" });
    }

    const profileImage = req.files.profileImage;

    const fileName = Date.now() + "-" + profileImage.name;
    const uploadPath = `uploads/profile/${fileName}`;

    await profileImage.mv(uploadPath);

    user.profileImage = `${BASE_URL}/uploads/profile/${fileName}`;

    await user.save();

    return res.status(200).json({
      message: "Profile image uploaded successfully",
      user: {
        id: user._id,
        profileImage: user.profileImage,
      },
    });

  } catch (error) {
    console.error("❌ CREATE PROFILE ERROR 👉", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const editProfileImage = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔁 Update image if new file provided
    if (req.files && req.files.profileImage) {
      const profileImage = req.files.profileImage;

      const fileName = Date.now() + "-" + profileImage.name;
      const uploadPath = `uploads/profile/${fileName}`;

      await profileImage.mv(uploadPath);

      user.profileImage = `${BASE_URL}/uploads/profile/${fileName}`;
    }

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        profileImage: user.profileImage,
      },
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};


// Get Profile (with userId in params)
export const getProfile = async (req, res) => {
  try {
    const userId = req.params.id;  // Get the user ID from request params

    // Find user by ID and populate the subscribedPlans
    const user = await User.findById(userId).populate('subscribedPlans.planId');  // Assuming `subscribedPlans` references `Plan` model

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Respond with user details along with subscribed plans and include dob and marriageAnniversaryDate
    return res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      profileImage: user.profileImage,
      dob: user.dob || null,  // Return dob or null if not present
      marriageAnniversaryDate: user.marriageAnniversaryDate || null,  // Return marriageAnniversaryDate or null if not present
      subscribedPlans: user.subscribedPlans,  // Include subscribedPlans in the response
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};



// Step 1: Verify mobile number exists
export const verifyMobile = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ message: 'User with this mobile number does not exist' });
    }

    // Return userId so it can be passed to step 2
    return res.status(200).json({
      message: 'Mobile number verified. You can now reset your password.',
      userId: user._id
    });

  } catch (error) {
    console.error('Error in verifyMobile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




// Step 2: Reset password using userId
export const resetPassword = async (req, res) => {
  try {
    const { userId, password, confirmPassword } = req.body;

    if (!userId || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = password;
    user.confirmPassword = confirmPassword;

    await user.save();

    return res.status(200).json({
      message: 'Password updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        aadhaarCardNumber: user.aadhaarCardNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Error in resetPassword:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};





export const deleteUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete all forms submitted by this user
    await Form.deleteMany({ student: userId });

    // Delete user
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "pms226803@gmail.com",
    pass: "nrasbifqxsxzurrm",
  },
});


export const deleteAccount = async (req, res) => {
  const { email, reason } = req.body;

  if (!email || !reason) {
    return res.status(400).json({
      message: "Email and deletion reason are required",
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate token
    const token = crypto.randomBytes(20).toString("hex");
    const deleteLink = `${process.env.BASE_URL}/confirm-delete-account/${token}`;

    // Save token & expiry
    user.deleteToken = token;
    user.deleteTokenExpiration = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    console.log("User deleteToken:", user.deleteToken);
    console.log("User deleteTokenExpiration:", user.deleteTokenExpiration);

    // Send email
    const mailOptions = {
      from: "pms226803@gmail.com",
      to: email,
      subject: "Confirm Account Deletion",
      text: `Hi ${user.name || "User"},

We received your account deletion request.

To confirm deletion, click the link below:
${deleteLink}

Reason:
${reason}

If you did not request this, please ignore this email.

Regards,
Your Team`,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "Account deletion link sent successfully. Please check your email.",
    });

  } catch (error) {
    console.error("Delete user request error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const confirmDeleteAccount = async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      deleteToken: token,
      deleteTokenExpiration: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(404).json({ message: "Invalid or expired token" });
    }

    // Optional: delete user's forms also
    // await Form.deleteMany({ student: user._id });

    await User.findByIdAndDelete(user._id);

    return res.status(200).json({
      message: "Your account has been deleted successfully",
    });

  } catch (error) {
    console.error("Confirm delete user error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, aadhaarCardNumber } = req.body;

    // At least one field required
    if (!name && !email && !aadhaarCardNumber) {
      return res.status(400).json({
        message: "At least one field is required to update"
      });
    }

    // Check user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Duplicate check (email & aadhaar)
    if (email || aadhaarCardNumber) {
      const existingUser = await User.findOne({
        _id: { $ne: userId },
        $or: [
          email ? { email } : null,
          aadhaarCardNumber ? { aadhaarCardNumber } : null
        ].filter(Boolean)
      });

      if (existingUser) {
        return res.status(400).json({
          message: "Email or Aadhaar already in use"
        });
      }
    }

    // Update allowed fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (aadhaarCardNumber) user.aadhaarCardNumber = aadhaarCardNumber;

    await user.save();

    return res.status(200).json({
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        aadhaarCardNumber: user.aadhaarCardNumber,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("Error in updateUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



export const getUserById = async (req, res) => {
  console.log("👉 getUserById API HIT");
  console.log("📌 Params:", req.params);

  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User fetched successfully",
      user
    });

  } catch (error) {
    console.error("❌ GET USER ERROR 👉", error);

    // invalid ObjectId case
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// =======================
// 🔁 RESEND OTP
// =======================
export const resendOtp = async (req, res) => {
  console.log("👉 resendOtp API HIT");
  console.log("📦 Body:", req.body);

  const { mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({ message: "Mobile number required" });
  }

  const mobilePattern = /^[0-9]{10}$/;
  if (!mobilePattern.test(mobile)) {
    return res.status(400).json({ message: "Invalid mobile number" });
  }

  try {
    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({
        message: "User not found. Please request OTP first"
      });
    }

    // 🔥 Generate new 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    console.log("🔁 New OTP generated:", otp);

    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();

    return res.status(200).json({
      message: "OTP resent successfully",
      otp: otp   // ⚠️ remove in production
    });

  } catch (error) {
    console.error("❌ RESEND OTP ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



// =======================
// 🎨 CREATE DESIGNER PROFILE
// =======================
export const createDesignerProfile = async (req, res) => {
  try {
    console.log("👉 createDesignerProfile API HIT");

    const { userId } = req.params;
    const { startingPrice } = req.body;

    // 🔥 ensure folder exists
    const uploadDir = "uploads/designer";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "designer") {
      return res.status(400).json({
        message: "Only designer can create designer profile",
      });
    }

    if (!req.files || !req.files.designerProfileImg) {
      return res.status(400).json({
        message: "Designer profile image required",
      });
    }

    const image = req.files.designerProfileImg;

    const fileName = Date.now() + "-" + image.name;
    const uploadPath = `${uploadDir}/${fileName}`;

    await image.mv(uploadPath);

    user.designerProfileImg = `${BASE_URL}/uploads/designer/${fileName}`;
    user.startingPrice = startingPrice;

    await user.save();

    return res.status(200).json({
      message: "Designer profile created successfully",
      user: {
        id: user._id,
        role: user.role,
        designerProfileImg: user.designerProfileImg,
        startingPrice: user.startingPrice,
      },
    });

  } catch (error) {
    console.error("❌ DESIGNER PROFILE ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// =======================
// 🧑‍🎨 GET ALL DESIGNERS
// =======================
export const getAllDesigners = async (req, res) => {
  try {
    console.log("👉 getAllDesigners API HIT");

    const designers = await User.find({ role: "designer" })
      .select("-password -confirmPassword -otp -otpExpires")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Designers fetched successfully",
      total: designers.length,
      designers,
    });

  } catch (error) {
    console.error("❌ GET DESIGNERS ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};




// =======================
// ❤️ TOGGLE WISHLIST + 🔔 CLEAN NOTIFICATION
// =======================
export const toggleWishlist = async (req, res) => {
  try {
    const { userId, designerId } = req.params;

    const user = await User.findById(userId);
    const designer = await User.findById(designerId);

    if (!user || !designer) {
      return res.status(404).json({
        message: "User or Designer not found",
      });
    }

    if (!user.wishlist) user.wishlist = [];
    if (!user.notifications) user.notifications = [];

    const index = user.wishlist.indexOf(designerId);

    let message = "";

    // =========================
    // ❌ REMOVE FROM WISHLIST
    // =========================
    if (index > -1) {
      user.wishlist.splice(index, 1);
      message = "Removed from wishlist";

      // 🔥 REMOVE RELATED NOTIFICATION
      user.notifications = user.notifications.filter(
        (n) => !n.message.includes(designer.name)
      );
    }

    // =========================
    // ❤️ ADD TO WISHLIST
    // =========================
    else {
      user.wishlist.push(designerId);
      message = "Added to wishlist";

      user.notifications.push({
        message: `You added ${designer.name} to wishlist`,
      });
    }

    await user.save();

    return res.status(200).json({
      message,
      wishlist: user.wishlist,
      notifications: user.notifications,
    });

  } catch (error) {
    console.error("❌ WISHLIST ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// =======================
// ❤️ GET USER WISHLIST (WITH DESIGNER DETAILS)
// =======================
export const getWishlist = async (req, res) => {
  try {
    console.log("👉 getWishlist API HIT");

    const { userId } = req.params;

    const user = await User.findById(userId).populate({
      path: "wishlist",
      select: "name startingPrice designerProfileImg role",
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Wishlist fetched successfully",
      total: user.wishlist.length,
      wishlist: user.wishlist,
    });

  } catch (error) {
    console.error("❌ GET WISHLIST ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// =======================
// 🔔 GET ALL NOTIFICATIONS
// =======================
export const getAllNotifications = async (req, res) => {
  try {
    console.log("👉 getAllNotifications API HIT");

    const { userId } = req.params;

    const user = await User.findById(userId).select("notifications");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // if no notifications
    const notifications = user.notifications || [];

    // latest first
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      message: "Notifications fetched successfully",
      total: notifications.length,
      notifications,
    });

  } catch (error) {
    console.error("❌ GET NOTIFICATIONS ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// =======================
// ❌ DELETE NOTIFICATIONS (SMART)
// =======================
export const deleteNotifications = async (req, res) => {
  try {
    console.log("👉 deleteNotifications API HIT");

    const { userId } = req.params;
    const { notificationIds } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.notifications) {
      user.notifications = [];
    }

    // =========================
    // ⚠️ VALIDATION
    // =========================
    if (
      !notificationIds ||
      !Array.isArray(notificationIds) ||
      notificationIds.length === 0
    ) {
      return res.status(400).json({
        message: "notificationIds array is required",
      });
    }

    // =========================
    // 🗑️ DELETE SINGLE OR MULTIPLE (SAME LOGIC)
    // =========================
    user.notifications = user.notifications.filter(
      (n) => !notificationIds.includes(n._id.toString())
    );

    await user.save();

    return res.status(200).json({
      message: "Notifications deleted successfully",
      deletedCount: notificationIds.length,
      notifications: user.notifications,
    });

  } catch (error) {
    console.error("❌ DELETE NOTIFICATIONS ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// =======================
// 💇‍♀️ CREATE STYLIST BOOKING
// =======================
export const bookStylist = async (req, res) => {
  try {
    console.log("👉 bookStylist API HIT");

    const {
      userId,
      name,
      mobile,
      location,
      reasonForBooking,
      date,
      fromTime,
      toTime,
    } = req.body;

    const config = await PriceConfig.findOne();

    if (!config) {
      return res.status(404).json({
        message: "Price config not found",
      });
    }

    const booking = new StylistBooking({
      userId,
      assignedStylist: null, // ✅ default null
      name,
      mobile,
      location,
      reasonForBooking,
      date,
      fromTime,
      toTime,
      amount: config.stylistBookingPrice,
      status: "pending",
      paymentStatus: "pending",
    });

    await booking.save();

    return res.status(201).json({
      message: "Stylist booking created successfully",
      booking,
    });

  } catch (error) {
    console.error("❌ BOOK STYLIST ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// =======================
// 📋 GET MY STYLIST BOOKINGS
// =======================
export const getMyStylistBookings = async (req, res) => {
  try {
    console.log("👉 getMyStylistBookings API HIT");

    const { userId } = req.params;

    const bookings = await StylistBooking.find({ userId })
      .populate({
        path: "userId",
        select: "name mobile, profileImage",
      })
      .populate({
        path: "assignedStylist",
        select: "name designerProfileImg",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Bookings fetched successfully",
      total: bookings.length,
      bookings,
    });

  } catch (error) {
    console.error("❌ GET BOOKINGS ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};