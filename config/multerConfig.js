import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const dirs = ['uploads', 'uploads/banners', 'uploads/categories', 'uploads/profiles', 'uploads/misc'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderMap = {
      bannerImage: 'uploads/banners',
      categoryImage: 'uploads/categories',
      profileImage: 'uploads/profiles',
    };
    const folder = folderMap[file.fieldname] || 'uploads/misc';
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Sanitize original filename
    const sanitized = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, uniqueSuffix + '-' + sanitized);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Base multer instance
const upload = multer({
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024,  // 5MB
    files: 10                    // max 10 files
  },
  fileFilter,
});

// ✅ Wrapper to catch ALL multer errors
const wrapMulter = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();

    console.error('Multer error:', err);

    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: 'File too large. Maximum size is 5MB.',
        LIMIT_FILE_COUNT: 'Too many files. Maximum is 10.',
        LIMIT_UNEXPECTED_FILE: `Unexpected field: "${err.field}". Use "bannerImage" as field name.`,
      };
      return res.status(400).json({
        success: false,
        message: messages[err.code] || `Upload error: ${err.message}`,
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || 'File upload failed.',
    });
  });
};

export const uploadBannerImages = wrapMulter(upload.array('bannerImage', 10));
export const uploadCategoryImage = wrapMulter(upload.single('categoryImage'));
export const uploadProfileImage  = wrapMulter(upload.single('profileImage'));

export default upload;