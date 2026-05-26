// // middleware/authMiddleware.js
// import jwt from 'jsonwebtoken';

// export const authenticateToken = async (req, res, next) => {
//   try {
//     // Get token from header
//     const authHeader = req.headers['authorization'];
    
//     console.log('=== AUTH DEBUG ===');
//     console.log('Full authHeader:', authHeader);
    
//     if (!authHeader) {
//       console.log('❌ No authorization header');
//       return res.status(401).json({
//         success: false,
//         message: 'Authentication required. Please login.'
//       });
//     }
    
//     const parts = authHeader.split(' ');
//     console.log('Auth parts:', parts);
    
//     if (parts.length !== 2 || parts[0] !== 'Bearer') {
//       console.log('❌ Invalid auth format. Expected: Bearer <token>');
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid authorization format. Use: Bearer <token>'
//       });
//     }
    
//     const token = parts[1];
//     console.log('Token received:', token.substring(0, 50) + '...');
    
//     // Verify token
//     const secret = process.env.JWT_SECRET || 'your_secret_key_here';
//     console.log('Using JWT secret:', secret);
    
//     const decoded = jwt.verify(token, secret);
//     console.log('✅ Token decoded successfully:', decoded);
    
//     // Attach user info to request
//     req.user = {
//       id: decoded.id,
//       role: decoded.role,
//       name: decoded.name,
//       email: decoded.email
//     };
    
//     next();
    
//   } catch (error) {
//     console.error('❌ Auth error:', error.message);
//     console.error('Full error:', error);
    
//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({
//         success: false,
//         message: 'Token has expired. Please login again.'
//       });
//     }
    
//     if (error.name === 'JsonWebTokenError') {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid token. Please login again.'
//       });
//     }
    
//     return res.status(403).json({
//       success: false,
//       message: 'Invalid or expired token'
//     });
//   }
// };
// // Optional: Role-based authorization middleware
// export const authorizeRoles = (...roles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         message: 'Unauthorized'
//       });
//     }
    
//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({
//         success: false,
//         message: `Role ${req.user.role} is not authorized to access this resource`
//       });
//     }
    
//     next();
//   };
// };

// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';

export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    console.log('=== AUTH DEBUG ===');
    console.log('Auth Header:', authHeader);
    
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }
    
    // Check if it starts with Bearer
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Invalid format - missing Bearer prefix');
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Use: Bearer <token>'
      });
    }
    
    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Token extracted, length:', token.length);
    console.log('Token first 50 chars:', token.substring(0, 50) + '...');
    
    // Verify token
    const secret = process.env.JWT_SECRET || 'your_secret_key_here';
    console.log('Using JWT secret:', secret);
    
    const decoded = jwt.verify(token, secret);
    console.log('✅ Token decoded successfully');
    console.log('Decoded payload:', decoded);
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      role: decoded.role || 'admin', // Default to admin if role not set
      name: decoded.name || 'Admin',
      email: decoded.email
    };
    
    console.log('✅ User authenticated:', req.user);
    next();
    
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    console.error('Error name:', error.name);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
    
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Optional: Role-based authorization middleware
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized to access this resource`
      });
    }
    
    next();
  };
};