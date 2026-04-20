import Admin from "../Models/Admin.js";
import Banner from "../Models/Banner.js";
import User from "../Models/User.js";
import mongoose from 'mongoose';
import fs from "fs";
import Category from "../Models/Category.js";
import PriceConfig from "../Models/PriceConfig.js";




const BASE_URL = 'http://localhost:4077'
/**
 * ADMIN REGISTER
 */
export const registerAdmin = async (req, res) => {
  const { name, email, mobile, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const admin = new Admin({
      name,
      email,
      mobile,
      password, // ❌ no bcrypt
    });

    await admin.save();

    return res.status(201).json({
      message: "Admin registered successfully",
      admin,
    });

  } catch (err) {
    console.error("Register Admin Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ADMIN LOGIN
 */
export const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // ❌ plain password comparison
    if (admin.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    return res.status(200).json({
      message: "Admin login successful",
      admin,
    });

  } catch (err) {
    console.error("Login Admin Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      mobile,
      aadhaarCardNumber,
      password,
      confirmPassword,
    } = req.body;

    if (password && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        name,
        email,
        mobile,
        aadhaarCardNumber,
        password,
        confirmPassword,
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error in updateUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



// GET Admin Profile by ID
export const getAdminProfile = async (req, res) => {
  const { adminId } = req.params;

  if (!adminId) {
    return res.status(400).json({ message: "Admin ID is required" });
  }

  try {
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    return res.status(200).json({
      message: "Admin profile fetched successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        mobile: admin.mobile,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      },
    });
  } catch (err) {
    console.error("Get Admin Profile Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


export const createBanner = async (req, res) => {
  try {
    console.log("👉 createBanner API HIT");

    // 🔥 ensure folder exists
    const uploadDir = "uploads/banner";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    if (!req.files || !req.files.images) {
      return res.status(400).json({ message: "Images required" });
    }

    let images = req.files.images;

    if (!Array.isArray(images)) {
      images = [images];
    }

    let imagePaths = [];

    for (let img of images) {
      const fileName = Date.now() + "-" + img.name;
      const uploadPath = `${uploadDir}/${fileName}`;

      await img.mv(uploadPath);

      imagePaths.push(`${BASE_URL}/uploads/banner/${fileName}`);
    }

    const banner = new Banner({ images: imagePaths });

    await banner.save();

    return res.status(201).json({
      message: "Banner uploaded successfully",
      banner
    });

  } catch (error) {
    console.error("❌ CREATE BANNER ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


export const getAllBanners = async (req, res) => {
  console.log("👉 getAllBanners API HIT");

  try {
    const banners = await Banner.find().sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Banners fetched successfully",
      total: banners.length,
      banners
    });

  } catch (error) {
    console.error("❌ GET BANNERS ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


export const deleteBanner = async (req, res) => {
  console.log("👉 deleteBanner API HIT");

  const { bannerId } = req.params;

  try {
    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        message: "Banner not found"
      });
    }

    await Banner.findByIdAndDelete(bannerId);

    return res.status(200).json({
      message: "Banner deleted successfully"
    });

  } catch (error) {
    console.error("❌ DELETE BANNER ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};



export const updateBanner = async (req, res) => {
  try {
    console.log("👉 updateBanner API HIT");
    console.log("📌 Params:", req.params);

    const { bannerId } = req.params;

    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        message: "Banner not found"
      });
    }

    // =========================
    // 🟡 CHECK NEW IMAGES
    // =========================
    if (!req.files || !req.files.images) {
      return res.status(400).json({
        message: "New images required"
      });
    }

    let images = req.files.images;

    if (!Array.isArray(images)) {
      images = [images];
    }

    let newImagePaths = [];

    // =========================
    // 🧹 OPTIONAL: DELETE OLD IMAGES FROM FOLDER
    // =========================
    if (banner.images && banner.images.length > 0) {
      banner.images.forEach((imgUrl) => {
        const path = imgUrl.replace(`${BASE_URL}/`, "");

        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
        }
      });
    }

    // =========================
    // 📤 UPLOAD NEW IMAGES
    // =========================
    for (let img of images) {
      const fileName = Date.now() + "-" + img.name;
      const uploadPath = `uploads/banner/${fileName}`;

      await img.mv(uploadPath);

      newImagePaths.push(`${BASE_URL}/uploads/banner/${fileName}`);
    }

    // =========================
    // 💾 UPDATE DB
    // =========================
    banner.images = newImagePaths;

    await banner.save();

    return res.status(200).json({
      message: "Banner updated successfully",
      banner
    });

  } catch (error) {
    console.error("❌ UPDATE BANNER ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


export const createCategory = async (req, res) => {
  try {
    console.log("👉 createCategory API HIT");

    const { name, gender } = req.body;

    if (!name || !gender) {
      return res.status(400).json({
        message: "Name and gender required",
      });
    }

    if (!req.files || !req.files.image) {
      return res.status(400).json({
        message: "Category image required",
      });
    }

    const image = req.files.image;

    const fileName = Date.now() + "-" + image.name;
    const uploadPath = `uploads/category/${fileName}`;

    await image.mv(uploadPath);

    const category = new Category({
      name,
      gender, // ✅ added
      image: `${BASE_URL}/uploads/category/${fileName}`,
    });

    await category.save();

    return res.status(201).json({
      message: "Category created successfully",
      category,
    });

  } catch (error) {
    console.error("❌ CREATE CATEGORY ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



export const getAllCategories = async (req, res) => {
  try {
    console.log("👉 getAllCategories API HIT");
    console.log("📌 Query:", req.query);

    const { gender } = req.query;

    // =========================
    // 🟡 BUILD FILTER DYNAMICALLY
    // =========================
    let filter = {};

    if (gender) {
      filter.gender = gender; // male / female / unisex
    }

    const categories = await Category.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      message: "Categories fetched successfully",
      total: categories.length,
      filter: gender || "all",
      categories,
    });

  } catch (error) {
    console.error("❌ GET CATEGORY ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



export const updateCategory = async (req, res) => {
  try {
    console.log("👉 updateCategory API HIT");

    const { categoryId } = req.params;
    const { name, gender } = req.body;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    // =========================
    // 📝 UPDATE TEXT FIELDS
    // =========================
    if (name) {
      category.name = name;
    }

    if (gender) {
      category.gender = gender; // ✅ added
    }

    // =========================
    // 🖼️ UPDATE IMAGE (optional)
    // =========================
    if (req.files && req.files.image) {
      const image = req.files.image;

      const fileName = Date.now() + "-" + image.name;
      const uploadPath = `uploads/category/${fileName}`;

      await image.mv(uploadPath);

      // 🧹 delete old image (optional but good)
      const oldPath = category.image?.replace(`${BASE_URL}/`, "");

      if (oldPath && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }

      category.image = `${BASE_URL}/uploads/category/${fileName}`;
    }

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      category,
    });

  } catch (error) {
    console.error("❌ UPDATE CATEGORY ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


export const deleteCategory = async (req, res) => {
  try {
    console.log("👉 deleteCategory API HIT");

    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // delete image from folder (optional)
    const imagePath = category.image.replace(`${BASE_URL}/`, "");

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await Category.findByIdAndDelete(categoryId);

    return res.status(200).json({
      message: "Category deleted successfully",
    });

  } catch (error) {
    console.error("❌ DELETE CATEGORY ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// =======================
// 💰 CREATE / UPDATE PRICE CONFIG
// =======================
export const setPriceConfig = async (req, res) => {
  try {
    console.log("👉 setPriceConfig API HIT");

    const { tailorBookingPrice, stylistBookingPrice } = req.body;

    let config = await PriceConfig.findOne();

    // 🟡 if not exists → create
    if (!config) {
      config = new PriceConfig({
        tailorBookingPrice,
        stylistBookingPrice,
      });
    } else {
      // 🟢 update existing
      if (tailorBookingPrice !== undefined) {
        config.tailorBookingPrice = tailorBookingPrice;
      }

      if (stylistBookingPrice !== undefined) {
        config.stylistBookingPrice = stylistBookingPrice;
      }
    }

    await config.save();

    return res.status(200).json({
      message: "Price config saved successfully",
      config,
    });

  } catch (error) {
    console.error("❌ PRICE CONFIG ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



export const getPriceConfig = async (req, res) => {
  try {
    console.log("👉 getPriceConfig API HIT");

    const config = await PriceConfig.findOne();

    if (!config) {
      return res.status(404).json({
        message: "Price config not set yet",
      });
    }

    return res.status(200).json({
      message: "Price config fetched successfully",
      config,
    });

  } catch (error) {
    console.error("❌ GET PRICE CONFIG ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// =======================
// 💰 UPDATE PRICE CONFIG
// =======================
export const updatePriceConfig = async (req, res) => {
  try {
    console.log("👉 updatePriceConfig API HIT");

    const { tailorBookingPrice, stylistBookingPrice } = req.body;

    const config = await PriceConfig.findOne();

    if (!config) {
      return res.status(404).json({
        message: "Price config not found. Create first.",
      });
    }

    if (tailorBookingPrice !== undefined) {
      config.tailorBookingPrice = tailorBookingPrice;
    }

    if (stylistBookingPrice !== undefined) {
      config.stylistBookingPrice = stylistBookingPrice;
    }

    await config.save();

    return res.status(200).json({
      message: "Price config updated successfully",
      config,
    });

  } catch (error) {
    console.error("❌ UPDATE PRICE CONFIG ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// =======================
// ❌ DELETE PRICE CONFIG
// =======================
export const deletePriceConfig = async (req, res) => {
  try {
    console.log("👉 deletePriceConfig API HIT");

    const config = await PriceConfig.findOne();

    if (!config) {
      return res.status(404).json({
        message: "Price config not found",
      });
    }

    await PriceConfig.deleteOne({ _id: config._id });

    return res.status(200).json({
      message: "Price config deleted successfully",
    });

  } catch (error) {
    console.error("❌ DELETE PRICE CONFIG ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


// =======================
// 🧑‍💼 ASSIGN STYLIST + 🔔 DETAILED NOTIFICATION
// =======================
export const assignStylist = async (req, res) => {
  try {
    console.log("👉 assignStylist API HIT");

    const { bookingId } = req.params;
    const { stylistId } = req.body;

    if (!stylistId) {
      return res.status(400).json({
        message: "stylistId is required",
      });
    }

    // 📌 get booking
    const booking = await StylistBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    // 📌 get stylist details
    const stylist = await User.findById(stylistId);

    if (!stylist) {
      return res.status(404).json({
        message: "Stylist not found",
      });
    }

    // =========================
    // 🧑‍🎨 ASSIGN STYLIST
    // =========================
    booking.assignedStylist = stylistId;
    booking.status = "booked";

    await booking.save();

    // =========================
    // 🔔 PUSH NOTIFICATION TO USER
    // =========================
    const user = await User.findById(booking.userId);

    if (user) {
      if (!user.notifications) {
        user.notifications = [];
      }

      user.notifications.push({
        message: `Your booking has been assigned to stylist ${stylist.name}`,
      });

      await user.save();
    }

    return res.status(200).json({
      message: "Stylist assigned successfully",
      booking,
    });

  } catch (error) {
    console.error("❌ ASSIGN STYLIST ERROR 👉", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};