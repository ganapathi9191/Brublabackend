
// routes/adminRoutes.js
import express from 'express';
import User from '../Models/User.js';
import { upload, uploadProductMedia, uploadMultipleImages, uploadSubcategoryImage, uploadLoginMedia, uploadSingleImage, uploadHeroMedia, uploadHomepageBanner,uploadCollectionImage } from '../config/multerConfig.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

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
    createProduct,
  getAllProducts,
  getProductById,
  getProductsByCreatorId,
  updateProductById,
  deleteProductById,
  addProductReview,
  getProductsBySubcategory,
  addVariantImages,
  getVariantImages,
  setVariantMainImage,
  removeVariantImage,
  deleteAllVariantImages,
  reorderVariantImages,
  // Admin Order Management
  getAllOrders,
  getOrderStatistics,
  getOrderByIdAdmin,
  updateOrderStatus,

  // Login Screen Media Management
  uploadLoginScreenMedia,
  deleteLoginScreenMedia,
  checkLoginScreenMedia,

  // Homepage Management
  addHeroSection,
  getHeroSections,
  getHeroSectionById,
  updateHeroSection,
  deleteHeroSection,
  toggleHeroSection,
  addBannerSection,
  getBannerSections,
  getBannerSectionById,
  updateBannerSection,
  deleteBannerSection,
  toggleBannerSection,

  // Collection Management
  createCollection,
  getAllCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
  toggleCollectionStatus,
  addProductToCollection,
  removeProductFromCollection,
  getCollectionProducts,
  addMultipleProductsToCollection,

  //Homepage Collection Management
  addCollectionToHomepage,
  removeCollectionFromHomepage,
  reorderHomepageCollections,
  toggleHomepageCollection,
  getHomepageCollections,

  // Recommended Products
  addRecommendedProducts,
  getRecommendedProducts,
  deleteRecommendedProducts,
  toggleRecommendedProduct,

  // Notification Label
  addNotifications,
  getAllNotificationsAdmin,
  updateNotificationById,
  deleteNotificationById,
  toggleNotificationById,
  toggleSection,
  

  //upcoming Collections
  addUpcomingCollection,
  getAllUpcomingCollections,
  getUpcomingCollectionById,
  updateUpcomingCollection,
  removeUpcomingCollection,

  // Latest Designs
  addLatestDesigns,
  getLatestDesignsAdmin,
  deleteLatestDesigns,
  toggleLatestDesign,

  // Designer Products
  getAllDesignerProducts,
  getDesignerProductById,
  bulkApproveProducts,
  bulkRejectProducts,
  getAllDesigners,
  approveDesigner,
  getDesignerSettings,
  updateDesignerSettings,
  rejectDesigner,
  getDesignerDetails,
  adminDeleteDesignerProduct,
  adminAddMoneyToDesigner,
  adminDeductMoneyFromDesigner,
  getDesignerWallet,

  //Wallet
  getUserWallet,
  getUserTransactions,
  adminAddMoney,
  adminDeductMoney,
  adminRefundWallet,

  // stylist Bookings
  getAllStylistBookings,
  getStylistBookingByIdAdmin,
  updateStylistBookingAdmin,
  deleteStylistBookingAdmin,
  getPendingDesigners,
  getPendingDesignerProducts
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

router.post('/categories', createCategory); 
router.get('/categories', getAllCategories);
router.get('/categories/:id', getCategoryById);
router.put('/categories/:id', updateCategoryById); // No image upload needed
router.delete('/categories/:id', deleteCategoryById); 

// ==================== SUBCATEGORY MANAGEMENT ====================
router.post('/categories/:categoryId/subcategories', uploadSubcategoryImage, createSubcategory);
router.get('/categories/:categoryId/subcategories', getSubcategoriesByCategory);
router.get('/categories/:categoryId/subcategories/:subcategoryId', getSubcategoryById);
router.put('/categories/:categoryId/subcategories/:subcategoryId', uploadSubcategoryImage, updateSubcategoryById);
router.delete('/categories/:categoryId/subcategories/:subcategoryId', deleteSubcategoryById);

