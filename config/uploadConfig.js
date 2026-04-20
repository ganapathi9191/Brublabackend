import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Set up storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');  // Save to uploads folder
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname)); // Unique filename
  },
});

// File filter for images and videos
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|mp4|mov/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed!'));
  }
};

// ✅ Clean field definitions
const uploads = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
}).fields([
  { name: 'file', maxCount: 5 },    // up to 5 images or videos
  { name: 'image', maxCount: 1 },   // one image
  { name: 'images', maxCount: 5 },  // up to 5 images
]);

export default uploads;
