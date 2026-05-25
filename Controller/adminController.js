import Admin from '../Models/Admin.js';
import User from '../Models/User.js';
import Banner from '../Models/Banner.js';
import Category from '../Models/Category.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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



// ==================== CREATE PRODUCT (ADMIN ONLY) ====================
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      discountPrice,
      categoryId,
      subcategoryId,
      sizes,
      deliveryAddresses,
      stock
    } = req.body;

    // Handle files (images and videos)
    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];

    // Validate required fields
    if (!name || !description || !price || !categoryId || !subcategoryId) {
      // Clean up uploaded files if validation fails
      if (imageFiles.length) deleteMultipleFiles(imageFiles.map(f => f.path));
      if (videoFiles.length) deleteMultipleFiles(videoFiles.map(f => f.path));
      
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, price, categoryId, subcategoryId'
      });
    }

    // Validate category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      if (imageFiles.length) deleteMultipleFiles(imageFiles.map(f => f.path));
      if (videoFiles.length) deleteMultipleFiles(videoFiles.map(f => f.path));
      
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Validate subcategory exists in category
    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
      if (imageFiles.length) deleteMultipleFiles(imageFiles.map(f => f.path));
      if (videoFiles.length) deleteMultipleFiles(videoFiles.map(f => f.path));
      
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found in this category'
      });
    }

    // Validate at least one image is provided
    if (!imageFiles || imageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required'
      });
    }

    // Process images - convert to URLs
    const imageUrls = imageFiles.map(file => {
      const filename = path.basename(file.path);
      return getFileUrl(req, filename, 'images');
    });

    // Process videos - convert to URLs
    const videoUrls = videoFiles.map(file => {
      const filename = path.basename(file.path);
      return getFileUrl(req, filename, 'videos');
    });

    // Parse sizes (can be JSON string or array)
    let sizesArray = [];
    if (sizes) {
      sizesArray = Array.isArray(sizes) ? sizes : JSON.parse(sizes);
    }

    // Parse delivery addresses (can be JSON string or array)
    let addressesArray = [];
    if (deliveryAddresses) {
      addressesArray = Array.isArray(deliveryAddresses) ? deliveryAddresses : JSON.parse(deliveryAddresses);
    }

    // Create product (admin created)
    const product = new Product({
      name,
      description,
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : null,
      categoryId,
      subcategoryId,
      subcategoryName: subcategory.name,
      images: imageUrls,
      sizes: sizesArray.length ? sizesArray : ['S', 'M', 'L'],
      sizeGuide: videoUrls,
      deliveryAddresses: addressesArray,
      stock: stock ? parseInt(stock) : 0,
      createdBy: 'admin',
      isActive: true
    });

    await product.save();

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });

  } catch (error) {
    console.error('createProduct error:', error);
    
    // Clean up any uploaded files on error
    if (req.files) {
      if (req.files.images) {
        deleteMultipleFiles(req.files.images.map(f => f.path));
      }
      if (req.files.videos) {
        deleteMultipleFiles(req.files.videos.map(f => f.path));
      }
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ==================== GET ALL PRODUCTS ====================
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
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    let sort = {};
    if (sortBy === 'price_asc') sort.price = 1;
    else if (sortBy === 'price_desc') sort.price = -1;
    else if (sortBy === 'rating_desc') sort.averageRating = -1;
    else if (sortBy === 'newest') sort.createdAt = -1;
    else sort.createdAt = -1;

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

// ==================== GET PRODUCT BY ID ====================
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('categoryId', 'name')
      .populate('reviews.user', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    return res.status(200).json({
      success: true,
      product
    });

  } catch (error) {
    console.error('getProductById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ==================== GET PRODUCTS BY DESIGNER ID ====================
export const getProductsByDesignerId = async (req, res) => {
  try {
    const { designerId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find({
      'designerInfo.designerId': designerId,
      createdBy: 'designer'
    })
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments({
      'designerInfo.designerId': designerId,
      createdBy: 'designer'
    });

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products
    });

  } catch (error) {
    console.error('getProductsByDesignerId error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ==================== UPDATE PRODUCT ====================
export const updateProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      discountPrice,
      categoryId,
      subcategoryId,
      sizes,
      deliveryAddresses,
      stock,
      isActive
    } = req.body;

    const imageFiles = req.files?.images || [];
    const videoFiles = req.files?.videos || [];

    const product = await Product.findById(id);
    if (!product) {
      // Clean up uploaded files
      if (imageFiles.length) deleteMultipleFiles(imageFiles.map(f => f.path));
      if (videoFiles.length) deleteMultipleFiles(videoFiles.map(f => f.path));
      
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update basic fields
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = parseFloat(price);
    if (discountPrice !== undefined) product.discountPrice = discountPrice ? parseFloat(discountPrice) : null;
    if (stock !== undefined) product.stock = parseInt(stock);
    if (isActive !== undefined) product.isActive = isActive === 'true';

    // Update category/subcategory if changed
    if (categoryId && categoryId !== product.categoryId.toString()) {
      const category = await Category.findById(categoryId);
      if (!category) {
        if (imageFiles.length) deleteMultipleFiles(imageFiles.map(f => f.path));
        if (videoFiles.length) deleteMultipleFiles(videoFiles.map(f => f.path));
        
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      if (subcategoryId) {
        const subcategory = category.subcategories.id(subcategoryId);
        if (!subcategory) {
          if (imageFiles.length) deleteMultipleFiles(imageFiles.map(f => f.path));
          if (videoFiles.length) deleteMultipleFiles(videoFiles.map(f => f.path));
          
          return res.status(404).json({
            success: false,
            message: 'Subcategory not found'
          });
        }
        product.subcategoryName = subcategory.name;
      }
      
      product.categoryId = categoryId;
      if (subcategoryId) product.subcategoryId = subcategoryId;
    }

    // Update sizes
    if (sizes) {
      product.sizes = Array.isArray(sizes) ? sizes : JSON.parse(sizes);
    }

    // Update delivery addresses
    if (deliveryAddresses) {
      product.deliveryAddresses = Array.isArray(deliveryAddresses) ? deliveryAddresses : JSON.parse(deliveryAddresses);
    }

    // Update images (add new ones, optionally delete old ones)
    if (imageFiles.length > 0) {
      // Delete old images if they are local files
      product.images.forEach(image => {
        if (!image.startsWith('http')) {
          deleteFile(image);
        }
      });
      
      // Add new images
      const newImageUrls = imageFiles.map(file => {
        const filename = path.basename(file.path);
        return getFileUrl(req, filename, 'images');
      });
      product.images = newImageUrls;
    }

    // Update videos
    if (videoFiles.length > 0) {
      // Delete old videos if they are local files
      product.sizeGuide.forEach(video => {
        if (!video.startsWith('http')) {
          deleteFile(video);
        }
      });
      
      // Add new videos
      const newVideoUrls = videoFiles.map(file => {
        const filename = path.basename(file.path);
        return getFileUrl(req, filename, 'videos');
      });
      product.sizeGuide = newVideoUrls;
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product
    });

  } catch (error) {
    console.error('updateProductById error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      if (req.files.images) {
        deleteMultipleFiles(req.files.images.map(f => f.path));
      }
      if (req.files.videos) {
        deleteMultipleFiles(req.files.videos.map(f => f.path));
      }
    }
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// ==================== DELETE PRODUCT ====================
export const deleteProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete all product images
    if (product.images && product.images.length) {
      product.images.forEach(image => {
        if (!image.startsWith('http')) {
          deleteFile(image);
        }
      });
    }

    // Delete all product videos
    if (product.sizeGuide && product.sizeGuide.length) {
      product.sizeGuide.forEach(video => {
        if (!video.startsWith('http')) {
          deleteFile(video);
        }
      });
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('deleteProductById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


// ==================== ADD REVIEW TO PRODUCT ====================
export const addProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, rating, description, images } = req.body;

    if (!userId || !rating || !description) {
      return res.status(400).json({
        success: false,
        message: 'UserId, rating and description are required'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews.find(
      review => review.user.toString() === userId
    );

    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: 'User already reviewed this product'
      });
    }

    const review = {
      user: userId,
      userName: user.name,
      userImage: user.profileImage || '',
      rating: parseInt(rating),
      description,
      images: images || [],
      createdAt: new Date()
    };

    product.reviews.push(review);
    product.calculateAverageRating();
    await product.save();

    return res.status(201).json({
      success: true,
      message: 'Review added successfully',
      review
    });

  } catch (error) {
    console.error('addProductReview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ==================== GET PRODUCTS BY SUBCATEGORY ====================
export const getProductsBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Product.find({
      subcategoryId,
      isActive: true
    })
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments({
      subcategoryId,
      isActive: true
    });

    return res.status(200).json({
      success: true,
      count: products.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products
    });

  } catch (error) {
    console.error('getProductsBySubcategory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};