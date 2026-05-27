// utils/fileUtils.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate full URL for a stored file
 */
export const getFileUrl = (req, filename, subfolder) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${subfolder}/${filename}`;
};

/**
 * Delete a file from the filesystem
 */
export const deleteFile = (filePath) => {
  try {
    if (!filePath) return false;
    
    // Handle URL paths
    let cleanPath = filePath;
    if (filePath.startsWith('http')) {
      const match = filePath.match(/\/uploads\/(.+)$/);
      if (match) {
        cleanPath = `uploads/${match[1]}`;
      }
    }
    
    const absolutePath = path.join(__dirname, '..', cleanPath);
    
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`✅ Deleted: ${absolutePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Delete error: ${error.message}`);
    return false;
  }
};

/**
 * Delete multiple files
 */
export const deleteMultipleFiles = (filePaths) => {
  if (!filePaths || !filePaths.length) return;
  filePaths.forEach(filePath => deleteFile(filePath));
};