import Admin from '../Models/Admin.js';
import LoginScreenMedia from '../Models/LoginScreenMedia.js';
import HomePage from '../Models/HomePage.js';
import User from '../Models/User.js';
import Collection from '../Models/Collection.js';
import Product from '../Models/Product.js';
import RecommendedProduct from '../Models/RecommendedProducts.js';
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


// // ==================== PRODUCT MANAGEMENT ====================
// export const createProduct = async (req, res) => {
//   try {
//     const {
//       name,
//       description,
//       categoryId,
//       subcategoryId,
//       variants,
//       deliveryAddresses,
//       tags
//     } = req.body;

//     const userId = req.user.id;
//     const userRole = req.user.role;

//     // Validate role
//     if (!['admin', 'designer', 'tailor'].includes(userRole)) {
//       return res.status(403).json({
//         success: false,
//         message: 'Only Admin, Designer, or Tailor can create products'
//       });
//     }

//     // Validate required fields
//     if (!name || !description || !categoryId || !subcategoryId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: name, description, categoryId, subcategoryId'
//       });
//     }

//     // Validate variants
//     let variantsArray = [];
//     try {
//       variantsArray = typeof variants === 'string' ? JSON.parse(variants) : variants;
//     } catch (e) {
//       variantsArray = [];
//     }

//     if (!variantsArray.length) {
//       return res.status(400).json({
//         success: false,
//         message: 'At least one product variant is required'
//       });
//     }

//     // Validate category
//     const category = await Category.findById(categoryId);
//     if (!category) {
//       return res.status(404).json({
//         success: false,
//         message: 'Category not found'
//       });
//     }

//     const subcategory = category.subcategories.id(subcategoryId);
//     if (!subcategory) {
//       return res.status(404).json({
//         success: false,
//         message: 'Subcategory not found in this category'
//       });
//     }

//     // Get uploaded files
//     const imageFiles = req.files?.images || [];
//     const videoFiles = req.files?.videos || [];

//     if (!imageFiles.length) {
//       return res.status(400).json({
//         success: false,
//         message: 'At least one product image is required'
//       });
//     }

//     // Process variants with images
//     const processedVariants = variantsArray.map((variant, index) => {
//       const variantImages = imageFiles
//         .filter((_, i) => i % variantsArray.length === index)
//         .map(file => getFileUrl(req, path.basename(file.path), 'products'));

//       return {
//         color: variant.color,
//         size: variant.size,
//         actualPrice: parseFloat(variant.actualPrice),
//         discountPrice: variant.discountPrice ? parseFloat(variant.discountPrice) : null,
//         stock: parseInt(variant.stock) || 0,
//         images: variantImages,
//         isActive: true
//       };
//     });

//     const videoUrls = videoFiles.map(file => 
//       getFileUrl(req, path.basename(file.path), 'products')
//     );

//     let addressesArray = [];
//     if (deliveryAddresses) {
//       try {
//         addressesArray = typeof deliveryAddresses === 'string' ? JSON.parse(deliveryAddresses) : deliveryAddresses;
//       } catch (e) {}
//     }

//     let tagsArray = [];
//     if (tags) {
//       try {
//         tagsArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
//       } catch (e) {}
//     }

//     let creatorDetails = null;
//     if (userRole !== 'admin') {
//       const user = await User.findById(userId);
//       if (user) {
//         creatorDetails = {
//           name: user.name,
//           profileImage: user.profileImage || '',
//           role: userRole,
//           brandName: userRole === 'designer' ? user.name : undefined,
//           shopName: userRole === 'tailor' ? user.name : undefined
//         };
//       }
//     }

//     const product = new Product({
//       name,
//       description,
//       categoryId,
//       subcategoryId,
//       subcategoryName: subcategory.name,
//       variants: processedVariants,
//       deliveryAddresses: addressesArray,
//       sizeGuide: videoUrls,
//       tags: tagsArray,
//       createdBy: userRole,
//       creatorId: userId,
//       creatorDetails
//     });

//     await product.save();

//     return res.status(201).json({
//       success: true,
//       message: userRole === 'admin' ? 'Product created successfully' : 'Product submitted for admin approval',
//       product,
//       requiresApproval: userRole !== 'admin'
//     });

//   } catch (error) {
//     console.error('createProduct error:', error);
    
//     // Simple error response without cleanup
//     return res.status(500).json({
//       success: false,
//       message: error.message || 'Internal server error'
//     });
//   }
// };

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

    if (!['admin', 'designer', 'tailor'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only Admin, Designer, or Tailor can create products'
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
      limit = 20
    } = req.query;

    let query = {};

    // Apply filters
    if (categoryId) query.categoryId = categoryId;
    if (subcategoryId) query.subcategoryId = subcategoryId;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    // Price filter
    if (minPrice || maxPrice) {
      query.displayPrice = {};
      if (minPrice) query.displayPrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.displayPrice.$lte = parseFloat(maxPrice);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'price_asc') sort.displayPrice = 1;
    else if (sortBy === 'price_desc') sort.displayPrice = -1;
    else if (sortBy === 'rating_desc') sort.averageRating = -1;
    else if (sortBy === 'newest') sort.createdAt = -1;
    else sort.createdAt = -1;

    // Approval filter for public users
    if (!req.user || req.user.role !== 'admin') {
      query.approvalStatus = { $in: ['approved', 'not_required'] };
      query.isActive = true;
    }

    const products = await Product.find(query)
      .populate('categoryId', 'name')
      .sort(sort)
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

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, paymentStatus, trackingId, estimatedDelivery } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const oldStatus = order.orderStatus;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (orderStatus && !validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // ✅ Update individual item status when order status changes
    if (orderStatus) {
      order.orderStatus = orderStatus;
      
      // Update all items to the same status
      order.items.forEach(item => {
        item.status = orderStatus;
      });
    }
    
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingId) order.trackingId = trackingId;
    if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery);
    
    if (orderStatus === 'delivered') order.deliveredAt = new Date();
    if (orderStatus === 'cancelled') order.cancelledAt = new Date();

    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated from ${oldStatus} to ${order.orderStatus}`,
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        items: order.items.map(item => ({
          productId: item.productId,
          status: item.status  // Now shows correct status
        })),
        paymentStatus: order.paymentStatus,
        trackingId: order.trackingId,
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    console.error('updateOrderStatus error:', error);
    return res.status(500).json({ success: false, message: error.message });
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