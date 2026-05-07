import Admin from '../Models/Admin.js';
import User from '../Models/User.js';
import Banner from '../Models/Banner.js';
import Category from '../Models/Category.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to delete file
const deleteFile = (filePath) => {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

// ==================== ADMIN AUTH ====================
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      admin: {
        id: admin._id,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error('adminLogin error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== USER MANAGEMENT ====================
export const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    let query = {};
    
    if (role && ['Tailor', 'Designer', 'User', 'Stylist'].includes(role)) {
      query.role = role;
    }

    const users = await User.find(query).select('-otp -otpExpires -authToken -authTokenExpires');
    
    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('getAllUsers error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-otp -otpExpires -authToken -authTokenExpires');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('getUserById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, role, isVerified } = req.body;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    if (name) user.name = name;
    if (email) user.email = email;
    if (mobile) user.mobile = mobile;
    if (role && ['Tailor', 'Designer', 'User', 'Stylist'].includes(role)) user.role = role;
    if (typeof isVerified === 'boolean') user.isVerified = isVerified;
    
    await user.save();
    
    const updatedUser = await User.findById(id).select('-otp -otpExpires -authToken -authTokenExpires');
    
    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('updateUserById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('deleteUserById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== BANNER MANAGEMENT ====================
export const createBanners = async (req, res) => {
  try {
    const files = req.files;
    const { titles, descriptions } = req.body;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one banner image is required' });
    }
    
    const banners = [];
    
    for (let i = 0; i < files.length; i++) {
      const banner = new Banner({
        image: files[i].path,
        title: titles && titles[i] ? titles[i] : '',
        description: descriptions && descriptions[i] ? descriptions[i] : '',
      });
      await banner.save();
      banners.push(banner);
    }
    
    return res.status(201).json({
      success: true,
      message: `${banners.length} banner(s) created successfully`,
      banners,
    });
  } catch (error) {
    console.error('createBanners error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    console.error('getAllBanners error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    return res.status(200).json({
      success: true,
      banner,
    });
  } catch (error) {
    console.error('getBannerById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, isActive } = req.body;
    const file = req.file;
    
    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    if (title !== undefined) banner.title = title;
    if (description !== undefined) banner.description = description;
    if (isActive !== undefined) banner.isActive = isActive;
    
    if (file) {
      deleteFile(banner.image);
      banner.image = file.path;
    }
    
    await banner.save();
    
    return res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      banner,
    });
  } catch (error) {
    console.error('updateBannerById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    deleteFile(banner.image);
    
    return res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    console.error('deleteBannerById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== CATEGORY MANAGEMENT ====================
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Category image is required' });
    }
    
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      deleteFile(file.path);
      return res.status(409).json({ success: false, message: 'Category with this name already exists' });
    }
    
    const category = new Category({
      name,
      image: file.path,
    });
    
    await category.save();
    
    return res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category,
    });
  } catch (error) {
    console.error('createCategory error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error('getAllCategories error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error('getCategoryById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const file = req.file;
    
    const category = await Category.findById(id);
    if (!category) {
      if (file) deleteFile(file.path);
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
      if (existingCategory) {
        if (file) deleteFile(file.path);
        return res.status(409).json({ success: false, message: 'Category with this name already exists' });
      }
      category.name = name;
    }
    
    if (file) {
      deleteFile(category.image);
      category.image = file.path;
    }
    
    await category.save();
    
    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category,
    });
  } catch (error) {
    console.error('updateCategoryById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    deleteFile(category.image);
    
    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('deleteCategoryById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};