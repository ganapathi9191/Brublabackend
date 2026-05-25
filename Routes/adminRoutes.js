
// routes/adminRoutes.js
import express from 'express';
import { upload } from '../config/multerConfig.js';
import {
  // Auth
  adminLogin,
  updatePermanentAdmin,
  
  // User Management
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  
  // Banner Management
  createBanners,
  getAllBanners,
  getBannerById,
  updateBannerById,
  deleteBannerById,
  
  // Category Management
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById,
  
  // Subcategory Management
  createSubcategory,
  getSubcategoriesByCategory,
  getSubcategoryById,
  updateSubcategoryById,
  deleteSubcategoryById,
} from '../Controller/adminController.js';

const router = express.Router();

// ==================== ADMIN AUTH ====================
router.post('/login', adminLogin);
router.put('/permanent-admin', updatePermanentAdmin);

// ==================== USER MANAGEMENT ====================
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUserById);
router.delete('/users/:id', deleteUserById);

// ==================== BANNER MANAGEMENT ====================
router.post('/createbanner', upload.array('images', 10), createBanners);
router.get('/banners', getAllBanners);
router.get('/banners/:id', getBannerById);
router.put('/banners/:id', upload.single('image'), updateBannerById);
router.delete('/banners/:id', deleteBannerById);

// ==================== CATEGORY MANAGEMENT ====================
router.post('/categories', createCategory); // No image upload needed
router.get('/categories', getAllCategories);
router.get('/categories/:id', getCategoryById);
router.put('/categories/:id', updateCategoryById); // No image upload needed
router.delete('/categories/:id', deleteCategoryById);

// ==================== SUBCATEGORY MANAGEMENT ====================
router.post('/categories/:categoryId/subcategories', upload.single('image'), createSubcategory);
router.get('/categories/:categoryId/subcategories', getSubcategoriesByCategory);
router.get('/categories/:categoryId/subcategories/:subcategoryId', getSubcategoryById);
router.put('/categories/:categoryId/subcategories/:subcategoryId', upload.single('image'), updateSubcategoryById);
router.delete('/categories/:categoryId/subcategories/:subcategoryId', deleteSubcategoryById);

export default router;