// ==================== PRODUCT MANAGEMENT ====================
router.post('/products',authenticateToken, uploadProductMedia, createProduct);
router.get('/products', getAllProducts);
router.get('/products/:id', getProductById);
router.get('/products/creator/:creatorId', getProductsByCreatorId);
router.put('/products/:id', authenticateToken, uploadProductMedia, updateProductById);
router.delete('/products/:id', authenticateToken, deleteProductById);
router.post('/products/:id/reviews', addProductReview);
router.get('/subcategories/:subcategoryId/products', getProductsBySubcategory);

router.post('/products/:productId/variants/:variantId/images', uploadMultipleImages, addVariantImages);
router.get('/products/:productId/variants/:variantId/images', getVariantImages);
router.put('/products/:productId/variants/:variantId/main-image', setVariantMainImage);
router.delete('/products/:productId/variants/:variantId/images', removeVariantImage);
router.delete('/products/:productId/variants/:variantId/images', deleteAllVariantImages);
router.put('/products/:productId/variants/:variantId/images/reorder', reorderVariantImages);

// ==================== ADMIN ORDER MANAGEMENT ====================
router.get('/orders', authenticateToken, getAllOrders);
router.get('/orders/statistics', authenticateToken, getOrderStatistics);
router.get('/orders/:orderId', authenticateToken, getOrderByIdAdmin);
router.put('/orders/:orderId/status', authenticateToken, updateOrderStatus);


// ==================== LOGIN SCREEN MEDIA MANAGEMENT ====================
router.post('/login-screen/upload', authenticateToken, uploadLoginMedia, uploadLoginScreenMedia);
router.delete('/login-screen/media/:filename', deleteLoginScreenMedia);
router.get('/login-screen/media/:filename', checkLoginScreenMedia);


// Hero Section Routes
router.post('/homepage/hero/add', uploadHeroMedia, addHeroSection);
router.get('/homepage/hero', getHeroSections);
router.get('/homepage/hero/:heroId', getHeroSectionById);
router.put('/homepage/hero/:heroId', uploadHeroMedia, updateHeroSection);
router.delete('/homepage/hero/:heroId', deleteHeroSection);
router.patch('/homepage/hero/:heroId/toggle', toggleHeroSection);

// Banner Section Routes
router.post('/homepage/banner/add', uploadHomepageBanner, addBannerSection);
router.get('/homepage/banner', getBannerSections);
router.get('/homepage/banner/:bannerId', getBannerSectionById);
router.put('/homepage/banner/:bannerId', uploadHomepageBanner, updateBannerSection);
router.delete('/homepage/banner/:bannerId', deleteBannerSection);
router.patch('/homepage/banner/:bannerId/toggle', toggleBannerSection);

// ==================== COLLECTION MANAGEMENT ====================
// Collection CRUD
router.post('/collections', uploadCollectionImage, createCollection);
router.get('/collections', getAllCollections);
router.get('/collections/:collectionId', getCollectionById);
router.put('/collections/:collectionId', uploadCollectionImage, updateCollection);
router.delete('/collections/:collectionId', deleteCollection);
router.patch('/collections/:collectionId/toggle', toggleCollectionStatus);

// Product management
router.get('/collections/:collectionId/products', getCollectionProducts);
router.post('/collections/:collectionId/products', addProductToCollection);
router.post('/collections/:collectionId/products/bulk', addMultipleProductsToCollection);
router.delete('/collections/:collectionId/products/:productId', removeProductFromCollection);

// ==================== HOMEPAGE COLLECTION MANAGEMENT ====================
router.post('/homepage/collections', addCollectionToHomepage);
router.delete('/homepage/collections/:collectionId', removeCollectionFromHomepage);
router.put('/homepage/collections/reorder', reorderHomepageCollections);
router.patch('/homepage/collections/:collectionId/toggle', toggleHomepageCollection);
router.get('/homepage/collections', getHomepageCollections);

