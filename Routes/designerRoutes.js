// // routes/designerRoutes.js
// import express from 'express';
// import {
//   getDesignerStats,
//   getDesignerProfile,
//   updateDesignerProfile,
//   getDesignerProducts,
//   getDesignerProductById,
//   createDesignerProduct,
//   updateDesignerProduct,
//   deleteDesignerProduct,
//   submitForApproval,
//   getDesignerOrders
// } from '../Controller/DesignerController.js';
// import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';
// import { uploadProductMedia } from '../config/multerConfig.js';

// const router = express.Router();

// // Apply authentication to all designer routes
// router.use(authenticateToken);
// router.use(authorizeRoles('designer', 'admin'));

// // Dashboard & Profile
// router.get('/stats', getDesignerStats);
// router.get('/profile', getDesignerProfile);
// router.put('/profile', updateDesignerProfile);

// // Product Management
// router.get('/products', getDesignerProducts);
// router.get('/products/:productId', getDesignerProductById);
// router.post('/products', uploadProductMedia, createDesignerProduct);
// router.put('/products/:id', uploadProductMedia, updateDesignerProduct);
// router.delete('/products/:id', deleteDesignerProduct);
// router.patch('/products/:productId/submit-approval', submitForApproval);

// // Orders
// router.get('/orders', getDesignerOrders);

// export default router;


// routes/designerRoutes.js
import express from 'express';
import {
  designerLoginRequest,
  designerVerifyOtp,
  designerRegister,
  designerVerifyRegisterOtp,
  getDesignerStats,
  getDesignerProfile,
  updateDesignerProfile,
  getDesignerProducts,
  getDesignerProductById,
  createDesignerProduct,
  updateDesignerProduct,
  deleteDesignerProduct,
  submitForApproval,
  getDesignerOrders,
  getDesignerSettings,
  addMoneyToWallet,
  getWalletBalance,
  getCashbackStatus,
  getProductCashbackStatus

} from '../Controller/DesignerController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';
import { uploadProductMedia } from '../config/multerConfig.js';

const router = express.Router();

// ==================== PUBLIC ROUTES (No Auth) ====================
router.post('/register', designerRegister);
router.post('/register/verify-otp', designerVerifyRegisterOtp);
router.post('/login', designerLoginRequest);
router.post('/login/verify-otp', designerVerifyOtp);

// ==================== PROTECTED ROUTES (Auth Required) ====================
router.use(authenticateToken);
router.use(authorizeRoles('designer', 'admin'));

// Dashboard & Profile
router.get('/stats', getDesignerStats);
router.get('/profile', getDesignerProfile);
router.put('/profile', updateDesignerProfile);
router.get('/products', getDesignerProducts);
router.get('/designer-settings', authenticateToken, getDesignerSettings);

// ==================== WALLET ROUTES ====================
router.post('/wallet/add-money', addMoneyToWallet);
router.get('/wallet/balance', getWalletBalance);

// Get cashback status for all products
router.get('/cashback/status', authenticateToken, getCashbackStatus);

// Get cashback status for specific product
router.get('/cashback/status/:productId', authenticateToken, getProductCashbackStatus);


// Products
router.get('/products/:productId', getDesignerProductById);
router.post('/products', uploadProductMedia, createDesignerProduct);
router.put('/products/:id', uploadProductMedia, updateDesignerProduct);
router.delete('/products/:id', deleteDesignerProduct);
router.patch('/products/:productId/submit-approval', submitForApproval);

// Orders
router.get('/orders', getDesignerOrders);

export default router;