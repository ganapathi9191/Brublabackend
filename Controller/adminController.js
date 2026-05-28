import Admin from '../Models/Admin.js';
import User from '../Models/User.js';
import Banner from '../Models/Banner.js';
import Category from '../Models/Category.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFileUrl, deleteFile } from '../utils/fileUtils.js';
import Product from '../Models/Product.js';
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

// Update Product By ID
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
    if (isActive !== undefined) product.isActive = isActive === 'true';

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

    // Update variants if provided
    if (variants) {
      try {
        let variantsArray = typeof variants === 'string' ? JSON.parse(variants) : variants;
        
        // Process new images if any
        if (imageFiles.length) {
          variantsArray = variantsArray.map((variant, index) => {
            const variantImages = imageFiles
              .filter((_, i) => i % variantsArray.length === index)
              .map(file => getFileUrl(req, path.basename(file.path), 'products'));
            
            return {
              ...variant,
              actualPrice: parseFloat(variant.actualPrice),
              discountPrice: variant.discountPrice ? parseFloat(variant.discountPrice) : null,
              stock: parseInt(variant.stock) || 0,
              images: variantImages.length ? variantImages : variant.images || [],
            };
          });
        }
        
        product.variants = variantsArray;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid variants format'
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
   console.log('=== DEBUG ===');
  console.log('req.files:', req.files);
  console.log('req.files?.images:', req.files?.images);
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
    
    variant.images.push(...imageUrls);
    
    if (!variant.mainImage && imageUrls.length) {
      variant.mainImage = imageUrls[0];
    }
    
    await product.save();
    
    return res.status(200).json({
      success: true,
      message: `${imageUrls.length} image(s) added`,
      variant: {
        id: variant._id,
        color: variant.color,
        size: variant.size,
        mainImage: variant.mainImage,
        images: variant.images
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
        size: variant.size,
        mainImage: variant.mainImage,
        images: variant.images,
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
    
    variant.mainImage = imageUrl;
    await product.save();
    
    return res.status(200).json({
      success: true,
      message: 'Main image updated successfully',
      variant: {
        id: variant._id,
        color: variant.color,
        size: variant.size,
        mainImage: variant.mainImage,
        images: variant.images
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
    
    variant.images = variant.images.filter(img => img !== imageUrl);
    
    if (variant.mainImage === imageUrl) {
      variant.mainImage = variant.images[0] || null;
    }
    
    await product.save();
    
    if (!imageUrl.startsWith('http')) {
      deleteFile(imageUrl);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Image removed successfully',
      variant: {
        id: variant._id,
        color: variant.color,
        size: variant.size,
        mainImage: variant.mainImage,
        images: variant.images
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
    
    variant.images.forEach(image => {
      if (!image.startsWith('http')) {
        deleteFile(image);
      }
    });
    
    variant.images = [];
    variant.mainImage = '';
    
    await product.save();
    
    return res.status(200).json({
      success: true,
      message: 'All images removed from variant',
      variant: {
        id: variant._id,
        color: variant.color,
        size: variant.size,
        mainImage: variant.mainImage,
        images: variant.images
      }
    });
    
  } catch (error) {
    console.error('deleteAllVariantImages error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};