import Admin from '../Models/Admin.js';
import LoginScreenMedia from '../Models/LoginScreenMedia.js';
import HomePage from '../Models/HomePage.js';
import User from '../Models/User.js';
import { Designer, DesignerSettings } from '../Models/Designer.js';
import Collection from '../Models/Collection.js';
import NotificationLabel from '../Models/NotificationLabel.js';
import Product from '../Models/Product.js';
import UpcomingCollection from '../Models/UpcomingCollection.js';
import RecommendedProduct from '../Models/RecommendedProducts.js';
import LatestDesign from '../Models/LatestDesign.js';
import StylistBooking from '../Models/StylistBooking.js';
import Order from '../Models/Order.js';
import Banner from '../Models/Banner.js';
import Category from '../Models/Category.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFileUrl, deleteFile } from '../utils/fileUtils.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Helper to normalize path (fix Windows backslashes)
const normalizePath = (filePath) => filePath.replace(/\\/g, '/');

// ✅ Helper to build full image URL
const getImageUrl = (req, filePath) => {
  const normalized = normalizePath(filePath);
  return `${req.protocol}://${req.get('host')}/${normalized}`;
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

    let adminData = null;
    let isPermanent = false;

    // Check for permanent admin credentials
    if (email === PERMANENT_ADMIN.email && password === PERMANENT_ADMIN.password) {
      console.log('✅ Permanent admin login - checking database...');
      
      // ✅ Find or create admin in database
      let admin = await Admin.findOne({ email: PERMANENT_ADMIN.email });
      
      if (!admin) {
        // Create the permanent admin in database
        const hashedPassword = await bcrypt.hash(PERMANENT_ADMIN.password, 10);
        admin = await Admin.create({
          email: PERMANENT_ADMIN.email,
          password: hashedPassword,
          role: 'super_admin',
          name: 'Super Admin',
          isActive: true
        });
        console.log('✅ Created permanent admin in database with ID:', admin._id);
      }
      
      adminData = {
        id: admin._id,  // ✅ Real MongoDB ObjectId
        email: admin.email,
        role: admin.role,
        name: admin.name
      };
      isPermanent = true;
    } else {
      // Check database for other admins
      const admin = await Admin.findOne({ email });
      if (!admin) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      adminData = {
        id: admin._id,
        email: admin.email,
        role: admin.role || 'admin',
        name: admin.name || 'Admin'
      };
    }

    const secret = process.env.JWT_SECRET_KEY ;

    if (!secret) {
      console.error('❌ JWT_SECRET is not defined in environment variables!');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    console.log('Login using secret:', secret);

    const token = jwt.sign(
      { 
        id: adminData.id.toString(),
        email: adminData.email,
        role: adminData.role || 'admin',
        name: adminData.name || 'Admin'
      },
      secret,  // Use the same secret variable
      { expiresIn: '7d' }
    );
    console.log('Generated token:', token);
    
    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: adminData.id,  // ✅ Returns real ObjectId
        email: adminData.email,
        role: adminData.role,
        name: adminData.name,
        isPermanent: isPermanent
      }
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
// controllers/AdminController.js (add these functions)

// ==================== SUBCATEGORY MANAGEMENT ====================

// Create subcategory under a category
export const createSubcategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name } = req.body;
    const file = req.file;

    // Validate inputs
    if (!name) {
      if (file) deleteFile(file.path);
      return res.status(400).json({ success: false, message: 'Subcategory name is required' });
    }

    if (!file) {
      return res.status(400).json({ success: false, message: 'Subcategory image is required' });
    }

    // Find the category
    const category = await Category.findById(categoryId);
    if (!category) {
      if (file) deleteFile(file.path);
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Check if subcategory with same name exists in this category
    const existingSubcategory = category.subcategories.find(
      sub => sub.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingSubcategory) {
      deleteFile(file.path);
      return res.status(409).json({ 
        success: false, 
        message: 'Subcategory with this name already exists in this category' 
      });
    }

    // Save the image
    const filename = path.basename(file.path);
    const imageUrl = getFileUrl(req, filename, 'subcategories');

    // Create new subcategory
    const newSubcategory = {
      name,
      image: imageUrl,
      isActive: true,
    };

    category.subcategories.push(newSubcategory);
    await category.save();

    // Get the newly created subcategory
    const savedSubcategory = category.subcategories[category.subcategories.length - 1];

    return res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      subcategory: savedSubcategory,
      category: {
        id: category._id,
        name: category.name
      }
    });
  } catch (error) {
    console.error('createSubcategory error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get all subcategories for a specific category
export const getSubcategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Ensure all subcategory images have full URLs
    const subcategoriesWithUrls = category.subcategories.map(sub => {
      const subObj = sub.toObject();
      if (subObj.image && !subObj.image.startsWith('http')) {
        const filename = path.basename(subObj.image);
        subObj.image = getFileUrl(req, filename, 'subcategories');
      }
      return subObj;
    });

    return res.status(200).json({
      success: true,
      count: subcategoriesWithUrls.length,
      category: {
        id: category._id,
        name: category.name
      },
      subcategories: subcategoriesWithUrls,
    });
  } catch (error) {
    console.error('getSubcategoriesByCategory error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get a specific subcategory by ID
export const getSubcategoryById = async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    // Convert image path to URL
    const subObj = subcategory.toObject();
    if (subObj.image && !subObj.image.startsWith('http')) {
      const filename = path.basename(subObj.image);
      subObj.image = getFileUrl(req, filename, 'subcategories');
    }

    return res.status(200).json({
      success: true,
      subcategory: subObj,
      category: {
        id: category._id,
        name: category.name
      }
    });
  } catch (error) {
    console.error('getSubcategoryById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update subcategory
export const updateSubcategoryById = async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;
    const { name, isActive } = req.body;
    const file = req.file;

    const category = await Category.findById(categoryId);
    if (!category) {
      if (file) deleteFile(file.path);
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
      if (file) deleteFile(file.path);
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    // Update name if provided and check for duplicates
    if (name && name !== subcategory.name) {
      const existingSubcategory = category.subcategories.find(
        sub => sub.name.toLowerCase() === name.toLowerCase() && 
        sub._id.toString() !== subcategoryId
      );
      
      if (existingSubcategory) {
        if (file) deleteFile(file.path);
        return res.status(409).json({ 
          success: false, 
          message: 'Subcategory with this name already exists in this category' 
        });
      }
      subcategory.name = name;
    }

    // Update isActive if provided
    if (typeof isActive === 'boolean') {
      subcategory.isActive = isActive;
    }

    // Update image if a new file is uploaded
    if (file) {
      // Delete old image file if it's a local path
      if (subcategory.image && !subcategory.image.startsWith('http')) {
        deleteFile(subcategory.image);
      }
      
      // Store the full URL
      const filename = path.basename(file.path);
      subcategory.image = getFileUrl(req, filename, 'subcategories');
    }

    await category.save();

    // Return the updated subcategory with URL
    const subObj = subcategory.toObject();
    if (subObj.image && !subObj.image.startsWith('http')) {
      const filename = path.basename(subObj.image);
      subObj.image = getFileUrl(req, filename, 'subcategories');
    }

    return res.status(200).json({
      success: true,
      message: 'Subcategory updated successfully',
      subcategory: subObj,
      category: {
        id: category._id,
        name: category.name
      }
    });
  } catch (error) {
    console.error('updateSubcategoryById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Delete subcategory
export const deleteSubcategoryById = async (req, res) => {
  try {
    const { categoryId, subcategoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    // Delete the image file if it's a local path (not a URL)
    if (subcategory.image && !subcategory.image.startsWith('http')) {
      deleteFile(subcategory.image);
    }

    // Remove subcategory from array
    category.subcategories.pull(subcategoryId);
    await category.save();

    return res.status(200).json({
      success: true,
      message: 'Subcategory deleted successfully',
    });
  } catch (error) {
    console.error('deleteSubcategoryById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update getAllCategories to include populated subcategories with URLs
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    
    const categoriesWithUrls = categories.map(category => {
      const categoryObj = category.toObject();
      
      // Process subcategories to ensure image URLs
      if (categoryObj.subcategories && categoryObj.subcategories.length > 0) {
        categoryObj.subcategories = categoryObj.subcategories.map(sub => {
          if (sub.image && !sub.image.startsWith('http')) {
            const filename = path.basename(sub.image);
            sub.image = getFileUrl(req, filename, 'subcategories');
          }
          return sub;
        });
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

// Get single category with populated subcategories
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    // Convert image paths to URLs for subcategories
    const categoryObj = category.toObject();
    
    if (categoryObj.subcategories && categoryObj.subcategories.length > 0) {
      categoryObj.subcategories = categoryObj.subcategories.map(sub => {
        if (sub.image && !sub.image.startsWith('http')) {
          const filename = path.basename(sub.image);
          sub.image = getFileUrl(req, filename, 'subcategories');
        }
        return sub;
      });
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

// Update category (remove image requirement since categories don't have images)
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(409).json({ success: false, message: 'Category with this name already exists' });
    }
    
    const category = new Category({
      name,
      subcategories: [],
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

// Update category (remove image handling)
export const updateCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    // Update name if provided and not duplicate
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name, _id: { $ne: id } });
      if (existingCategory) {
        return res.status(409).json({ success: false, message: 'Category with this name already exists' });
      }
      category.name = name;
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

// Delete category (also deletes all subcategories and their images)
export const deleteCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    // Delete all subcategory images
    for (const subcategory of category.subcategories) {
      if (subcategory.image && !subcategory.image.startsWith('http')) {
        deleteFile(subcategory.image);
      }
    }
    
    await Category.findByIdAndDelete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Category and all its subcategories deleted successfully',
    });
  } catch (error) {
    console.error('deleteCategoryById error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


// Helper to extract file URLs from multer upload
const getUploadedFileUrls = (files, req, folder) => {
  if (!files || files.length === 0) return [];
  return files.map(file => {
    const filename = path.basename(file.path);
    return getFileUrl(req, filename, folder);
  });
};

// Helper to delete multiple files
const deleteProductFiles = (filePaths) => {
  if (!filePaths || filePaths.length === 0) return;
  filePaths.forEach(filePath => {
    if (filePath && !filePath.startsWith('http')) {
      deleteFile(filePath);
    }
  });
};


// Controller/adminController.js - Updated createProduct for new structure
export const createProduct = async (req, res) => {
  try {
    let userId = req.user?.id;
    let userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }

    const {
      name,
      description,
      categoryId,
      subcategoryId,
      variants,
      deliveryAddresses,
      tags
    } = req.body;

    if (!['admin', 'designer', 'tailor', 'Stylist'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only Admin, Designer, Tailor, or Stylist can create products'
      });
    }

    if (!name || !description || !categoryId || !subcategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, categoryId, subcategoryId'
      });
    }

    // Parse variants
    let variantsArray = [];
    try {
      variantsArray = typeof variants === 'string' ? JSON.parse(variants) : variants;
    } catch (e) {
      variantsArray = [];
    }

    if (!variantsArray.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one color variant is required'
      });
    }

    // Validate category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    // ✅ PROCESS FILES
    // Group images by variant field name
    const variantImageMap = {};
    const videoFiles = [];
    
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        if (file.mimetype.startsWith('image/')) {
          // Extract variant index from fieldname (e.g., "variant_0_images" -> 0)
          const match = file.fieldname.match(/variant_(\d+)_images/);
          if (match) {
            const variantIndex = parseInt(match[1]);
            if (!variantImageMap[variantIndex]) {
              variantImageMap[variantIndex] = [];
            }
            variantImageMap[variantIndex].push(file);
          }
        } else if (file.mimetype.startsWith('video/')) {
          videoFiles.push(file);
        }
      });
    }

    console.log('📸 Variant images:', Object.keys(variantImageMap).map(k => `${k}: ${variantImageMap[k].length} images`).join(', '));

    // Process variants
    const processedVariants = variantsArray.map((variant, index) => {
      let variantImages = [];
      
      if (variantImageMap[index] && variantImageMap[index].length > 0) {
        variantImages = variantImageMap[index].map(file => 
          getFileUrl(req, path.basename(file.path), 'products')
        );
      }

      let sizesArray = variant.sizes || [];
      if (typeof sizesArray === 'string') {
        try {
          sizesArray = JSON.parse(sizesArray);
        } catch (e) {
          sizesArray = [];
        }
      }

      return {
        color: variant.color,
        price: parseFloat(variant.price),
        discountPrice: variant.discountPrice ? parseFloat(variant.discountPrice) : null,
        sizes: sizesArray,
        images: variantImages,
        isActive: true
      };
    });

    const videoUrls = videoFiles.map(file => 
      getFileUrl(req, path.basename(file.path), 'products')
    );

    let addressesArray = [];
    if (deliveryAddresses) {
      try {
        addressesArray = typeof deliveryAddresses === 'string' ? JSON.parse(deliveryAddresses) : deliveryAddresses;
      } catch (e) {}
    }

    let tagsArray = [];
    if (tags) {
      try {
        tagsArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {}
    }

    let creatorDetails = null;
    if (userRole !== 'admin') {
      const user = await User.findById(userId);
      if (user) {
        creatorDetails = {
          name: user.name,
          profileImage: user.profileImage || '',
          role: userRole,
          brandName: userRole === 'designer' ? user.name : undefined,
          shopName: userRole === 'tailor' ? user.name : undefined
        };
      }
    }

    const product = new Product({
      name,
      description,
      categoryId,
      subcategoryId,
      subcategoryName: subcategory.name,
      variants: processedVariants,
      deliveryAddresses: addressesArray,
      sizeGuide: videoUrls,
      tags: tagsArray,
      createdBy: userRole,
      creatorId: userId,
      creatorDetails
    });

    await product.save();

    return res.status(201).json({
      success: true,
      message: userRole === 'admin' ? 'Product created successfully' : 'Product submitted for admin approval',
      product,
      requiresApproval: userRole !== 'admin'
    });

  } catch (error) {
    console.error('createProduct error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
// Get All Products
// export const getAllProducts = async (req, res) => {
//   try {
//     const {
//       categoryId,
//       subcategoryId,
//       isActive,
//       minPrice,
//       maxPrice,
//       sortBy,
//       page = 1,
//       limit = 20
//     } = req.query;

//     let query = {};

//     // Apply filters
//     if (categoryId) query.categoryId = categoryId;
//     if (subcategoryId) query.subcategoryId = subcategoryId;
//     if (isActive !== undefined) query.isActive = isActive === 'true';
    
//     // Price filter
//     if (minPrice || maxPrice) {
//       query.displayPrice = {};
//       if (minPrice) query.displayPrice.$gte = parseFloat(minPrice);
//       if (maxPrice) query.displayPrice.$lte = parseFloat(maxPrice);
//     }

//     // Pagination
//     const skip = (parseInt(page) - 1) * parseInt(limit);
    
//     // Sorting
//     let sort = {};
//     if (sortBy === 'price_asc') sort.displayPrice = 1;
//     else if (sortBy === 'price_desc') sort.displayPrice = -1;
//     else if (sortBy === 'rating_desc') sort.averageRating = -1;
//     else if (sortBy === 'newest') sort.createdAt = -1;
//     else sort.createdAt = -1;

//     // Approval filter for public users
//     if (!req.user || req.user.role !== 'admin') {
//       query.approvalStatus = { $in: ['approved', 'not_required'] };
//       query.isActive = true;
//     }

//     const products = await Product.find(query)
//       .populate('categoryId', 'name')
//       .sort(sort)
//       .skip(skip)
//       .limit(parseInt(limit));

//     const total = await Product.countDocuments(query);

//     return res.status(200).json({
//       success: true,
//       count: products.length,
//       total,
//       page: parseInt(page),
//       pages: Math.ceil(total / parseInt(limit)),
//       products
//     });

//   } catch (error) {
//     console.error('getAllProducts error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error'
//     });
//   }
// };
// Get All Products with Filters (Size, Color, Price, Category, Subcategory, etc.)
export const getAllProducts = async (req, res) => {
  try {
    const {
      categoryId,
      subcategoryId,
      isActive,
      minPrice,
      maxPrice,
      sortBy,
      page = 1,
      limit = 20,
      colors,
      sizes,
      search,
      rating,
      tags
    } = req.query;

    let query = {};

    // ✅ Apply category filter (works as query param)
    if (categoryId) {
      query.categoryId = categoryId;
    }

    // ✅ Apply subcategory filter (works as query param)
    if (subcategoryId) {
      query.subcategoryId = subcategoryId;
    }

    // Apply basic filters
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Price filter
    if (minPrice || maxPrice) {
      query.displayPrice = {};
      if (minPrice) query.displayPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.displayPrice.$lte = parseFloat(maxPrice);
    }

    // Color filter (search in variants array)
    if (colors) {
      const colorArray = colors.split(',');
      query['variants.color'] = { $in: colorArray };
    }

    // Size filter (search in variants.sizes array)
    if (sizes) {
      const sizeArray = sizes.split(',');
      query['variants.sizes.size'] = { $in: sizeArray };
    }

    // Rating filter
    if (rating) {
      query.averageRating = { $gte: parseFloat(rating) };
    }

    // Tags filter
    if (tags) {
      const tagsArray = tags.split(',');
      query.tags = { $in: tagsArray };
    }

    // Search filter (text search on name and description)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Approval filter for public users
    if (!req.user || req.user.role !== 'admin') {
      query.approvalStatus = { $in: ['approved', 'not_required'] };
      query.isActive = true;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    let sort = {};
    if (sortBy === 'price_asc') sort.displayPrice = 1;
    else if (sortBy === 'price_desc') sort.displayPrice = -1;
    else if (sortBy === 'rating_desc') sort.averageRating = -1;
    else if (sortBy === 'popularity') sort.totalSold = -1;
    else if (sortBy === 'newest') sort.createdAt = -1;
    else sort.createdAt = -1;

    const products = await Product.find(query)
      .populate('categoryId', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    // Get unique colors and sizes from filtered products for filter UI
    let allColors = [];
    let allSizes = [];
    let priceRange = { min: 0, max: 0 };

    if (products.length > 0) {
      // Get price range from filtered products
      const priceStats = await Product.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            minPrice: { $min: '$displayPrice' },
            maxPrice: { $max: '$displayPrice' }
          }
        }
      ]);
      if (priceStats.length > 0) {
        priceRange = { min: priceStats[0].minPrice, max: priceStats[0].maxPrice };
      }

      // Get unique colors from filtered products
      const colorResults = await Product.aggregate([
        { $match: query },
        { $unwind: '$variants' },
        { $group: { _id: '$variants.color' } }
      ]);
      allColors = colorResults.map(c => c._id).filter(c => c);

      // Get unique sizes from filtered products
      const sizeResults = await Product.aggregate([
        { $match: query },
        { $unwind: '$variants' },
        { $unwind: '$variants.sizes' },
        { $group: { _id: '$variants.sizes.size' } }
      ]);
      allSizes = sizeResults.map(s => s._id).filter(s => s);
    }

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      filters: {
        colors: allColors,
        sizes: allSizes,
        priceRange
      },
      products
    });

  } catch (error) {
    console.error('getAllProducts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get Product By ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
     
     if (!req.user || req.user.role !== 'admin') {
     if (!product.isActive || 
        (!product.createdBy === 'admin' && product.approvalStatus !== 'approved')) {
      return res.status(404).json({
        success: false,
        message: 'Product not available'
      });
    }
    return res.status(200).json({
      success: true,
      product
    });
  }
  } catch (error) {
    console.error('getProductById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getProductsByCreatorId = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { page = 1, limit = 20, role } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { creatorId: creatorId };
    
    // Optional role filter
    if (role && ['admin', 'designer', 'tailor'].includes(role)) {
      query.createdBy = role;
    }

    // For public users, only show approved products
    if (!req.user || req.user.role !== 'admin') {
      query.isActive = true;
      query.approvalStatus = { $in: ['approved', 'not_required'] };
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products
    });

  } catch (error) {
    console.error('getProductsByCreatorId error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update Product By ID - Updated for New Structure
export const updateProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      categoryId,
      subcategoryId,
      variants,
      deliveryAddresses,
      tags,
      isActive
    } = req.body;

    const userId = req.user.id;
    const userRole = req.user.role;
    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check permissions
    if (product.creatorId.toString() !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this product'
      });
    }

    // Update basic fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (isActive !== undefined) {
      product.isActive = typeof isActive === 'boolean' ? isActive : isActive === 'true';
    }

    // Update category if changed
    if (categoryId && categoryId !== product.categoryId.toString()) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      if (subcategoryId) {
        const subcategory = category.subcategories.id(subcategoryId);
        if (!subcategory) {
          return res.status(404).json({
            success: false,
            message: 'Subcategory not found'
          });
        }
        product.subcategoryName = subcategory.name;
        product.subcategoryId = subcategoryId;
      }
      
      product.categoryId = categoryId;
    }

    // ✅ UPDATE VARIANTS - FIXED FOR NEW STRUCTURE
    if (variants) {
      try {
        let variantsArray = typeof variants === 'string' ? JSON.parse(variants) : variants;
        
        // Track current image index for sequential distribution
        let currentImageIndex = 0;
        
        // Process each variant for new structure
        const processedVariants = variantsArray.map((variant, index) => {
          let variantImages = [];
          
          // Handle image distribution
          if (imageFiles.length > 0) {
            const imageCount = variant.imageCount || 1;
            if (imageCount > 0 && imageFiles.length > currentImageIndex) {
              variantImages = imageFiles
                .slice(currentImageIndex, currentImageIndex + imageCount)
                .map(file => getFileUrl(req, path.basename(file.path), 'products'));
              currentImageIndex += imageCount;
            }
          } else if (variant.images && Array.isArray(variant.images)) {
            // Keep existing images if no new ones
            variantImages = variant.images;
          }
          
          // Process sizes array
          let sizesArray = variant.sizes || [];
          if (typeof sizesArray === 'string') {
            try {
              sizesArray = JSON.parse(sizesArray);
            } catch (e) {
              sizesArray = [];
            }
          }
          
          return {
            color: variant.color,
            price: parseFloat(variant.price),
            discountPrice: variant.discountPrice ? parseFloat(variant.discountPrice) : null,
            sizes: sizesArray,
            images: variantImages,
            isActive: variant.isActive !== false
          };
        });
        
        product.variants = processedVariants;
        
      } catch (e) {
        console.error('Variants parse error:', e);
        return res.status(400).json({
          success: false,
          message: 'Invalid variants format',
          error: e.message
        });
      }
    }

    // Update videos
    if (videoFiles.length > 0) {
      const newVideoUrls = videoFiles.map(file => 
        getFileUrl(req, path.basename(file.path), 'products')
      );
      product.sizeGuide = newVideoUrls;
    }

    // Update delivery addresses
    if (deliveryAddresses) {
      try {
        product.deliveryAddresses = typeof deliveryAddresses === 'string' 
          ? JSON.parse(deliveryAddresses) 
          : deliveryAddresses;
      } catch (e) {}
    }

    // Update tags
    if (tags) {
      try {
        product.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {}
    }

    // Reset approval for non-admin updates
    if (userRole !== 'admin' && product.approvalStatus === 'approved') {
      product.approvalStatus = 'pending';
      product.isActive = false;
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: userRole !== 'admin' && product.approvalStatus === 'pending'
        ? 'Product updated and submitted for re-approval'
        : 'Product updated successfully',
      product
    });

  } catch (error) {
    console.error('updateProductById error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete Product By ID
export const deleteProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check permissions
    if (product.creatorId.toString() !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this product'
      });
    }

    // Delete variant images
    if (product.variants && product.variants.length) {
      product.variants.forEach(variant => {
        if (variant.images && variant.images.length) {
          variant.images.forEach(image => {
            if (!image.startsWith('http')) {
              deleteFile(image);
            }
          });
        }
      });
    }

    // Delete size guide videos
    if (product.sizeGuide && product.sizeGuide.length) {
      product.sizeGuide.forEach(video => {
        if (!video.startsWith('http')) {
          deleteFile(video);
        }
      });
    }

    // Soft delete for non-admin, hard delete for admin
    if (userRole === 'admin') {
      await Product.findByIdAndDelete(id);
    } else {
      product.isActive = false;
      await product.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('deleteProductById error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};


// Add Review To Product (No images array in review)
export const addProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, description } = req.body;
    const userId = req.user.id;  // ✅ From authenticated token
    const userName = req.user.name;

    if (!rating || !description) {
      return res.status(400).json({
        success: false,
        message: 'Rating and description are required'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      review => review.user.toString() === userId
    );

    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    const review = {
      user: userId,
      userName: userName,
      userImage: req.user.profileImage || '',
      rating: parseInt(rating),
      description,
      createdAt: new Date()
    };

    product.reviews.push(review);
    await product.save(); // Pre-save middleware updates averageRating

    return res.status(201).json({
      success: true,
      message: 'Review added successfully',
      review
    });

  } catch (error) {
    console.error('addProductReview error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

export const getProductsBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // First, find which category contains this subcategory
    let category = null;
    let subcategory = null;
    let categoryId = null;

    // Search for category that contains this subcategory
    const allCategories = await Category.find();
    
    for (const cat of allCategories) {
      const foundSubcategory = cat.subcategories.id(subcategoryId);
      if (foundSubcategory) {
        category = {
          _id: cat._id,
          name: cat.name,
          isActive: cat.isActive
        };
        subcategory = {
          _id: foundSubcategory._id,
          name: foundSubcategory.name,
          image: foundSubcategory.image,
          isActive: foundSubcategory.isActive
        };
        categoryId = cat._id;
        break;
      }
    }

    // If category not found, return error
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      });
    }

    // Build product query
    const query = {
      subcategoryId: subcategoryId,
      isActive: true,
      approvalStatus: { $in: ['approved', 'not_required'] }
    };

    // Get products with pagination
    const products = await Product.find(query)
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    // Transform products for response
    const transformedProducts = products.map(product => {
      const productObj = product.toObject();
      
      const mainImage = productObj.mainImages?.[0] || 
                        productObj.variants?.[0]?.images?.[0] || 
                        null;

      const variants = productObj.variants || [];                  
      
      const prices = productObj.variants?.map(v => v.discountPrice || v.price) || [];
      const priceRange = {
        min: prices.length ? Math.min(...prices) : 0,
        max: prices.length ? Math.max(...prices) : 0
      };
      
      return {
        _id: productObj._id,
        name: productObj.name,
        description: productObj.description,
        displayPrice: productObj.displayPrice,
        displayActualPrice: productObj.displayActualPrice,
        maxDiscount: productObj.maxDiscount,
        mainImage: mainImage,
        priceRange: priceRange,
        variants: variants,
        availableColors: productObj.availableColors || [],
        availableSizes: productObj.availableSizes || [],
        totalStock: productObj.totalStock || 0,
        averageRating: productObj.averageRating,
        createdAt: productObj.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      category: category,
      subcategory: subcategory,
      count: transformedProducts.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products: transformedProducts
    });

  } catch (error) {
    console.error('getProductsBySubcategory error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// ==================== ADD IMAGES TO VARIANT ====================
export const addVariantImages = async (req, res) => {
  console.log('=== ADD VARIANT IMAGES DEBUG ===');
  console.log('req.files:', req.files);
  console.log('Content-Type:', req.headers['content-type']);
  
  try {
    const { productId, variantId } = req.params;
    const imageFiles = req.files || [];
    
    console.log(`📸 Received ${imageFiles.length} image(s)`);

    if (!imageFiles.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    
    const imageUrls = imageFiles.map(file => 
      getFileUrl(req, path.basename(file.path), 'products')
    );
    
    // Add images to variant
    variant.images.push(...imageUrls);
    
    // Update mainImages array in product (first image of each variant)
    product.mainImages = product.variants
      .filter(v => v.images && v.images.length > 0)
      .map(v => v.images[0]);
    
    await product.save();
    
    return res.status(200).json({
      success: true,
      message: `${imageUrls.length} image(s) added to ${variant.color}`,
      variant: {
        id: variant._id,
        color: variant.color,
        price: variant.price,
        discountPrice: variant.discountPrice,
        images: variant.images,
        sizes: variant.sizes
      }
    });
    
  } catch (error) {
    console.error('addVariantImages error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET VARIANT IMAGES ====================
export const getVariantImages = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    
    return res.status(200).json({
      success: true,
      variant: {
        id: variant._id,
        color: variant.color,
        price: variant.price,
        discountPrice: variant.discountPrice,
        images: variant.images,
        sizes: variant.sizes,
        totalImages: variant.images.length
      }
    });
    
  } catch (error) {
    console.error('getVariantImages error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== SET MAIN IMAGE ====================
export const setVariantMainImage = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    
    if (!variant.images.includes(imageUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Image not found in variant gallery'
      });
    }
    
    // Note: In new schema, there's no separate mainImage field.
    // The first image in the array is considered the main image.
    // To set a main image, we need to reorder the images array.
    const currentIndex = variant.images.indexOf(imageUrl);
    if (currentIndex !== -1) {
      // Move the selected image to the front
      variant.images.splice(currentIndex, 1);
      variant.images.unshift(imageUrl);
    }
    
    // Update product mainImages
    product.mainImages = product.variants
      .filter(v => v.images && v.images.length > 0)
      .map(v => v.images[0]);
    
    await product.save();
    
    return res.status(200).json({
      success: true,
      message: 'Main image updated successfully',
      variant: {
        id: variant._id,
        color: variant.color,
        price: variant.price,
        discountPrice: variant.discountPrice,
        images: variant.images,
        sizes: variant.sizes
      }
    });
    
  } catch (error) {
    console.error('setVariantMainImage error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REMOVE IMAGE FROM VARIANT ====================
export const removeVariantImage = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    
    if (!variant.images.includes(imageUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Image not found in variant gallery'
      });
    }
    
    // Remove image from array
    variant.images = variant.images.filter(img => img !== imageUrl);
    
    // Update product mainImages
    product.mainImages = product.variants
      .filter(v => v.images && v.images.length > 0)
      .map(v => v.images[0]);
    
    await product.save();
    
    // Delete physical file if not a URL
    if (!imageUrl.startsWith('http')) {
      deleteFile(imageUrl);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Image removed successfully',
      variant: {
        id: variant._id,
        color: variant.color,
        price: variant.price,
        discountPrice: variant.discountPrice,
        images: variant.images,
        sizes: variant.sizes
      }
    });
    
  } catch (error) {
    console.error('removeVariantImage error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DELETE ALL VARIANT IMAGES ====================
export const deleteAllVariantImages = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    
    // Delete physical files
    variant.images.forEach(image => {
      if (!image.startsWith('http')) {
        deleteFile(image);
      }
    });
    
    // Clear images array
    variant.images = [];
    
    // Update product mainImages
    product.mainImages = product.variants
      .filter(v => v.images && v.images.length > 0)
      .map(v => v.images[0]);
    
    await product.save();
    
    return res.status(200).json({
      success: true,
      message: `All images removed from ${variant.color} variant`,
      variant: {
        id: variant._id,
        color: variant.color,
        price: variant.price,
        discountPrice: variant.discountPrice,
        images: variant.images,
        sizes: variant.sizes
      }
    });
    
  } catch (error) {
    console.error('deleteAllVariantImages error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== REORDER VARIANT IMAGES ====================
export const reorderVariantImages = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const { imageOrder } = req.body;
    
    if (!imageOrder || !Array.isArray(imageOrder)) {
      return res.status(400).json({
        success: false,
        message: 'imageOrder array is required'
      });
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }
    
    // Verify all images exist
    const allImagesExist = imageOrder.every(url => variant.images.includes(url));
    if (!allImagesExist) {
      return res.status(400).json({
        success: false,
        message: 'Some images in order do not exist in variant'
      });
    }
    
    variant.images = imageOrder;
    
    // Update product mainImages
    product.mainImages = product.variants
      .filter(v => v.images && v.images.length > 0)
      .map(v => v.images[0]);
    
    await product.save();
    
    return res.status(200).json({
      success: true,
      message: 'Images reordered successfully',
      variant: {
        id: variant._id,
        color: variant.color,
        price: variant.price,
        discountPrice: variant.discountPrice,
        images: variant.images,
        sizes: variant.sizes
      }
    });
    
  } catch (error) {
    console.error('reorderVariantImages error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// Get all orders (Admin)
export const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      startDate,
      endDate,
      search
    } = req.query;

    let query = {};

    if (status && status !== 'all') query.orderStatus = status;
    if (paymentMethod && paymentMethod !== 'all') query.paymentMethod = paymentMethod;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      if (search.startsWith('ORD')) {
        query.orderId = { $regex: search, $options: 'i' };
      } else {
        const users = await User.find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { mobile: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          query.userId = { $in: userIds };
        } else {
          return res.status(200).json({ success: true, count: 0, total: 0, orders: [] });
        }
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email mobile');

    const total = await Order.countDocuments(query);

    // Calculate statistics
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          averageOrderValue: { $avg: '$finalAmount' },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] } },
          confirmedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'confirmed'] }, 1, 0] } },
          processingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] } },
          shippedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'shipped'] }, 1, 0] } },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      stats: stats[0] || {
        totalOrders: 0, totalRevenue: 0, averageOrderValue: 0,
        pendingOrders: 0, confirmedOrders: 0, processingOrders: 0,
        shippedOrders: 0, deliveredOrders: 0, cancelledOrders: 0
      },
      orders
    });

  } catch (error) {
    console.error('getAllOrders error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single order by ID (Admin)
export const getOrderByIdAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId }).populate('userId', 'name email mobile');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Get product details for each item
    const itemsWithDetails = await Promise.all(order.items.map(async (item) => {
      const product = await Product.findById(item.productId).select('name description images');
      const variant = product?.variants?.id(item.variantId);
      const sizeObj = variant?.sizes?.id(item.sizeId);
      
      return {
        ...item.toObject(),
        productName: product?.name,
        productDescription: product?.description,
        productImage: product?.images?.[0] || variant?.images?.[0] || null,
        color: variant?.color,
        sizeName: sizeObj?.size
      };
    }));

    return res.status(200).json({
      success: true,
      order: {
        ...order.toObject(),
        items: itemsWithDetails
      }
    });

  } catch (error) {
    console.error('getOrderByIdAdmin error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// export const updateOrderStatus = async (req, res) => {
//   try {
//     const { orderId } = req.params;
//     const { orderStatus, paymentStatus, trackingId, estimatedDelivery } = req.body;

//     const order = await Order.findOne({ orderId });
//     if (!order) {
//       return res.status(404).json({ success: false, message: 'Order not found' });
//     }

//     const oldStatus = order.orderStatus;
//     const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
//     if (orderStatus && !validStatuses.includes(orderStatus)) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid order status. Must be one of: ${validStatuses.join(', ')}`
//       });
//     }

//     // ✅ Update individual item status when order status changes
//     if (orderStatus) {
//       order.orderStatus = orderStatus;
      
//       // Update all items to the same status
//       order.items.forEach(item => {
//         item.status = orderStatus;
//       });
//     }
    
//     if (paymentStatus) order.paymentStatus = paymentStatus;
//     if (trackingId) order.trackingId = trackingId;
//     if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery);
    
//     if (orderStatus === 'delivered') order.deliveredAt = new Date();
//     if (orderStatus === 'cancelled') order.cancelledAt = new Date();

//     await order.save();

//     return res.status(200).json({
//       success: true,
//       message: `Order status updated from ${oldStatus} to ${order.orderStatus}`,
//       order: {
//         _id: order._id,
//         orderId: order.orderId,
//         orderStatus: order.orderStatus,
//         items: order.items.map(item => ({
//           productId: item.productId,
//           status: item.status  // Now shows correct status
//         })),
//         paymentStatus: order.paymentStatus,
//         trackingId: order.trackingId,
//         updatedAt: order.updatedAt
//       }
//     });

//   } catch (error) {
//     console.error('updateOrderStatus error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// Update order status - Automatically triggers cashback on delivery
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // ✅ Check if order is being marked as delivered
    const isDelivered = orderStatus === 'delivered' && order.orderStatus !== 'delivered';

    // Update order status
    order.orderStatus = orderStatus;
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();
    }
    await order.save();

    // ✅ AUTOMATIC CASHBACK - Trigger when order is delivered
    if (isDelivered) {
      await processCashbackForOrder(order);
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${orderStatus}`,
      data: order
    });

  } catch (error) {
    console.error('updateOrderStatus error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== CASHBACK PROCESSING FUNCTION ====================

const processCashbackForOrder = async (order) => {
  try {
    console.log(`🔄 Processing cashback for order: ${order.orderId}`);

    // Get settings
    const settings = await DesignerSettings.findOne();
    if (!settings) {
      console.log('❌ Designer settings not found');
      return;
    }

    const { productFee, cashbackPercentage, salesThresholdForCashback } = settings;

    // Process each item in the order
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      
      // ✅ Only process designer products
      if (!product || product.createdBy !== 'designer') {
        continue;
      }

      const designer = await Designer.findById(product.creatorId);
      if (!designer) {
        continue;
      }

      // ✅ Check if cashback already given for this product
      const cashbackGiven = designer.wallet.transactions.some(
        t => t.referenceId === product._id.toString() && 
             t.type === 'cashback' && 
             t.status === 'completed'
      );

      if (cashbackGiven) {
        console.log(`⚠️ Cashback already given for product: ${product.name}`);
        continue;
      }

      // ✅ Count total delivered orders for this product
      const deliveredCount = await Order.countDocuments({
        'items.productId': product._id,
        orderStatus: 'delivered'
      });

      console.log(`📊 Product: ${product.name}, Delivered: ${deliveredCount}, Threshold: ${salesThresholdForCashback}`);

      // ✅ Check if threshold met
      if (deliveredCount >= salesThresholdForCashback) {
        // Calculate cashback
        const cashbackAmount = (productFee * cashbackPercentage) / 100;

        // ✅ Add cashback to designer's wallet
        designer.wallet.transactions.push({
          type: 'cashback',
          amount: cashbackAmount,
          description: `${cashbackPercentage}% cashback (${deliveredCount} sales) for ${product.name}`,
          referenceId: product._id.toString(),
          referenceType: 'cashback',
          status: 'completed',
          balance: designer.wallet.balance + cashbackAmount
        });

        designer.wallet.balance += cashbackAmount;
        designer.cashbackReceived = (designer.cashbackReceived || 0) + cashbackAmount;
        await designer.save();

        console.log(`✅ Cashback added for product: ${product.name}, Amount: ₹${cashbackAmount}`);
      }
    }
  } catch (error) {
    console.error('processCashbackForOrder error:', error);
  }
};

// Get order statistics (Admin)
export const getOrderStatistics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let dateFilter = {};
    const now = new Date();

    if (period === 'day') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
    } else if (period === 'week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: start } };
    } else if (period === 'month') {
      dateFilter = {
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        }
      };
    } else if (period === 'year') {
      dateFilter = {
        createdAt: {
          $gte: new Date(now.getFullYear(), 0, 1),
          $lte: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
        }
      };
    }

    const stats = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          averageOrderValue: { $avg: '$finalAmount' },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] } },
          confirmedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'confirmed'] }, 1, 0] } },
          processingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'processing'] }, 1, 0] } },
          shippedOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'shipped'] }, 1, 0] } },
          deliveredOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'cancelled'] }, 1, 0] } }
        }
      }
    ]);

    // Daily sales for chart
    const dailySales = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$finalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return res.status(200).json({
      success: true,
      period,
      stats: stats[0] || {
        totalOrders: 0, totalRevenue: 0, averageOrderValue: 0,
        pendingOrders: 0, confirmedOrders: 0, processingOrders: 0,
        shippedOrders: 0, deliveredOrders: 0, cancelledOrders: 0
      },
      dailySales
    });

  } catch (error) {
    console.error('getOrderStatistics error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ==================== LOGIN SCREEN MEDIA CONTROLLERS ====================

/**
 * Upload login screen media (replaces any existing media)
 * POST /api/admin/login-screen/upload
 */
export const uploadLoginScreenMedia = async (req, res) => {
  try {
    const file = req.file;
    const adminId = req.user.id;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const mediaType = file.mimetype.startsWith('image/') ? 'image' : 'video';
    const folder = mediaType === 'image' ? 'login-screen/images' : 'login-screen/videos';
    const urlFolder = mediaType === 'image' ? 'login-screen/images' : 'login-screen/videos';

    // Delete existing media from database and filesystem
    const existingMedia = await LoginScreenMedia.findOne();
    
    if (existingMedia) {
      // Delete physical file
      const oldFolder = existingMedia.type === 'image' ? 'login-screen/images' : 'login-screen/videos';
      const oldFilePath = `uploads/${oldFolder}/${existingMedia.filename}`;
      deleteFile(oldFilePath);
      
      // Delete database record
      await LoginScreenMedia.deleteOne({ _id: existingMedia._id });
    }

    // Ensure directory exists
    if (!fs.existsSync(`uploads/${folder}`)) {
      fs.mkdirSync(`uploads/${folder}`, { recursive: true });
    }

    // Save to database
    const newMedia = new LoginScreenMedia({
      type: mediaType,
      filename: file.filename,
      url: getFileUrl(req, path.basename(file.path), urlFolder)
    });

    await newMedia.save();

    return res.status(200).json({
      success: true,
      message: `${mediaType} uploaded successfully`,
      data: {
        type: mediaType,
        url: newMedia.url,
        filename: newMedia.filename
      }
    });

  } catch (error) {
    if (req.file?.path) deleteFile(req.file.path);
    return res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * Delete current active media
 * DELETE /api/admin/login-screen/media
 */
export const deleteLoginScreenMedia = async (req, res) => {
  try {
    const media = await LoginScreenMedia.findOne();
    
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'No media found'
      });
    }

    // Delete physical file
    const folder = media.type === 'image' ? 'login-screen/images' : 'login-screen/videos';
    const filePath = `uploads/${folder}/${media.filename}`;
    deleteFile(filePath);
    
    // Delete database record
    await LoginScreenMedia.deleteOne({ _id: media._id });

    return res.status(200).json({
      success: true,
      message: 'Login screen media deleted successfully'
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Check if media exists (admin)
 * GET /api/admin/login-screen/media/exists
 */
export const checkLoginScreenMedia = async (req, res) => {
  try {
    const media = await LoginScreenMedia.findOne();
    
    return res.status(200).json({
      success: true,
      exists: !!media,
      data: media ? {
        type: media.type,
        url: media.url,
        filename: media.filename
      } : null
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ==================== HERO SECTION CONTROLLERS ====================

// Helper function to extract YouTube ID from URL (for frontend use)
const extractYouTubeId = (url) => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/i,
    /(?:youtu\.be\/)([^?]+)/i,
    /(?:youtube\.com\/embed\/)([^?]+)/i,
    /(?:youtube\.com\/shorts\/)([^?]+)/i
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

/**
 * Add hero section
 * POST /api/admin/homepage/hero/add
 */
export const addHeroSection = async (req, res) => {
  try {
    const { type, order, url } = req.body;
    const file = req.file;

    if (!type || !['image', 'video', 'youtube'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type is required and must be "image", "video", or "youtube"'
      });
    }

    let filename = null;
    let fileUrl = null;

    // Handle file upload for image/video
    if (type === 'image' || type === 'video') {
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'File is required for image/video type'
        });
      }

      const folder = type === 'image' ? 'homepage/hero/images' : 'homepage/hero/videos';
      const urlFolder = type === 'image' ? 'homepage/hero/images' : 'homepage/hero/videos';
      
      if (!fs.existsSync(`uploads/${folder}`)) {
        fs.mkdirSync(`uploads/${folder}`, { recursive: true });
      }

      filename = file.filename;
      fileUrl = getFileUrl(req, path.basename(file.path), urlFolder);
    } 
    // Handle YouTube URL
    else if (type === 'youtube') {
      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'URL is required for youtube type'
        });
      }
      fileUrl = url;
    }

    let homePage = await HomePage.findOne();
    if (!homePage) {
      homePage = new HomePage({ heroSections: [], banners: [] });
    }

    homePage.heroSections.push({
      type,
      filename,
      url: fileUrl,
      order: order !== undefined ? order : homePage.heroSections.length,
      isActive: true
    });

    await homePage.save();

    return res.status(201).json({
      success: true,
      message: 'Hero section added successfully',
      data: homePage.heroSections
    });

  } catch (error) {
    if (req.file?.path) deleteFile(req.file.path);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all hero sections (Admin)
 * GET /api/admin/homepage/hero
 */
export const getHeroSections = async (req, res) => {
  try {
    const homePage = await HomePage.findOne();
    
    if (!homePage) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      data: homePage.heroSections.sort((a, b) => a.order - b.order)
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single hero section by ID (Admin)
 * GET /api/admin/homepage/hero/:heroId
 */
export const getHeroSectionById = async (req, res) => {
  try {
    const { heroId } = req.params;

    const homePage = await HomePage.findOne();
    if (!homePage) {
      return res.status(404).json({
        success: false,
        message: 'Home page not found'
      });
    }

    const hero = homePage.heroSections.id(heroId);
    if (!hero) {
      return res.status(404).json({
        success: false,
        message: 'Hero section not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: hero
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update hero section
 * PUT /api/admin/homepage/hero/:heroId
 */
export const updateHeroSection = async (req, res) => {
  try {
    const { heroId } = req.params;
    const { type, order, isActive, url } = req.body;
    const file = req.file;

    const homePage = await HomePage.findOne();
    if (!homePage) {
      return res.status(404).json({ success: false, message: 'Home page not found' });
    }

    const hero = homePage.heroSections.id(heroId);
    if (!hero) {
      return res.status(404).json({ success: false, message: 'Hero section not found' });
    }

    if (type) hero.type = type;
    if (order !== undefined) hero.order = order;
    if (isActive !== undefined) hero.isActive = isActive === 'true';

    // Handle file update for image/video
    if (file && (hero.type === 'image' || hero.type === 'video')) {
      if (hero.filename) {
        const oldFolder = hero.type === 'image' ? 'homepage/hero/images' : 'homepage/hero/videos';
        const oldFilePath = `uploads/${oldFolder}/${hero.filename}`;
        deleteFile(oldFilePath);
      }
      
      const folder = hero.type === 'image' ? 'homepage/hero/images' : 'homepage/hero/videos';
      const urlFolder = hero.type === 'image' ? 'homepage/hero/images' : 'homepage/hero/videos';
      
      hero.filename = file.filename;
      hero.url = getFileUrl(req, path.basename(file.path), urlFolder);
    }
    
    // Handle URL update for youtube
    if (hero.type === 'youtube' && url) {
      hero.url = url;
    }

    await homePage.save();

    return res.status(200).json({
      success: true,
      message: 'Hero section updated successfully',
      data: hero
    });

  } catch (error) {
    if (req.file?.path) deleteFile(req.file.path);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete hero section
 * DELETE /api/admin/homepage/hero/:heroId
 */
export const deleteHeroSection = async (req, res) => {
  try {
    const { heroId } = req.params;

    const homePage = await HomePage.findOne();
    if (!homePage) {
      return res.status(404).json({ success: false, message: 'Home page not found' });
    }

    const hero = homePage.heroSections.id(heroId);
    if (!hero) {
      return res.status(404).json({ success: false, message: 'Hero section not found' });
    }

    if (hero.filename) {
      const folder = hero.type === 'image' ? 'homepage/hero/images' : 'homepage/hero/videos';
      const filePath = `uploads/${folder}/${hero.filename}`;
      deleteFile(filePath);
    }

    homePage.heroSections.pull(heroId);
    await homePage.save();

    return res.status(200).json({
      success: true,
      message: 'Hero section deleted successfully'
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Toggle hero section status
 * PATCH /api/admin/homepage/hero/:heroId/toggle
 */
export const toggleHeroSection = async (req, res) => {
  try {
    const { heroId } = req.params;

    const homePage = await HomePage.findOne();
    if (!homePage) {
      return res.status(404).json({ success: false, message: 'Home page not found' });
    }

    const hero = homePage.heroSections.id(heroId);
    if (!hero) {
      return res.status(404).json({ success: false, message: 'Hero section not found' });
    }

    hero.isActive = !hero.isActive;
    await homePage.save();

    return res.status(200).json({
      success: true,
      message: `Hero section ${hero.isActive ? 'activated' : 'deactivated'}`,
      data: hero
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== BANNER SECTION CONTROLLERS ====================

/**
 * Add banner section
 * POST /api/admin/homepage/banner/add
 */
export const addBannerSection = async (req, res) => {
  try {
    const { title, subtitle, tag, buttonText, order } = req.body;
    const file = req.file;

    if (!title || !file) {
      return res.status(400).json({
        success: false,
        message: 'Title and image are required'
      });
    }

    const folder = 'homepage/banners';
    if (!fs.existsSync(`uploads/${folder}`)) {
      fs.mkdirSync(`uploads/${folder}`, { recursive: true });
    }

    const imageUrl = getFileUrl(req, path.basename(file.path), folder);

    let homePage = await HomePage.findOne();
    if (!homePage) {
      homePage = new HomePage({ heroSections: [], banners: [] });
    }


    homePage.banners.push({
      title,
      subtitle: subtitle || '',
      tag: tag || '',
      buttonText: buttonText || 'Shop Now',
      image: imageUrl,
      order: order || homePage.banners.length,
      isActive: true
    });

    await homePage.save();

    return res.status(201).json({
      success: true,
      message: 'Banner section added successfully',
      data: homePage.banners
    });

  } catch (error) {
    if (req.file?.path) deleteFile(req.file.path);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all banner sections (Admin)
 * GET /api/admin/homepage/banner
 */
export const getBannerSections = async (req, res) => {
  try {
    const homePage = await HomePage.findOne();
    
    if (!homePage) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      data: homePage.banners.sort((a, b) => a.order - b.order)
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single banner section by ID (Admin)
 * GET /api/admin/homepage/banner/:bannerId
 */
export const getBannerSectionById = async (req, res) => {
  try {
    const { bannerId } = req.params;

    const homePage = await HomePage.findOne();
    if (!homePage) {
      return res.status(404).json({
        success: false,
        message: 'Home page not found'
      });
    }

    const banner = homePage.banners.id(bannerId);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner section not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: banner
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update banner section
 * PUT /api/admin/homepage/banner/:bannerId
 */
export const updateBannerSection = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { title, subtitle, tag, buttonText, order, isActive } = req.body;
    const file = req.file;

    const homePage = await HomePage.findOne();
    if (!homePage) {
      return res.status(404).json({ success: false, message: 'Home page not found' });
    }

    const banner = homePage.banners.id(bannerId);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner section not found' });
    }

    if (title) banner.title = title;
    if (subtitle !== undefined) banner.subtitle = subtitle;
    if (tag !== undefined) banner.tag = tag;
    if (buttonText) banner.buttonText = buttonText;
    if (order !== undefined) banner.order = order;
    if (isActive !== undefined) banner.isActive = isActive === 'true';


    if (file) {
      if (banner.image && !banner.image.startsWith('http')) {
        deleteFile(banner.image);
      }
      const folder = 'homepage/banners';
      banner.image = getFileUrl(req, path.basename(file.path), folder);
    }

    await homePage.save();

    return res.status(200).json({
      success: true,
      message: 'Banner section updated successfully',
      data: banner
    });

  } catch (error) {
    if (req.file?.path) deleteFile(req.file.path);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete banner section
 * DELETE /api/admin/homepage/banner/:bannerId
 */
export const deleteBannerSection = async (req, res) => {
  try {
    const { bannerId } = req.params;

    const homePage = await HomePage.findOne();
    if (!homePage) {
      return res.status(404).json({ success: false, message: 'Home page not found' });
    }

    const banner = homePage.banners.id(bannerId);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner section not found' });
    }

    if (banner.image && !banner.image.startsWith('http')) {
      deleteFile(banner.image);
    }

    homePage.banners.pull(bannerId);
    await homePage.save();

    return res.status(200).json({
      success: true,
      message: 'Banner section deleted successfully'
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Toggle banner section status
 * PATCH /api/admin/homepage/banner/:bannerId/toggle
 */
export const toggleBannerSection = async (req, res) => {
  try {
    const { bannerId } = req.params;

    const homePage = await HomePage.findOne();
    if (!homePage) {
      return res.status(404).json({ success: false, message: 'Home page not found' });
    }

    const banner = homePage.banners.id(bannerId);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner section not found' });
    }

    banner.isActive = !banner.isActive;
    await homePage.save();

    return res.status(200).json({
      success: true,
      message: `Banner section ${banner.isActive ? 'activated' : 'deactivated'}`,
      data: banner
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};



// ==================== COLLECTION CRUD OPERATIONS ====================

/**
 * Create a new collection
 * POST /api/admin/collections
 */
export const createCollection = async (req, res) => {
  try {
    const { title, tag, description, order } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Image is required'
      });
    }

    // Check if collection already exists
    const existingCollection = await Collection.findOne({ title });
    if (existingCollection) {
      return res.status(400).json({
        success: false,
        message: 'Collection with this title already exists'
      });
    }

    const imageUrl = getFileUrl(req, file.filename, 'collections');

    const collection = new Collection({
      title,
      tag,
      description,
      image: imageUrl,
      order: order || 0,
      isActive: true,
      products: []
    });

    await collection.save();

    return res.status(201).json({
      success: true,
      message: 'Collection created successfully',
      data: collection
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all collections (Admin)
 * GET /api/admin/collections
 */
export const getAllCollections = async (req, res) => {
  try {
    const collections = await Collection.find()
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
 * Get single collection by ID (Admin)
 * GET /api/admin/collections/:collectionId
 */
export const getCollectionById = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findById(collectionId)
      .populate('products');

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

/**
 * Update collection
 * PUT /api/admin/collections/:collectionId
 */
export const updateCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { title, tag, description, order, isActive } = req.body;
    const file = req.file;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Update fields
    if (title) collection.title = title;
    if (tag) collection.tag = tag;
    if (description) collection.description = description;
    if (file) {
      collection.image = getFileUrl(req, file.filename, 'collections');
    }
    if (order !== undefined) collection.order = order;
    if (isActive !== undefined) collection.isActive = isActive === 'true' || isActive === true;

    await collection.save();

    return res.status(200).json({
      success: true,
      message: 'Collection updated successfully',
      data: collection
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete collection
 * DELETE /api/admin/collections/:collectionId
 */
export const deleteCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findByIdAndDelete(collectionId);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Collection deleted successfully'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Toggle collection status (Active/Inactive)
 * PATCH /api/admin/collections/:collectionId/toggle
 */
export const toggleCollectionStatus = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    collection.isActive = !collection.isActive;
    await collection.save();

    return res.status(200).json({
      success: true,
      message: `Collection ${collection.isActive ? 'activated' : 'deactivated'} successfully`,
      data: collection
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== PRODUCT MANAGEMENT IN COLLECTIONS ====================

/**
 * Add product to collection
 * POST /api/admin/collections/:collectionId/products
 * Body: { productId: "product_id_here" }
 */
export const addProductToCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Check if collection exists
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product already in collection
    if (collection.products.includes(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product already in this collection'
      });
    }

    // Add product to collection
    collection.products.push(productId);
    await collection.save();

    const updatedCollection = await Collection.findById(collectionId)
      .populate('products');

    return res.status(200).json({
      success: true,
      message: 'Product added to collection successfully',
      data: updatedCollection
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Remove product from collection
 * DELETE /api/admin/collections/:collectionId/products/:productId
 */
export const removeProductFromCollection = async (req, res) => {
  try {
    const { collectionId, productId } = req.params;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Remove product from collection
    collection.products = collection.products.filter(
      id => id.toString() !== productId
    );
    await collection.save();

    const updatedCollection = await Collection.findById(collectionId)
      .populate('products');

    return res.status(200).json({
      success: true,
      message: 'Product removed from collection successfully',
      data: updatedCollection
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all products in a collection (Admin)
 * GET /api/admin/collections/:collectionId/products
 */
export const getCollectionProducts = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findById(collectionId)
      .populate('products');

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    return res.status(200).json({
      success: true,
      count: collection.products.length,
      data: collection.products
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Add multiple products to collection
 * POST /api/admin/collections/:collectionId/products/bulk
 * Body: { productIds: ["id1", "id2", "id3"] }
 */
export const addMultipleProductsToCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Verify all products exist
    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products not found'
      });
    }

    // Add only new products (avoid duplicates)
    const newProducts = productIds.filter(
      id => !collection.products.includes(id)
    );

    collection.products.push(...newProducts);
    await collection.save();

    const updatedCollection = await Collection.findById(collectionId)
      .populate('products');

    return res.status(200).json({
      success: true,
      message: `${newProducts.length} products added to collection`,
      data: updatedCollection
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== HOMEPAGE COLLECTION MANAGEMENT ====================

/**
 * Add collection to homepage
 * POST /api/admin/homepage/collections
 * Body: { collectionId, order }
 */
export const addCollectionToHomepage = async (req, res) => {
  try {
    const { collectionId, order } = req.body;

    if (!collectionId) {
      return res.status(400).json({
        success: false,
        message: 'Collection ID is required'
      });
    }

    // Check if collection exists
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Find or create homepage
    let homepage = await HomePage.findOne();
    if (!homepage) {
      homepage = new HomePage({
        heroSections: [],
        banners: [],
        homepageCollections: []
      });
    }

    // Check if collection already exists in homepage
    const alreadyExists = homepage.homepageCollections.some(
      item => item.collectionId.toString() === collectionId
    );

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        message: 'Collection already added to homepage'
      });
    }

    // Add collection to homepage
    homepage.homepageCollections.push({
      collectionId,
      order: order !== undefined ? order : homepage.homepageCollections.length,
      isActive: true
    });

    await homepage.save();

    // Populate the newly added collection
    const updatedHomepage = await HomePage.findById(homepage._id)
      .populate({
        path: 'homepageCollections.collectionId',
        populate: {
          path: 'products',
          model: 'Product'
        }
      });

    return res.status(200).json({
      success: true,
      message: 'Collection added to homepage successfully',
      data: updatedHomepage.homepageCollections
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Remove collection from homepage
 * DELETE /api/admin/homepage/collections/:collectionId
 */
export const removeCollectionFromHomepage = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const homepage = await HomePage.findOne();
    if (!homepage) {
      return res.status(404).json({
        success: false,
        message: 'Homepage not found'
      });
    }

    // Check if collection exists in homepage
    const exists = homepage.homepageCollections.some(
      item => item.collectionId.toString() === collectionId
    );

    console.log('Homepage Collections:', homepage.homepageCollections);
    console.log('Checking for Collection ID:', collectionId, 'Exists:', exists);

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found in homepage'
      });
    }

    // Remove collection from array
    homepage.homepageCollections = homepage.homepageCollections.filter(
      item => item.collectionId.toString() !== collectionId
    );

    await homepage.save();

    return res.status(200).json({
      success: true,
      message: 'Collection removed from homepage successfully'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update collection order on homepage
 * PUT /api/admin/homepage/collections/reorder
 * Body: { collections: [{ collectionId, order }] }
 */
export const reorderHomepageCollections = async (req, res) => {
  try {
    const { collections } = req.body;

    if (!collections || !Array.isArray(collections)) {
      return res.status(400).json({
        success: false,
        message: 'Collections array is required'
      });
    }

    const homepage = await HomePage.findOne();
    if (!homepage) {
      return res.status(404).json({
        success: false,
        message: 'Homepage not found'
      });
    }

    // Update order for each collection
    collections.forEach(({ collectionId, order }) => {
      const collectionItem = homepage.homepageCollections.find(
        item => item.collectionId.toString() === collectionId
      );
      if (collectionItem) {
        collectionItem.order = order;
      }
    });

    // Sort the array based on order
    homepage.homepageCollections.sort((a, b) => a.order - b.order);

    await homepage.save();

    // Populate updated data
    const updatedHomepage = await HomePage.findById(homepage._id)
      .populate({
        path: 'homepageCollections.collectionId',
        populate: {
          path: 'products',
          model: 'Product'
        }
      });

    return res.status(200).json({
      success: true,
      message: 'Collections reordered successfully',
      data: updatedHomepage.homepageCollections
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Toggle collection visibility on homepage
 * PATCH /api/admin/homepage/collections/:collectionId/toggle
 */
export const toggleHomepageCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const homepage = await HomePage.findOne();
    if (!homepage) {
      return res.status(404).json({
        success: false,
        message: 'Homepage not found'
      });
    }

    // Find the collection in array
    const collectionItem = homepage.homepageCollections.find(
      item => item.collectionId.toString() === collectionId
    );

    if (!collectionItem) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found in homepage'
      });
    }

    // Toggle isActive status
    collectionItem.isActive = !collectionItem.isActive;

    await homepage.save();

    return res.status(200).json({
      success: true,
      message: `Collection ${collectionItem.isActive ? 'activated' : 'deactivated'} on homepage`,
      data: {
        collectionId: collectionItem.collectionId,
        isActive: collectionItem.isActive
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all homepage collections (for admin)
 * GET /api/admin/homepage/collections
 */
export const getHomepageCollections = async (req, res) => {
  try {
    const homepage = await HomePage.findOne();
    
    if (!homepage || homepage.homepageCollections.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    // Populate collection details with products
    const populatedHomepage = await HomePage.findById(homepage._id)
      .populate({
        path: 'homepageCollections.collectionId',
        populate: {
          path: 'products',
          model: 'Product'
        }
      });

    // Sort by order
    const sortedCollections = populatedHomepage.homepageCollections.sort(
      (a, b) => a.order - b.order
    );

    return res.status(200).json({
      success: true,
      count: sortedCollections.length,
      data: sortedCollections
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== Recommended Products ====================

export const addRecommendedProducts = async (req, res) => {
  try {
    const { productId, productIds } = req.body;

    let ids = [];
    if (productId) {
      ids = [productId.toString().trim()]; // ✅ Trim spaces
    } else if (productIds && Array.isArray(productIds)) {
      ids = productIds.map(id => id.toString().trim()); // ✅ Trim each ID
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either "productId" (single) or "productIds" array (multiple)'
      });
    }

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product ID is required'
      });
    }

    const results = {
      added: [],
      failed: [],
      skipped: []
    };

    for (const id of ids) {
      if (!id) {
        results.failed.push({ productId: id, reason: 'Product ID missing' });
        continue;
      }

      // ✅ Use lean() to avoid virtuals
      const product = await Product.findById(id).lean();
      if (!product) {
        results.failed.push({ productId: id, reason: 'Product not found' });
        continue;
      }

      const existing = await RecommendedProduct.findOne({ productId: id });
      if (existing) {
        results.skipped.push({ productId: id, reason: 'Already in recommended list' });
        continue;
      }

      const recommended = new RecommendedProduct({
        productId: id,
        isActive: true
      });

      await recommended.save();
      results.added.push(recommended);
    }

    const isSingle = ids.length === 1;
    let message = '';
    if (isSingle) {
      if (results.added.length === 1) {
        message = 'Product added to recommended list';
      } else if (results.skipped.length === 1) {
        message = 'Product already in recommended list';
      } else {
        message = 'Failed to add product';
      }
    } else {
      message = `${results.added.length} products added, ${results.skipped.length} skipped, ${results.failed.length} failed`;
    }

    return res.status(201).json({
      success: results.added.length > 0,
      message,
      data: isSingle ? (results.added[0] || null) : results
    });

  } catch (error) {
    console.error('addRecommendedProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRecommendedProducts = async (req, res) => {
  try {
    const { id, ids, productId, productIds } = req.body;

    let recommendedIds = [];

    if (id) {
      recommendedIds = [id];
    } else if (ids && Array.isArray(ids)) {
      recommendedIds = ids;
    } else if (productId) {
      const rec = await RecommendedProduct.findOne({ productId });
      if (rec) {
        recommendedIds = [rec._id];
      }
    } else if (productIds && Array.isArray(productIds)) {
      const recs = await RecommendedProduct.find({ productId: { $in: productIds } });
      recommendedIds = recs.map(r => r._id);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide "id", "ids", "productId", or "productIds"'
      });
    }

    if (recommendedIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid recommended products found to delete'
      });
    }

    const result = await RecommendedProduct.deleteMany({ _id: { $in: recommendedIds } });

    const isSingle = recommendedIds.length === 1;
    const message = isSingle 
      ? 'Product removed from recommended list'
      : `${result.deletedCount} products removed from recommended list`;

    return res.status(200).json({
      success: true,
      message,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('deleteRecommendedProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getRecommendedProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;

    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const recommended = await RecommendedProduct.find(query)
      .populate('productId', 'name description displayPrice displayActualPrice maxDiscount mainImages variants averageRating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await RecommendedProduct.countDocuments(query);

    const products = recommended.map(item => ({
      _id: item._id,
      product: item.productId,
      isActive: item.isActive,
      addedAt: item.createdAt
    }));

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: products
    });

  } catch (error) {
    console.error('getRecommendedProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleRecommendedProduct = async (req, res) => {
  try {
    const { id } = req.params;  

    const recommended = await RecommendedProduct.findById(id);
    if (!recommended) {
      return res.status(404).json({
        success: false,
        message: 'Recommended product not found'
      });
    }

    recommended.isActive = !recommended.isActive;
    await recommended.save();

    return res.status(200).json({
      success: true,
      message: `Recommended product ${recommended.isActive ? 'activated' : 'deactivated'}`,
      data: recommended
    });

  } catch (error) {
    console.error('toggleRecommendedProduct error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== LATEST DESIGNS ====================


export const addLatestDesigns = async (req, res) => {
  try {
    const { productId, productIds } = req.body;

    let ids = [];
    if (productId) {
      ids = [productId.toString().trim()];
    } else if (productIds && Array.isArray(productIds)) {
      ids = productIds.map(id => id.toString().trim());
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide either "productId" (single) or "productIds" array (multiple)'
      });
    }

    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product ID is required'
      });
    }

    const results = {
      added: [],
      failed: [],
      skipped: []
    };

    for (const id of ids) {
      if (!id) {
        results.failed.push({ productId: id, reason: 'Product ID missing' });
        continue;
      }

      const product = await Product.findById(id).lean();
      if (!product) {
        results.failed.push({ productId: id, reason: 'Product not found' });
        continue;
      }

      const existing = await LatestDesign.findOne({ productId: id });
      if (existing) {
        results.skipped.push({ productId: id, reason: 'Already in latest design collection' });
        continue;
      }

      const latestDesign = new LatestDesign({
        productId: id,
        isActive: true
      });

      await latestDesign.save();
      results.added.push(latestDesign);
    }

    const isSingle = ids.length === 1;
    let message = '';
    if (isSingle) {
      if (results.added.length === 1) {
        message = 'Product added to latest design collection';
      } else if (results.skipped.length === 1) {
        message = 'Product already in latest design collection';
      } else {
        message = 'Failed to add product';
      }
    } else {
      message = `${results.added.length} products added, ${results.skipped.length} skipped, ${results.failed.length} failed`;
    }

    return res.status(201).json({
      success: results.added.length > 0,
      message,
      data: isSingle ? (results.added[0] || null) : results
    });

  } catch (error) {
    console.error('addLatestDesigns error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteLatestDesigns = async (req, res) => {
  try {
    const { id, ids, productId, productIds } = req.body;

    let latestDesignIds = [];

    if (id) {
      latestDesignIds = [id];
    } else if (ids && Array.isArray(ids)) {
      latestDesignIds = ids;
    } else if (productId) {
      const latestDesign = await LatestDesign.findOne({ productId });
      if (latestDesign) {
        latestDesignIds = [latestDesign._id];
      }
    } else if (productIds && Array.isArray(productIds)) {
      const latestDesigns = await LatestDesign.find({ productId: { $in: productIds } });
      latestDesignIds = latestDesigns.map(item => item._id);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide "id", "ids", "productId", or "productIds"'
      });
    }

    if (latestDesignIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid latest design products found to delete'
      });
    }

    const result = await LatestDesign.deleteMany({ _id: { $in: latestDesignIds } });

    const isSingle = latestDesignIds.length === 1;
    const message = isSingle 
      ? 'Product removed from latest design collection'
      : `${result.deletedCount} products removed from latest design collection`;

    return res.status(200).json({
      success: true,
      message,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('deleteLatestDesigns error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getLatestDesignsAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;

    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const latestDesigns = await LatestDesign.find(query)
      .populate({
        path: 'productId',
        select: 'name description displayPrice displayActualPrice maxDiscount mainImages variants averageRating'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await LatestDesign.countDocuments(query);

    const products = latestDesigns.map(item => ({
      _id: item._id,
      product: item.productId,
      isActive: item.isActive,
      addedAt: item.createdAt
    }));

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: products
    });

  } catch (error) {
    console.error('getLatestDesignsAdmin error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleLatestDesign = async (req, res) => {
  try {
    const { id } = req.params;

    const latestDesign = await LatestDesign.findById(id);
    if (!latestDesign) {
      return res.status(404).json({
        success: false,
        message: 'Latest design product not found'
      });
    }

    latestDesign.isActive = !latestDesign.isActive;
    await latestDesign.save();

    return res.status(200).json({
      success: true,
      message: `Latest design product ${latestDesign.isActive ? 'activated' : 'deactivated'}`,
      data: latestDesign
    });

  } catch (error) {
    console.error('toggleLatestDesign error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ==================== UPCOMING COLLECTIONS ====================


// Admin: Add collection to upcoming
export const addUpcomingCollection = async (req, res) => {
  try {
    const { collectionId, goLiveDateTime } = req.body;

    console.log('Request body:', req.body);
    console.log('User from token:', req.user);

    if (!collectionId || !goLiveDateTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'Collection ID and goLiveDateTime are required' 
      });
    }

    // Check if collection exists
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ 
        success: false, 
        message: 'Collection not found' 
      });
    }

    // Check if already added
    const existing = await UpcomingCollection.findOne({ 
      collectionId, 
      isActive: true 
    });
    
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'Collection already in upcoming section' 
      });
    }

    // Create upcoming entry - handle createdBy safely
    const upcomingData = {
      collectionId,
      goLiveDateTime: new Date(goLiveDateTime)
    };
    
    // Only add createdBy if user exists
    if (req.user && req.user.id) {
      upcomingData.createdBy = req.user.id;
    }

    const upcoming = new UpcomingCollection(upcomingData);
    await upcoming.save();

    // Populate collection details
    const populated = await UpcomingCollection.findById(upcoming._id)
      .populate('collectionId');

    return res.status(201).json({
      success: true,
      message: 'Collection added to upcoming section',
      data: populated
    });

  } catch (error) {
    console.error('addUpcomingCollection error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Admin: Get all upcoming collections
export const getAllUpcomingCollections = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = { isActive: true };
    if (status === 'upcoming') {
      query.goLiveDateTime = { $gt: new Date() };
    } else if (status === 'expired') {
      query.goLiveDateTime = { $lt: new Date() };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const upcoming = await UpcomingCollection.find(query)
      .populate('collectionId')
      .populate('createdBy', 'name email')
      .sort({ goLiveDateTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await UpcomingCollection.countDocuments(query);
    
    // Add status to each item
    const now = new Date();
    const dataWithStatus = upcoming.map(item => {
      const obj = item.toObject();
      obj.status = item.goLiveDateTime > now ? 'upcoming' : 'expired';
      return obj;
    });

    return res.status(200).json({
      success: true,
      count: dataWithStatus.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: dataWithStatus
    });

  } catch (error) {
    console.error('getAllUpcomingCollections error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Admin: Get single upcoming collection by ID
export const getUpcomingCollectionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const upcoming = await UpcomingCollection.findById(id)
      .populate('collectionId')
      .populate('createdBy', 'name email');
    
    if (!upcoming) {
      return res.status(404).json({ 
        success: false, 
        message: 'Upcoming collection not found' 
      });
    }
    
    const now = new Date();
    const status = upcoming.goLiveDateTime > now ? 'upcoming' : 'expired';
    
    return res.status(200).json({
      success: true,
      data: {
        ...upcoming.toObject(),
        status
      }
    });
    
  } catch (error) {
    console.error('getUpcomingCollectionById error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Admin: Update upcoming collection
export const updateUpcomingCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { collectionId, goLiveDateTime } = req.body;
    
    const upcoming = await UpcomingCollection.findById(id);
    if (!upcoming) {
      return res.status(404).json({ 
        success: false, 
        message: 'Upcoming collection not found' 
      });
    }
    
    if (collectionId) {
      const collection = await Collection.findById(collectionId);
      if (!collection) {
        return res.status(404).json({ 
          success: false, 
          message: 'Collection not found' 
        });
      }
      upcoming.collectionId = collectionId;
    }
    
    if (goLiveDateTime) {
      upcoming.goLiveDateTime = new Date(goLiveDateTime);
    }
    
    await upcoming.save();
    
    const populated = await UpcomingCollection.findById(id)
      .populate('collectionId');
    
    return res.status(200).json({
      success: true,
      message: 'Upcoming collection updated successfully',
      data: populated
    });
    
  } catch (error) {
    console.error('updateUpcomingCollection error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Admin: Remove from upcoming
export const removeUpcomingCollection = async (req, res) => {
  try {
    const { id } = req.params;
    
    const upcoming = await UpcomingCollection.findByIdAndDelete(id);
    if (!upcoming) {
      return res.status(404).json({ 
        success: false, 
        message: 'Upcoming collection not found' 
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Collection removed from upcoming section'
    });

  } catch (error) {
    console.error('removeUpcomingCollection error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};


// ======================= Notification Label ====================

// Admin: Add notifications
export const addNotifications = async (req, res) => {
  try {
    const { notifications } = req.body;

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Notifications array is required'
      });
    }

    let notificationDoc = await NotificationLabel.findOne();
    
    // Format notifications with text only (ID will be auto-generated)
    const newNotifications = notifications.map(text => ({ text }));
    
    if (!notificationDoc) {
      notificationDoc = new NotificationLabel({
        notifications: newNotifications,
        isActive: true
      });
    } else {
      notificationDoc.notifications.push(...newNotifications);
    }

    await notificationDoc.save();

    return res.status(201).json({
      success: true,
      message: `${notifications.length} notification(s) added successfully`,
      data: notificationDoc
    });

  } catch (error) {
    console.error('addNotifications error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Get all notifications
export const getAllNotificationsAdmin = async (req, res) => {
  try {
    const notificationDoc = await NotificationLabel.findOne();
    
    if (!notificationDoc) {
      return res.status(200).json({
        success: true,
        data: {
          notifications: [],
          isActive: true,
          count: 0
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        notifications: notificationDoc.notifications,
        isActive: notificationDoc.isActive,
        count: notificationDoc.notifications.length,
        createdAt: notificationDoc.createdAt,
        updatedAt: notificationDoc.updatedAt
      }
    });

  } catch (error) {
    console.error('getAllNotificationsAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Update notification by ID
export const updateNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Notification text is required'
      });
    }

    const notificationDoc = await NotificationLabel.findOne();
    
    if (!notificationDoc) {
      return res.status(404).json({
        success: false,
        message: 'No notifications found'
      });
    }

    // Find notification by _id
    const notification = notificationDoc.notifications.find(
      n => n._id.toString() === id
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const oldText = notification.text;
    notification.text = text;
    await notificationDoc.save();

    return res.status(200).json({
      success: true,
      message: 'Notification updated successfully',
      data: {
        id: notification._id,
        oldText,
        newText: text,
        notifications: notificationDoc.notifications
      }
    });

  } catch (error) {
    console.error('updateNotificationById error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Delete notification by ID
export const deleteNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const notificationDoc = await NotificationLabel.findOne();
    
    if (!notificationDoc) {
      return res.status(404).json({
        success: false,
        message: 'No notifications found'
      });
    }

    // Find notification by _id
    const notificationIndex = notificationDoc.notifications.findIndex(
      n => n._id.toString() === id
    );

    if (notificationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const deleted = notificationDoc.notifications[notificationIndex];
    notificationDoc.notifications.splice(notificationIndex, 1);
    await notificationDoc.save();

    return res.status(200).json({
      success: true,
      message: `Notification "${deleted.text}" deleted successfully`,
      data: {
        deletedId: id,
        deletedText: deleted.text,
        remainingCount: notificationDoc.notifications.length,
        notifications: notificationDoc.notifications
      }
    });

  } catch (error) {
    console.error('deleteNotificationById error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Toggle single notification by ID
export const toggleNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const notificationDoc = await NotificationLabel.findOne();
    
    if (!notificationDoc) {
      return res.status(404).json({
        success: false,
        message: 'No notifications found'
      });
    }

    // Find notification by _id
    const notification = notificationDoc.notifications.find(
      n => n._id.toString() === id
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isActive = !notification.isActive;
    await notificationDoc.save();

    return res.status(200).json({
      success: true,
      message: `Notification "${notification.text}" ${notification.isActive ? 'activated' : 'deactivated'}`,
      data: {
        id: notification._id,
        text: notification.text,
        isActive: notification.isActive
      }
    });

  } catch (error) {
    console.error('toggleNotificationById error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Toggle entire section
export const toggleSection = async (req, res) => {
  try {
    let notificationDoc = await NotificationLabel.findOne();
    
    if (!notificationDoc) {
      notificationDoc = new NotificationLabel({
        notifications: [],
        isActive: true
      });
    }

    notificationDoc.isActive = !notificationDoc.isActive;
    await notificationDoc.save();

    return res.status(200).json({
      success: true,
      message: `Notifications section ${notificationDoc.isActive ? 'enabled' : 'disabled'}`,
      data: {
        isActive: notificationDoc.isActive,
        notifications: notificationDoc.notifications,
        count: notificationDoc.notifications.length
      }
    });

  } catch (error) {
    console.error('toggleSection error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin: Clear all notifications
export const clearAllNotifications = async (req, res) => {
  try {
    const notificationDoc = await NotificationLabel.findOne();
    
    if (!notificationDoc) {
      return res.status(404).json({
        success: false,
        message: 'No notifications found'
      });
    }

    notificationDoc.notifications = [];
    await notificationDoc.save();

    return res.status(200).json({
      success: true,
      message: 'All notifications cleared successfully',
      data: {
        notifications: [],
        count: 0
      }
    });

  } catch (error) {
    console.error('clearAllNotifications error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ======================= Designer Products ====================

// Get all designer products (with filters)
export const getAllDesignerProducts = async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 20, 
      search,
      designerId,
      sortBy = 'newest'
    } = req.query;
    
    let query = { createdBy: 'designer' };
    
    // Filter by approval status
    if (status === 'pending') query.approvalStatus = 'pending';
    if (status === 'approved') query.approvalStatus = 'approved';
    if (status === 'rejected') query.approvalStatus = 'rejected';
    if (status === 'active') query.isActive = true;
    
    // Filter by specific designer
    if (designerId) {
      query.creatorId = designerId;
    }
    
    // Search by product name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'newest') sort.createdAt = -1;
    if (sortBy === 'oldest') sort.createdAt = 1;
    if (sortBy === 'price_asc') sort.displayPrice = 1;
    if (sortBy === 'price_desc') sort.displayPrice = -1;
    
    const products = await Product.find(query)
      .populate('creatorId', 'name email mobile profileImage')
      .populate('categoryId', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Product.countDocuments(query);
    
    // Get statistics
    const stats = {
      total: await Product.countDocuments({ createdBy: 'designer' }),
      pending: await Product.countDocuments({ createdBy: 'designer', approvalStatus: 'pending' }),
      approved: await Product.countDocuments({ createdBy: 'designer', approvalStatus: 'approved' }),
      rejected: await Product.countDocuments({ createdBy: 'designer', approvalStatus: 'rejected' }),
      active: await Product.countDocuments({ createdBy: 'designer', isActive: true })
    };
    
    // Transform products for response
    const transformedProducts = products.map(product => {
      const productObj = product.toObject();
      const firstVariant = productObj.variants?.[0];
      const mainImage = firstVariant?.images?.[0] || productObj.mainImages?.[0] || null;
      
      return {
        _id: productObj._id,
        name: productObj.name,
        description: productObj.description,
        displayPrice: productObj.displayPrice,
        displayActualPrice: productObj.displayActualPrice,
        maxDiscount: productObj.maxDiscount,
        mainImage: mainImage,
        approvalStatus: productObj.approvalStatus,
        isActive: productObj.isActive,
        rejectionReason: productObj.rejectionReason,
        creator: productObj.creatorId,
        category: productObj.categoryId,
        variantsCount: productObj.variants?.length || 0,
        createdAt: productObj.createdAt,
        updatedAt: productObj.updatedAt
      };
    });
    
    return res.status(200).json({
      success: true,
      count: transformedProducts.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      stats,
      products: transformedProducts
    });
    
  } catch (error) {
    console.error('getAllDesignerProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single designer product by ID
export const getDesignerProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findOne({ 
      _id: productId,
      createdBy: 'designer'
    })
      .populate('creatorId', 'name email mobile profileImage about brandName')
      .populate('categoryId', 'name')
      .populate('subcategoryId');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Designer product not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      product
    });
    
  } catch (error) {
    console.error('getDesignerProductById error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPendingDesignerProducts = async (req, res) => {
  try {
    const { 
      page = 1, limit = 20, search, designerId, categoryId, 
      subcategoryId, minPrice, maxPrice, sortBy = 'newest', 
      fromDate, toDate 
    } = req.query;

    const query = { createdBy: 'designer', approvalStatus: 'pending' };
    
    if (designerId) query.creatorId = designerId;
    if (categoryId) query.categoryId = categoryId;
    if (subcategoryId) query.subcategoryId = subcategoryId;
    if (minPrice || maxPrice) {
      query.displayPrice = {};
      if (minPrice) query.displayPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.displayPrice.$lte = parseFloat(maxPrice);
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      price_asc: { displayPrice: 1 },
      price_desc: { displayPrice: -1 },
      waiting_asc: { createdAt: 1 },
      waiting_desc: { createdAt: -1 }
    };
    const sort = sortMap[sortBy] || sortMap.newest;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('creatorId', 'name email mobile profileImage brandName isVerified')
        .populate('categoryId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(query)
    ]);

    const transformedProducts = products.map(p => {
      const obj = p.toObject();
      const firstVariant = obj.variants?.[0];
      const mainImage = firstVariant?.images?.[0] || obj.mainImages?.[0] || null;
      const colors = [...new Set(obj.variants?.map(v => v.color) || [])];
      const sizes = [];
      obj.variants?.forEach(v => v.sizes?.forEach(s => { if (!sizes.includes(s.size)) sizes.push(s.size); }));

      const waitingHours = Math.floor((Date.now() - new Date(obj.createdAt)) / (1000 * 60 * 60));
      const waitingDays = Math.floor(waitingHours / 24);
      const waitingDisplay = waitingDays > 0 ? `${waitingDays} day${waitingDays > 1 ? 's' : ''}` : `${waitingHours} hour${waitingHours > 1 ? 's' : ''}`;

      return {
        _id: obj._id,
        name: obj.name,
        description: obj.description,
        displayPrice: obj.displayPrice,
        displayActualPrice: obj.displayActualPrice,
        maxDiscount: obj.maxDiscount,
        mainImage,
        colors,
        sizes,
        variantsCount: obj.variants?.length || 0,
        totalStock: obj.totalStock || 0,
        approvalStatus: obj.approvalStatus,
        isActive: obj.isActive,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        waitingTime: waitingDisplay,
        waitingHours,
        creator: obj.creatorId ? {
          id: obj.creatorId._id,
          name: obj.creatorId.name,
          email: obj.creatorId.email,
          mobile: obj.creatorId.mobile,
          profileImage: obj.creatorId.profileImage,
          brandName: obj.creatorId.brandName || obj.creatorId.name,
          isVerified: obj.creatorId.isVerified || false
        } : null,
        category: obj.categoryId ? { id: obj.categoryId._id, name: obj.categoryId.name } : null,
        subcategoryName: obj.subcategoryName || null,
        subcategoryId: obj.subcategoryId || null,
        tags: obj.tags || [],
        deliveryAddresses: obj.deliveryAddresses || [],
        variants: obj.variants?.map(v => ({
          color: v.color,
          price: v.price,
          discountPrice: v.discountPrice,
          sizes: v.sizes?.map(s => s.size) || [],
          imagesCount: v.images?.length || 0
        })) || []
      };
    });

    const stats = {
      totalPending: await Product.countDocuments({ createdBy: 'designer', approvalStatus: 'pending' }),
      totalDesigners: await User.countDocuments({ role: 'Designer' }),
      designersWithPending: await Product.distinct('creatorId', { createdBy: 'designer', approvalStatus: 'pending' }).then(ids => ids.length),
      oldestPending: await Product.findOne({ createdBy: 'designer', approvalStatus: 'pending' }).sort({ createdAt: 1 }).select('createdAt name'),
      newestPending: await Product.findOne({ createdBy: 'designer', approvalStatus: 'pending' }).sort({ createdAt: -1 }).select('createdAt name'),
      categoriesWithPending: await Product.distinct('categoryId', { createdBy: 'designer', approvalStatus: 'pending' }).then(ids => ids.length)
    };

    let designerDetails = null;
    if (designerId) {
      designerDetails = await User.findById(designerId)
        .select('name email mobile profileImage brandName isVerified')
        .lean();
    }

    return res.status(200).json({
      success: true,
      count: transformedProducts.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      filters: { designerId: designerId || null, categoryId: categoryId || null, subcategoryId: subcategoryId || null, search: search || null, minPrice: minPrice || null, maxPrice: maxPrice || null, fromDate: fromDate || null, toDate: toDate || null, sortBy },
      designer: designerDetails,
      stats: {
        ...stats,
        oldestWaiting: stats.oldestPending ? Math.floor((Date.now() - new Date(stats.oldestPending.createdAt)) / (1000 * 60 * 60 * 24)) + ' days' : 'N/A'
      },
      products: transformedProducts
    });

  } catch (error) {
    console.error('getPendingDesignerProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk approve designer products
export const bulkApproveProducts = async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }
    
    const result = await Product.updateMany(
      { 
        _id: { $in: productIds },
        createdBy: 'designer',
        approvalStatus: { $ne: 'approved' }
      },
      {
        $set: {
          approvalStatus: 'approved',
          isActive: true,
          rejectionReason: null,
          approvedAt: new Date(),
          approvedBy: req.user.id
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} product(s) approved successfully`,
      modifiedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('bulkApproveProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk reject designer products
export const bulkRejectProducts = async (req, res) => {
  try {
    const { productIds, rejectionReason } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      });
    }
    
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required for bulk reject'
      });
    }
    
    const result = await Product.updateMany(
      { 
        _id: { $in: productIds },
        createdBy: 'designer',
        approvalStatus: { $ne: 'approved' }
      },
      {
        $set: {
          approvalStatus: 'rejected',
          isActive: false,
          rejectionReason: rejectionReason,
          rejectedAt: new Date(),
          rejectedBy: req.user.id
        }
      }
    );
    
    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} product(s) rejected successfully`,
      modifiedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('bulkRejectProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get all designers (for filtering)
// export const getAllDesigners = async (req, res) => {
//   try {
//     const designers = await User.find({ role: 'Designer' })
//       .select('_id name email mobile profileImage isActive createdAt')
//       .sort({ createdAt: -1 });
    
//     // Get product counts for each designer
//     const designersWithStats = await Promise.all(designers.map(async (designer) => {
//       const productStats = {
//         total: await Product.countDocuments({ creatorId: designer._id, createdBy: 'designer' }),
//         pending: await Product.countDocuments({ creatorId: designer._id, approvalStatus: 'pending' }),
//         approved: await Product.countDocuments({ creatorId: designer._id, approvalStatus: 'approved' }),
//         rejected: await Product.countDocuments({ creatorId: designer._id, approvalStatus: 'rejected' })
//       };
      
//       return {
//         ...designer.toObject(),
//         productStats
//       };
//     }));
    
//     return res.status(200).json({
//       success: true,
//       count: designersWithStats.length,
//       designers: designersWithStats
//     });
    
//   } catch (error) {
//     console.error('getAllDesigners error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

export const getAllDesigners = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search, sortBy = 'newest' } = req.query;

    // Build query
    const query = {};
    
    // Filter by status
    if (status === 'approved') query.isApproved = true;
    else if (status === 'pending') query.isApproved = false;
    else if (status === 'active') query.isActive = true;
    else if (status === 'inactive') query.isActive = false;

    // Search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { brandName: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    let sort = {};
    switch (sortBy) {
      case 'newest':
        sort.createdAt = -1;
        break;
      case 'oldest':
        sort.createdAt = 1;
        break;
      case 'name_asc':
        sort.name = 1;
        break;
      case 'name_desc':
        sort.name = -1;
        break;
      case 'products_asc':
        sort.totalProductsAdded = 1;
        break;
      case 'products_desc':
        sort.totalProductsAdded = -1;
        break;
      default:
        sort.createdAt = -1;
    }

    // Get designers with all details
    const designers = await Designer.find(query)
      .select('-otp -otpExpires -authToken -authTokenExpires')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Designer.countDocuments(query);

    // Get stats for each designer
    const designersWithStats = await Promise.all(designers.map(async (designer) => {
      // Product statistics
      const productStats = {
        total: await Product.countDocuments({ 
          creatorId: designer._id, 
          createdBy: 'designer' 
        }),
        pending: await Product.countDocuments({ 
          creatorId: designer._id, 
          approvalStatus: 'pending' 
        }),
        approved: await Product.countDocuments({ 
          creatorId: designer._id, 
          approvalStatus: 'approved' 
        }),
        rejected: await Product.countDocuments({ 
          creatorId: designer._id, 
          approvalStatus: 'rejected' 
        }),
        active: await Product.countDocuments({ 
          creatorId: designer._id, 
          isActive: true 
        })
      };

      // Get designer's products for order calculation
      const designerProducts = await Product.find({ 
        creatorId: designer._id 
      }).select('_id');
      const productIds = designerProducts.map(p => p._id);

      // Get orders containing designer's products
      const orders = await Order.find({
        'items.productId': { $in: productIds }
      });

      // Calculate sales
      let totalSales = 0;
      let totalOrders = orders.length;
      let totalItemsSold = 0;

      orders.forEach(order => {
        order.items.forEach(item => {
          if (productIds.some(id => id.toString() === item.productId.toString())) {
            totalSales += item.price * item.quantity;
            totalItemsSold += item.quantity;
          }
        });
      });

      // Get wallet transactions
      const transactions = designer.wallet?.transactions || [];
      const totalCredits = transactions
        .filter(t => t.type === 'credit' || t.type === 'refund' || t.type === 'cashback')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalDebits = transactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);

      // Get recent transactions (last 5)
      const recentTransactions = [...transactions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      // Get recent products (last 5)
      const recentProducts = await Product.find({ 
        creatorId: designer._id,
        createdBy: 'designer' 
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name displayPrice approvalStatus isActive createdAt');

      return {
        _id: designer._id,
        name: designer.name,
        email: designer.email,
        mobile: designer.mobile,
        brandName: designer.brandName,
        about: designer.about,
        profileImage: designer.profileImage,
        isVerified: designer.isVerified,
        isActive: designer.isActive,
        isApproved: designer.isApproved,
        rejectionReason: designer.rejectionReason,
        createdAt: designer.createdAt,
        updatedAt: designer.updatedAt,
        
        // Product Stats
        productStats,
        totalProductsAdded: designer.totalProductsAdded || 0,
        totalProductsSold: designer.totalProductsSold || 0,
        
        // Wallet
        wallet: {
          balance: designer.wallet?.balance || 0,
          isActive: designer.wallet?.isActive !== undefined ? designer.wallet.isActive : true,
          totalCredits,
          totalDebits,
          netBalance: totalCredits - totalDebits,
          transactionCount: transactions.length,
          recentTransactions: recentTransactions,
          productFeePaid: designer.productFeePaid || 0,
          cashbackReceived: designer.cashbackReceived || 0
        },
        
        // Sales
        sales: {
          totalOrders,
          totalItemsSold,
          totalSales
        },
        
        // Recent Products
        recentProducts,
        
        // Status
        status: designer.isApproved ? 'approved' : 'pending'
      };
    }));

    // Get overall statistics
    const overallStats = {
      totalDesigners: await Designer.countDocuments(),
      pendingApproval: await Designer.countDocuments({ isApproved: false }),
      approved: await Designer.countDocuments({ isApproved: true }),
      active: await Designer.countDocuments({ isActive: true }),
      totalProducts: await Product.countDocuments({ createdBy: 'designer' }),
      totalSales: await Order.countDocuments({
        'items.productId': { $in: await Product.find({ createdBy: 'designer' }).distinct('_id') }
      })
    };

    return res.status(200).json({
      success: true,
      count: designersWithStats.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      stats: overallStats,
      designers: designersWithStats
    });

  } catch (error) {
    console.error('getAllDesigners error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET PENDING DESIGNERS ====================

export const getPendingDesigners = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const query = { isApproved: false };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { brandName: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const designers = await Designer.find(query)
      .select('-otp -otpExpires -authToken -authTokenExpires')
      .sort({ createdAt: 1 }) // Oldest first (waiting longest)
      .skip(skip)
      .limit(limitNum);

    const total = await Designer.countDocuments(query);

    // Get stats for each pending designer
    const designersWithStats = await Promise.all(designers.map(async (designer) => {
      const productStats = {
        total: await Product.countDocuments({ 
          creatorId: designer._id, 
          createdBy: 'designer' 
        }),
        pending: await Product.countDocuments({ 
          creatorId: designer._id, 
          approvalStatus: 'pending' 
        }),
        approved: await Product.countDocuments({ 
          creatorId: designer._id, 
          approvalStatus: 'approved' 
        }),
        rejected: await Product.countDocuments({ 
          creatorId: designer._id, 
          approvalStatus: 'rejected' 
        })
      };

      // Calculate waiting time
      const waitingDays = Math.floor((Date.now() - new Date(designer.createdAt)) / (1000 * 60 * 60 * 24));

      return {
        _id: designer._id,
        name: designer.name,
        email: designer.email,
        mobile: designer.mobile,
        brandName: designer.brandName,
        about: designer.about,
        profileImage: designer.profileImage,
        isVerified: designer.isVerified,
        isActive: designer.isActive,
        isApproved: designer.isApproved,
        rejectionReason: designer.rejectionReason,
        createdAt: designer.createdAt,
        updatedAt: designer.updatedAt,
        waitingDays,
        productStats,
        walletBalance: designer.wallet?.balance || 0
      };
    }));

    return res.status(200).json({
      success: true,
      count: designersWithStats.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      pendingDesigners: designersWithStats
    });

  } catch (error) {
    console.error('getPendingDesigners error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get designer settings (Both Admin & Designer can view)
export const getDesignerSettings = async (req, res) => {
  try {
    let settings = await DesignerSettings.findOne();
    
    if (!settings) {
      settings = await DesignerSettings.create({
        productFee: 500,
        cashbackPercentage: 60,
        salesThresholdForCashback: 100
      });
    }

    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('getDesignerSettings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDesignerSettings = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admin can update designer settings.'
      });
    }

    const { productFee, cashbackPercentage, salesThresholdForCashback } = req.body;
    
    let settings = await DesignerSettings.findOne();
    
    if (!settings) {
      settings = new DesignerSettings();
    }

    if (productFee !== undefined) settings.productFee = productFee;
    if (cashbackPercentage !== undefined) settings.cashbackPercentage = cashbackPercentage;
    if (salesThresholdForCashback !== undefined) settings.salesThresholdForCashback = salesThresholdForCashback;
    
    settings.updatedBy = req.user.id;
    settings.updatedAt = new Date();
    
    await settings.save();

    return res.status(200).json({
      success: true,
      message: 'Designer settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('updateDesignerSettings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Approve designer
export const approveDesigner = async (req, res) => {
  try {
    const { designerId } = req.params;

    const designer = await Designer.findById(designerId);
    if (!designer) {
      return res.status(404).json({ success: false, message: 'Designer not found' });
    }

    if (designer.isApproved) {
      return res.status(400).json({ success: false, message: 'Designer is already approved' });
    }

    designer.isApproved = true;
    designer.rejectionReason = null;
    await designer.save();

    return res.status(200).json({
      success: true,
      message: 'Designer approved successfully',
      data: designer
    });

  } catch (error) {
    console.error('approveDesigner error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// Reject designer
export const rejectDesigner = async (req, res) => {
  try {
    const { designerId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const designer = await Designer.findById(designerId);
    if (!designer) {
      return res.status(404).json({ success: false, message: 'Designer not found' });
    }

    designer.isApproved = false;
    designer.rejectionReason = rejectionReason;
    await designer.save();

    return res.status(200).json({
      success: true,
      message: 'Designer rejected successfully',
      data: designer
    });

  } catch (error) {
    console.error('rejectDesigner error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single designer details
// export const getDesignerDetails = async (req, res) => {
//   try {
//     const { designerId } = req.params;

//     const designer = await Designer.findById(designerId)
//       .select('-otp -otpExpires -authToken -authTokenExpires');

//     if (!designer) {
//       return res.status(404).json({ success: false, message: 'Designer not found' });
//     }

//     const products = await Product.find({ 
//       creatorId: designerId,
//       createdBy: 'designer'
//     }).sort({ createdAt: -1 });

//     const stats = {
//       totalProducts: products.length,
//       pending: products.filter(p => p.approvalStatus === 'pending').length,
//       approved: products.filter(p => p.approvalStatus === 'approved').length,
//       rejected: products.filter(p => p.approvalStatus === 'rejected').length,
//       active: products.filter(p => p.isActive === true).length
//     };

//     return res.status(200).json({
//       success: true,
//       designer: {
//         ...designer.toObject(),
//         walletBalance: designer.wallet?.balance || 0
//       },
//       stats,
//       products
//     });

//   } catch (error) {
//     console.error('getDesignerDetails error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

export const getDesignerDetails = async (req, res) => {
  try {
    const { designerId } = req.params;

    const designer = await Designer.findById(designerId)
      .select('-otp -otpExpires -authToken -authTokenExpires');

    if (!designer) {
      return res.status(404).json({ success: false, message: 'Designer not found' });
    }

    // ==================== PRODUCTS WITH DETAILS ====================
    const products = await Product.find({ 
      creatorId: designerId,
      createdBy: 'designer'
    }).sort({ createdAt: -1 });

    // Product statistics
    const stats = {
      totalProducts: products.length,
      pending: products.filter(p => p.approvalStatus === 'pending').length,
      approved: products.filter(p => p.approvalStatus === 'approved').length,
      rejected: products.filter(p => p.approvalStatus === 'rejected').length,
      active: products.filter(p => p.isActive === true).length
    };

    // Transform products with main images
    const transformedProducts = products.map(product => {
      const productObj = product.toObject();
      
      // Get main image from first variant
      const firstVariant = productObj.variants?.[0];
      const mainImage = firstVariant?.images?.[0] || productObj.mainImages?.[0] || null;
      
      // Extract all colors from variants
      const colors = [...new Set(productObj.variants?.map(v => v.color) || [])];
      
      // Extract all sizes from variants
      const sizes = [];
      productObj.variants?.forEach(variant => {
        variant.sizes?.forEach(size => {
          if (!sizes.includes(size.size)) {
            sizes.push(size.size);
          }
        });
      });

      return {
        _id: productObj._id,
        name: productObj.name,
        description: productObj.description,
        displayPrice: productObj.displayPrice,
        displayActualPrice: productObj.displayActualPrice,
        maxDiscount: productObj.maxDiscount,
        mainImage: mainImage,
        colors: colors,
        sizes: sizes,
        variantsCount: productObj.variants?.length || 0,
        totalStock: productObj.totalStock || 0,
        approvalStatus: productObj.approvalStatus,
        isActive: productObj.isActive,
        rejectionReason: productObj.rejectionReason,
        createdAt: productObj.createdAt,
        updatedAt: productObj.updatedAt
      };
    });

    // ==================== WALLET DETAILS ====================
    const transactions = designer.wallet?.transactions || [];
    const totalCredits = transactions
      .filter(t => t.type === 'credit' || t.type === 'refund' || t.type === 'cashback')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalDebits = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    // Recent transactions (last 10)
    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // ==================== SALES & ORDERS ====================
    const designerProducts = await Product.find({ 
      creatorId: designerId 
    }).select('_id');
    const productIds = designerProducts.map(p => p._id);

    const orders = await Order.find({
      'items.productId': { $in: productIds }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('userId', 'name email mobile');

    let totalSales = 0;
    let totalOrders = orders.length;
    let totalItemsSold = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        if (productIds.some(id => id.toString() === item.productId.toString())) {
          totalSales += item.price * item.quantity;
          totalItemsSold += item.quantity;
        }
      });
    });

    // ==================== RESPONSE ====================
    return res.status(200).json({
      success: true,
      data: {
        // Designer Profile
        designer: {
          _id: designer._id,
          name: designer.name,
          email: designer.email,
          mobile: designer.mobile,
          brandName: designer.brandName,
          about: designer.about,
          profileImage: designer.profileImage,
          isVerified: designer.isVerified,
          isActive: designer.isActive,
          isApproved: designer.isApproved,
          rejectionReason: designer.rejectionReason,
          createdAt: designer.createdAt,
          updatedAt: designer.updatedAt
        },
        
        // Wallet
        wallet: {
          balance: designer.wallet?.balance || 0,
          isActive: designer.wallet?.isActive !== undefined ? designer.wallet.isActive : true,
          totalCredits: totalCredits,
          totalDebits: totalDebits,
          netBalance: totalCredits - totalDebits,
          transactionCount: transactions.length,
          productFeePaid: designer.productFeePaid || 0,
          cashbackReceived: designer.cashbackReceived || 0,
          recentTransactions: recentTransactions.map(t => ({
            id: t._id,
            type: t.type,
            amount: t.amount,
            description: t.description,
            referenceId: t.referenceId,
            referenceType: t.referenceType,
            status: t.status,
            balance: t.balance,
            createdAt: t.createdAt
          }))
        },
        
        // Products
        products: {
          stats: stats,
          data: transformedProducts,
          recent: transformedProducts.slice(0, 5)
        },
        
        // Sales Summary
        sales: {
          totalOrders: await Order.countDocuments({
            'items.productId': { $in: productIds }
          }),
          totalItemsSold: totalItemsSold,
          totalSales: totalSales,
          recentOrders: orders.map(order => ({
            _id: order._id,
            orderId: order.orderId,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            finalAmount: order.finalAmount,
            customer: order.userId,
            createdAt: order.createdAt
          }))
        }
      }
    });

  } catch (error) {
    console.error('getDesignerDetails error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete designer product (admin forced delete)
export const adminDeleteDesignerProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findOne({ 
      _id: productId,
      createdBy: 'designer'
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Designer product not found'
      });
    }
    
    // Delete variant images
    if (product.variants && product.variants.length) {
      product.variants.forEach(variant => {
        if (variant.images && variant.images.length) {
          variant.images.forEach(image => {
            if (!image.startsWith('http')) {
              deleteFile(image);
            }
          });
        }
      });
    }
    
    // Delete size guide videos
    if (product.sizeGuide && product.sizeGuide.length) {
      product.sizeGuide.forEach(video => {
        if (!video.startsWith('http')) {
          deleteFile(video);
        }
      });
    }
    
    await Product.findByIdAndDelete(productId);
    
    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
    
  } catch (error) {
    console.error('adminDeleteDesignerProduct error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Add money to designer wallet
export const adminAddMoneyToDesigner = async (req, res) => {
  try {
    const { designerId } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const designer = await Designer.findById(designerId);
    if (!designer) {
      return res.status(404).json({ success: false, message: 'Designer not found' });
    }

    if (designer.wallet.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Wallet is currently inactive'
      });
    }

    const newBalance = designer.wallet.balance + amount;

    designer.wallet.transactions.push({
      type: 'credit',
      amount: amount,
      description: description || `Admin added ₹${amount} to wallet`,
      referenceType: 'admin',
      status: 'completed',
      balance: newBalance
    });

    designer.wallet.balance = newBalance;
    await designer.save();

    return res.status(200).json({
      success: true,
      message: `₹${amount} added to designer's wallet`,
      data: {
        balance: designer.wallet.balance
      }
    });

  } catch (error) {
    console.error('adminAddMoneyToDesigner error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Deduct money from designer wallet
export const adminDeductMoneyFromDesigner = async (req, res) => {
  try {
    const { designerId } = req.params;
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const designer = await Designer.findById(designerId);
    if (!designer) {
      return res.status(404).json({ success: false, message: 'Designer not found' });
    }

    if (designer.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        data: { available: designer.wallet.balance }
      });
    }

    if (designer.wallet.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Wallet is currently inactive'
      });
    }

    const newBalance = designer.wallet.balance - amount;

    designer.wallet.transactions.push({
      type: 'debit',
      amount: amount,
      description: description || `Admin deducted ₹${amount} from wallet`,
      referenceType: 'admin',
      status: 'completed',
      balance: newBalance
    });

    designer.wallet.balance = newBalance;
    await designer.save();

    return res.status(200).json({
      success: true,
      message: `₹${amount} deducted from designer's wallet`,
      data: {
        balance: designer.wallet.balance
      }
    });

  } catch (error) {
    console.error('adminDeductMoneyFromDesigner error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get designer wallet
export const getDesignerWallet = async (req, res) => {
  try {
    const { designerId } = req.params;

    const designer = await Designer.findById(designerId).select('wallet name email');
    if (!designer) {
      return res.status(404).json({ success: false, message: 'Designer not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        designer: {
          id: designer._id,
          name: designer.name,
          email: designer.email
        },
        wallet: designer.wallet || { balance: 0, transactions: [], isActive: true }
      }
    });

  } catch (error) {
    console.error('getDesignerWallet error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ==================== GET USER WALLET BALANCE ====================

/**
 * Get specific user's wallet balance
 * GET /api/admin/wallet/:userId
 */
export const getUserWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('wallet name email mobile');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const transactions = user.wallet.transactions || [];
    const totalCredits = transactions
      .filter(t => t.type === 'credit' || t.type === 'refund' || t.type === 'cashback')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalDebits = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile
        },
        wallet: {
          balance: user.wallet.balance || 0,
          isActive: user.wallet.isActive !== undefined ? user.wallet.isActive : true,
          totalCredits: totalCredits,
          totalDebits: totalDebits,
          transactionCount: transactions.length,
          lastUpdated: user.wallet.updatedAt || user.updatedAt
        }
      }
    });
    
  } catch (error) {
    console.error('getUserWallet error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== GET USER TRANSACTION HISTORY ====================

/**
 * Get user's transaction history with pagination
 * GET /api/admin/wallet/:userId/transactions
 */
export const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;
    
    const user = await User.findById(userId).select('wallet name');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    let transactions = user.wallet.transactions || [];
    
    // Filter by type
    if (type && ['credit', 'debit', 'refund', 'cashback'].includes(type)) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    // Sort by newest first
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = transactions.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginated = transactions.slice(skip, skip + parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name
        },
        transactions: paginated.map(t => ({
          id: t._id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          referenceId: t.referenceId,
          referenceType: t.referenceType,
          status: t.status,
          balance: t.balance,
          createdAt: t.createdAt
        })),
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    console.error('getUserTransactions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ADMIN ADD MONEY ====================

/**
 * Admin adds money to user's wallet
 * POST /api/admin/wallet/:userId/add-money
 */
export const adminAddMoney = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, description, reason } = req.body;
    
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
      description: description || `Admin added ₹${amount}${reason ? ' - ' + reason : ''}`,
      referenceType: 'admin',
      status: 'completed',
      balance: newBalance
    };
    
    user.wallet.transactions.push(transaction);
    user.wallet.balance = newBalance;
    user.wallet.updatedAt = new Date();
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: `₹${amount} added to ${user.name}'s wallet successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name
        },
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
    console.error('adminAddMoney error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ADMIN DEDUCT MONEY ====================

/**
 * Admin deducts money from user's wallet
 * POST /api/admin/wallet/:userId/deduct
 */
export const adminDeductMoney = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, description, reason } = req.body;
    
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
    
    if (user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        data: { 
          available: user.wallet.balance,
          required: amount
        }
      });
    }
    
    if (user.wallet.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Wallet is currently inactive'
      });
    }
    
    const newBalance = user.wallet.balance - amount;
    
    const transaction = {
      type: 'debit',
      amount: amount,
      description: description || `Admin deducted ₹${amount}${reason ? ' - ' + reason : ''}`,
      referenceType: 'admin',
      status: 'completed',
      balance: newBalance
    };
    
    user.wallet.transactions.push(transaction);
    user.wallet.balance = newBalance;
    user.wallet.updatedAt = new Date();
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: `₹${amount} deducted from ${user.name}'s wallet`,
      data: {
        user: {
          id: user._id,
          name: user.name
        },
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
    console.error('adminDeductMoney error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ADMIN REFUND TO WALLET ====================

/**
 * Admin refunds to user's wallet
 * POST /api/admin/wallet/:userId/refund
 */
export const adminRefundWallet = async (req, res) => {
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
    
    const newBalance = user.wallet.balance + amount;
    
    const transaction = {
      type: 'refund',
      amount: amount,
      description: description || `Refund for order ${orderId || ''}`,
      referenceId: orderId || null,
      referenceType: 'refund',
      status: 'completed',
      balance: newBalance
    };
    
    user.wallet.transactions.push(transaction);
    user.wallet.balance = newBalance;
    user.wallet.updatedAt = new Date();
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: `₹${amount} refunded to ${user.name}'s wallet`,
      data: {
        user: {
          id: user._id,
          name: user.name
        },
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
    console.error('adminRefundWallet error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ==================== GET ALL STYLIST BOOKINGS ====================

export const getAllStylistBookings = async (req, res) => {
  try {
    const { status, stylistId, userId, date, fromDate, toDate, search, page = 1, limit = 20, sortBy = 'newest' } = req.query;

    const query = {};
    if (status && ['pending','accepted','rejected','cancelled','completed'].includes(status)) query.status = status;
    if (stylistId) query.stylistId = stylistId;
    if (userId) query.userId = userId;
    if (date) query.date = date;
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { reasonForBooking: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const sortMap = { newest: -1, oldest: 1, date_asc: 1, date_desc: -1, amount_asc: 1, amount_desc: -1 };
    const sort = { createdAt: sortMap[sortBy] || -1 };
    if (sortBy === 'date_asc' || sortBy === 'date_desc') sort.date = sortMap[sortBy];
    if (sortBy === 'amount_asc' || sortBy === 'amount_desc') sort.amount = sortMap[sortBy];

    const [bookings, total, stats, revenueStats] = await Promise.all([
      StylistBooking.find(query)
        .populate('userId', 'name email mobile profileImage')
        .populate('stylistId', 'name email mobile profileImage')
        .sort(sort).skip(skip).limit(limitNum),
      StylistBooking.countDocuments(query),
      StylistBooking.aggregate([
        { $facet: {
          total: [{ $count: 'count' }],
          pending: [{ $match: { status: 'pending' } }, { $count: 'count' }],
          accepted: [{ $match: { status: 'accepted' } }, { $count: 'count' }],
          rejected: [{ $match: { status: 'rejected' } }, { $count: 'count' }],
          completed: [{ $match: { status: 'completed' } }, { $count: 'count' }],
          cancelled: [{ $match: { status: 'cancelled' } }, { $count: 'count' }]
        }}
      ]),
      StylistBooking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' }, avgRevenue: { $avg: '$amount' }, count: { $sum: 1 } } }
      ])
    ]);

    const statsObj = { total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0, cancelled: 0 };
    stats[0]?.total?.[0] && (statsObj.total = stats[0].total[0].count);
    stats[0]?.pending?.[0] && (statsObj.pending = stats[0].pending[0].count);
    stats[0]?.accepted?.[0] && (statsObj.accepted = stats[0].accepted[0].count);
    stats[0]?.rejected?.[0] && (statsObj.rejected = stats[0].rejected[0].count);
    stats[0]?.completed?.[0] && (statsObj.completed = stats[0].completed[0].count);
    stats[0]?.cancelled?.[0] && (statsObj.cancelled = stats[0].cancelled[0].count);

    const revenue = revenueStats[0] || { totalRevenue: 0, avgRevenue: 0, count: 0 };

    return res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      filters: { status: status || 'all', stylistId: stylistId || 'all', userId: userId || 'all', date: date || 'all', fromDate: fromDate || null, toDate: toDate || null, search: search || null },
      stats: { ...statsObj, revenue: { totalRevenue: revenue.totalRevenue, averageRevenue: revenue.avgRevenue || 0, count: revenue.count } },
      stylistBookings: bookings
    });

  } catch (error) {
    console.error('getAllStylistBookings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== GET SINGLE STYLIST BOOKING (ADMIN) ====================

export const getStylistBookingByIdAdmin = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await StylistBooking.findById(bookingId)
      .populate('userId', 'name email mobile profileImage')
      .populate('stylistId', 'name email mobile profileImage');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Stylist booking not found' });
    }

    return res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('getStylistBookingByIdAdmin error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== UPDATE STYLIST BOOKING (ADMIN) ====================

export const updateStylistBookingAdmin = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, amount, paymentStatus, stylistId } = req.body;

    const booking = await StylistBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Stylist booking not found' });
    }

    // Admin can update even accepted bookings
    if (status) booking.status = status;
    if (amount) booking.amount = amount;
    if (paymentStatus) booking.paymentStatus = paymentStatus;
    
    if (stylistId) {
      const stylist = await User.findById(stylistId);
      if (!stylist || stylist.role !== 'Stylist') {
        return res.status(404).json({ success: false, message: 'Stylist not found' });
      }
      booking.stylistId = stylistId;
    }

    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Stylist booking updated successfully',
      data: booking
    });

  } catch (error) {
    console.error('updateStylistBookingAdmin error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DELETE STYLIST BOOKING (ADMIN) ====================

export const deleteStylistBookingAdmin = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await StylistBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Stylist booking not found' });
    }

    await StylistBooking.findByIdAndDelete(bookingId);

    return res.status(200).json({
      success: true,
      message: 'Stylist booking deleted successfully'
    });

  } catch (error) {
    console.error('deleteStylistBookingAdmin error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};