// ==================== RECOMMENDED PRODUCTS ====================
router.post('/recommended/add', addRecommendedProducts);
router.get('/recommended', getRecommendedProducts);
router.delete('/recommended/remove', deleteRecommendedProducts);
router.patch('/recommended/:id/toggle', toggleRecommendedProduct);

// ==================== LATEST DESIGNS ====================
router.post('/latest/add', addLatestDesigns);
router.get('/latest', getLatestDesignsAdmin);
router.delete('/latest/remove', deleteLatestDesigns);
router.patch('/latest/:id/toggle', toggleLatestDesign);

// ==================== UPCOMING COLLECTIONS ====================
router.post('/upcoming', addUpcomingCollection);
router.get('/upcoming', getAllUpcomingCollections);
router.get('/upcoming/:id', getUpcomingCollectionById);
router.put('/upcoming/:id', updateUpcomingCollection);
router.delete('/upcoming/:id', removeUpcomingCollection);

// ==================== NOTIFICATION LABELS ====================
router.post('/notificationlabels', addNotifications);
router.get('/notificationlabels', getAllNotificationsAdmin);
router.put('/notificationlabels/:id', updateNotificationById);
router.delete('/notificationlabels/:id', deleteNotificationById);
router.patch('/notificationlabels/:id/toggle', toggleNotificationById);
router.patch('/notificationlabels/toggle-section', toggleSection);

// ==================== DESIGNER PRODUCT MANAGEMENT ====================
router.get('/designer-products/pending', authenticateToken, getPendingDesignerProducts)
router.get('/designer-products',  getAllDesignerProducts);
router.get('/designer-products/:productId', getDesignerProductById);
router.post('/designer-products/bulk-approve', authenticateToken, bulkApproveProducts);
router.post('/designer-products/bulk-reject', authenticateToken, bulkRejectProducts);
router.delete('/designer-products/:productId', authenticateToken, adminDeleteDesignerProduct);

router.get('/designer-settings', authenticateToken, getDesignerSettings);
router.put('/designer-settings', authenticateToken, updateDesignerSettings);

// ==================== DESIGNER MANAGEMENT ====================
router.get('/alldesigners',  getAllDesigners);
router.get('/pendingdesginers', getPendingDesigners)
router.patch('/designers/:designerId/approve', authenticateToken, approveDesigner);
router.patch('/designers/:designerId/reject', authenticateToken, rejectDesigner);
router.get('/designers/:designerId',  getDesignerDetails);


// ==================== DESIGNER WALLET ROUTES ====================
router.get('/designers/:designerId/wallet', authenticateToken, getDesignerWallet);
router.post('/designers/:designerId/wallet/add-money', authenticateToken, adminAddMoneyToDesigner);
router.post('/designers/:designerId/wallet/deduct', authenticateToken, adminDeductMoneyFromDesigner);


// Get user's wallet balance
router.get('/wallet/:userId', getUserWallet);

// Get user's transaction history
router.get('/wallet/:userId/transactions', getUserTransactions);

// ==================== POST APIs ====================

// Admin add money to user wallet
router.post('/wallet/:userId/add-money', adminAddMoney);

// Admin deduct money from user wallet
router.post('/wallet/:userId/deduct', adminDeductMoney);

// Admin refund to user wallet
router.post('/wallet/:userId/refund', adminRefundWallet);

// ==================== Stylist Bookings ===================
router.get('/stylist-bookings', getAllStylistBookings);
router.get('/stylist-booking/:bookingId', getStylistBookingByIdAdmin);
router.put('/stylist-booking/:bookingId', updateStylistBookingAdmin);
router.delete('/stylist-booking/:bookingId', deleteStylistBookingAdmin);

export default router;