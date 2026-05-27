// config/multerConfig.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// ==================== STORAGE CONFIGURATIONS ====================

// Configure storage for profile images
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/profiles';
    ensureDirectoryExists(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

// Configure storage for product images
const productImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/products';
    ensureDirectoryExists(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

// Configure storage for product images (separate folder - legacy)
const productImageOnlyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/products/images';
    ensureDirectoryExists(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-img-' + uniqueSuffix + ext);
  }
});

// Configure storage for product videos
const productVideoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/products/videos';
    ensureDirectoryExists(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-video-' + uniqueSuffix + ext);
  }
});

// Configure storage for banners
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/banners';
    ensureDirectoryExists(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'banner-' + uniqueSuffix + ext);
  }
});

// Configure storage for subcategories
const subcategoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = 'uploads/subcategories';
    ensureDirectoryExists(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'subcategory-' + uniqueSuffix + ext);
  }
});

// ==================== FILE FILTERS ====================

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// File filter for videos
const videoFilter = (req, file, cb) => {
  const allowedTypes = /mp4|mov|webm|avi/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed (mp4, mov, webm, avi)'));
  }
};

// ==================== MULTER MIDDLEWARES ====================

// // ✅ CORRECT: Use fields() for product creation (images + videos together)
// export const uploadProductMedia = multer({
//   storage: productImageStorage,
//   limits: { 
//     fileSize: 50 * 1024 * 1024, // 50MB limit
//     files: 25 // Max 25 files total
//   },
//   fileFilter: (req, file, cb) => {
//     if (file.fieldname === 'images') {
//       imageFilter(req, file, cb);
//     } else if (file.fieldname === 'videos') {
//       videoFilter(req, file, cb);
//     } else {
//       cb(new Error('Invalid field name. Use "images" or "videos"'));
//     }
//   }
// }).fields([
//   { name: 'images', maxCount: 20 },  // Max 20 images
//   { name: 'videos', maxCount: 5 }     // Max 5 videos
// ]);

// config/multerConfig.js

// ✅ SIMPLE AND RELIABLE - Accepts any field name
export const uploadProductMedia = multer({
  storage: productImageStorage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 50 // Max 50 files total
  },
  fileFilter: (req, file, cb) => {
    // Allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } 
    // Allow video files
    else if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    }
    else {
      cb(new Error('Only images and videos are allowed'), false);
    }
  }
}).any(); // ← KEY: .any() accepts any field names

// Alternative: If you want to keep the old one for backward compatibility
export const uploadProductMediaLegacy = multer({
  storage: productImageStorage,
  limits: { 
    fileSize: 50 * 1024 * 1024,
    files: 25
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images') {
      imageFilter(req, file, cb);
    } else if (file.fieldname === 'videos') {
      videoFilter(req, file, cb);
    } else {
      cb(new Error('Invalid field name. Use "images" or "videos"'));
    }
  }
}).fields([
  { name: 'images', maxCount: 20 },
  { name: 'videos', maxCount: 5 }
]);

// Upload for product images (multiple) - array format
export const uploadProductImages = multer({
  storage: productImageOnlyStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per image
  fileFilter: imageFilter
}).array('images', 20); // Max 20 images

// Upload for product videos (multiple) - array format
export const uploadProductVideos = multer({
  storage: productVideoStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit per video
  fileFilter: videoFilter
}).array('videos', 5); // Max 5 videos

// Combined upload that handles both (sequential)
export const uploadProductCombined = (req, res, next) => {
  // First handle images
  const imageUpload = multer({
    storage: productImageOnlyStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFilter
  }).array('images', 20);
  
  // Then handle videos
  const videoUpload = multer({
    storage: productVideoStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: videoFilter
  }).array('videos', 5);
  
  // Run image upload first
  imageUpload(req, res, (err) => {
    if (err) return next(err);
    
    // Then run video upload
    videoUpload(req, res, (err) => {
      if (err) return next(err);
      next();
    });
  });
};

// Create upload middleware for profile images
export const uploadProfileImage = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: imageFilter
}).single('profileImage');

// Upload for multiple banners
export const uploadBanners = multer({
  storage: bannerStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
}).array('banners', 10);

// Upload for single banner
export const uploadBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
}).single('banner');

// Upload for subcategory image
export const uploadSubcategoryImage = multer({
  storage: subcategoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFilter
}).single('image');

// For single image upload (generic)
export const uploadSingleImage = multer({
  storage: productImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
}).single('image');

// For multiple images without videos
export const uploadMultipleImages = multer({
  storage: productImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter
}).array('images', 20);

// Generic upload for other files (fallback)
export const upload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
});