import express from 'express';
import {
  adminLogin,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  createBanners,
  getAllBanners,
  getBannerById,
  updateBannerById,
  deleteBannerById,
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategoryById,
  deleteCategoryById,
} from '../Controller/adminController.js';
import { uploadBannerImages, uploadCategoryImage } from '../config/multerConfig.js';

const router = express.Router();

// Admin Auth (no token required)
router.post('/login', adminLogin);

// User Management (no token required - since admin is already logged in via session)
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUserById);
router.delete('/users/:id', deleteUserById);

// Banner Management
router.post('/banners', uploadBannerImages, createBanners);
router.get('/banners', getAllBanners);
router.get('/banners/:id', getBannerById);
router.put('/banners/:id', uploadCategoryImage, updateBannerById);
router.delete('/banners/:id', deleteBannerById);

// Category Management
router.post('/categories', uploadCategoryImage, createCategory);
router.get('/categories', getAllCategories);
router.get('/categories/:id', getCategoryById);
router.put('/categories/:id', uploadCategoryImage, updateCategoryById);
router.delete('/categories/:id', deleteCategoryById);

export default router;