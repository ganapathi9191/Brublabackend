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

// ✅ Helper to normalize path (fix Windows backslashes)
const normalizePath = (filePath) => filePath.replace(/\\/g, '/');

// ✅ Helper to build full image URL
const getImageUrl = (req, filePath) => {
  const normalized = normalizePath(filePath);
  return `${req.protocol}://${req.get('host')}/${normalized}`;
};

const getFileUrl = (req, filename, subfolder) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${subfolder}/${filename}`;
};

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


// Permanent admin credentials
const PERMANENT_ADMIN = {
  email: 'admin@example.com',
  password: 'admin123',
  id: 'admin_permanent_001'
};

// ==================== ADMIN AUTH ====================
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Check for permanent admin credentials FIRST
    if (email === PERMANENT_ADMIN.email && password === PERMANENT_ADMIN.password) {
      console.log('✅ Permanent admin login successful');
      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        admin: {
          id: PERMANENT_ADMIN.id,
          email: PERMANENT_ADMIN.email,
          role: 'super_admin',
          isPermanent: true
        },
      });
    }

    // If not permanent admin, check database for other admins
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
        role: admin.role || 'admin',
        isPermanent: false
      },
    });
  } catch (error) {
    console.error('adminLogin error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updatePermanentAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (email) PERMANENT_ADMIN.email = email;
    if (password) PERMANENT_ADMIN.password = password;
    
    return res.status(200).json({
      success: true,
      message: 'Permanent admin credentials updated',
      admin: {
        email: PERMANENT_ADMIN.email,
        isPermanent: true
      }
    });
  } catch (error) {
    console.error('updatePermanentAdmin error:', error);
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

    return res.status(200).json({ success: true, user });
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

    return res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('deleteUserById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ==================== BANNER MANAGEMENT ====================
export const createBanners = async (req, res) => {
  try {
    console.log('=== CREATE BANNERS DEBUG ===');
    console.log('Files received:', req.files);
    console.log('Body received:', req.body);
    console.log('Number of files:', req.files?.length);
    
    const files = req.files;
    const { isActive } = req.body;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one banner image is required',
        receivedFiles: files,
        receivedBody: req.body
      });
    }
    
    const banners = [];
    
    for (let i = 0; i < files.length; i++) {
      console.log(`Processing file ${i}:`, files[i].path);
      
      // Extract filename from the path
      const filename = path.basename(files[i].path);
      const imageUrl = getFileUrl(req, filename, 'banners');
      
      const banner = new Banner({
        image: imageUrl, // Store the full URL instead of file path
        isActive: isActive !== undefined ? isActive : true,
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
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};

export const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    
    // Transform banners to ensure URLs are complete
    const bannersWithUrls = banners.map(banner => {
      const bannerObj = banner.toObject();
      // If image is already a URL, leave it; if it's a path, convert it
      if (bannerObj.image && !bannerObj.image.startsWith('http')) {
        const filename = path.basename(bannerObj.image);
        bannerObj.image = getFileUrl(req, filename, 'banners');
      }
      return bannerObj;
    });
    
    return res.status(200).json({
      success: true,
      count: bannersWithUrls.length,
      banners: bannersWithUrls,
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
    
    // Convert image path to URL
    const bannerObj = banner.toObject();
    if (bannerObj.image && !bannerObj.image.startsWith('http')) {
      const filename = path.basename(bannerObj.image);
      bannerObj.image = getFileUrl(req, filename, 'banners');
    }
    
    return res.status(200).json({
      success: true,
      banner: bannerObj,
    });
  } catch (error) {
    console.error('getBannerById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const file = req.file;
    
    const banner = await Banner.findById(id);
    if (!banner) {
      if (file) deleteFile(file.path);
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    // Only update isActive if provided
    if (isActive !== undefined) {
      banner.isActive = isActive;
    }
    
    // Only update image if a new file is uploaded
    if (file) {
      // Delete old image file if it's a local path
      if (banner.image && !banner.image.startsWith('http')) {
        deleteFile(banner.image);
      }
      
      // Store the full URL
      const filename = path.basename(file.path);
      banner.image = getFileUrl(req, filename, 'banners');
    }
    
    await banner.save();
    
    // Return the updated banner with URL
    const bannerObj = banner.toObject();
    if (bannerObj.image && !bannerObj.image.startsWith('http')) {
      const filename = path.basename(bannerObj.image);
      bannerObj.image = getFileUrl(req, filename, 'banners');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      banner: bannerObj,
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
    
    // Delete the image file if it's a local path (not a URL)
    if (banner.image && !banner.image.startsWith('http')) {
      deleteFile(banner.image);
    }
    
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
      if (file) deleteFile(file.path);
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
    
    const filename = path.basename(file.path);
    const imageUrl = getFileUrl(req, filename, 'categories');
    
    const category = new Category({
      name,
      image: imageUrl,
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

// Update getAllCategories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    
    const categoriesWithUrls = categories.map(category => {
      const categoryObj = category.toObject();
      if (categoryObj.image && !categoryObj.image.startsWith('http')) {
        const filename = path.basename(categoryObj.image);
        categoryObj.image = getFileUrl(req, filename, 'categories');
      }
      return categoryObj;
    });
    
    return res.status(200).json({
      success: true,
      count: categoriesWithUrls.length,
      categories: categoriesWithUrls,
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
    
    // Convert image path to URL
    const categoryObj = category.toObject();
    if (categoryObj.image && !categoryObj.image.startsWith('http')) {
      const filename = path.basename(categoryObj.image);
      categoryObj.image = getFileUrl(req, filename, 'categories');
    }
    
    return res.status(200).json({
      success: true,
      category: categoryObj,
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
    
    // Update name if provided and not duplicate
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
      if (existingCategory) {
        if (file) deleteFile(file.path);
        return res.status(409).json({ success: false, message: 'Category with this name already exists' });
      }
      category.name = name;
    }
    
    // Update image if a new file is uploaded
    if (file) {
      // Delete old image file if it's a local path
      if (category.image && !category.image.startsWith('http')) {
        deleteFile(category.image);
      }
      
      // Store the full URL
      const filename = path.basename(file.path);
      category.image = getFileUrl(req, filename, 'categories');
    }
    
    await category.save();
    
    // Return the updated category with URL
    const categoryObj = category.toObject();
    if (categoryObj.image && !categoryObj.image.startsWith('http')) {
      const filename = path.basename(categoryObj.image);
      categoryObj.image = getFileUrl(req, filename, 'categories');
    }
    
    return res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category: categoryObj,
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
    
    // Delete the image file if it's a local path (not a URL)
    if (category.image && !category.image.startsWith('http')) {
      deleteFile(category.image);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('deleteCategoryById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};