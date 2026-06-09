// // middleware/authMiddleware.js
// import jwt from 'jsonwebtoken';

// export const authenticateToken = async (req, res, next) => {
//   try {
//     // Get token from header
//     const authHeader = req.headers.authorization;
    
//     console.log('=== AUTH DEBUG ===');
//     console.log('Auth Header:', authHeader);
    
//     if (!authHeader) {
//       console.log('❌ No authorization header');
//       return res.status(401).json({
//         success: false,
//         message: 'Authentication required. Please login.'
//       });
//     }
    
//     // Check if it starts with Bearer
//     if (!authHeader.startsWith('Bearer ')) {
//       console.log('❌ Invalid format - missing Bearer prefix');
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid authorization format. Use: Bearer <token>'
//       });
//     }
    
//     // Extract token
//     const token = authHeader.substring(7); // Remove 'Bearer ' prefix
//     console.log('Token extracted, length:', token.length);
//     console.log('Token first 50 chars:', token.substring(0, 50) + '...');
    
//     // Verify token
//     const secret = process.env.JWT_SECRET_KEY;
//     console.log('Using JWT secret:', secret);
    
//     const decoded = jwt.verify(token, secret);
//     console.log('✅ Token decoded successfully');
//     console.log('Decoded payload:', decoded);
    
//     // Attach user info to request
//     req.user = {
//       id: decoded.id,
//       role: decoded.role || 'admin', // Default to admin if role not set
//       name: decoded.name || 'Admin',
//       email: decoded.email
//     };
    
//     console.log('✅ User authenticated:', req.user);
//     next();
    
//   } catch (error) {
//     console.error('❌ Auth error:', error.message);
//     console.error('Error name:', error.name);
    
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
    const token = authHeader.substring(7);
    console.log('Token extracted, length:', token.length);
    console.log('Token first 50 chars:', token.substring(0, 50) + '...');
    
    // Verify token
    const secret = process.env.JWT_SECRET_KEY;
    if (!secret) {
      console.error('❌ JWT_SECRET_KEY is not defined in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }
    
    console.log('Using JWT secret:', secret.substring(0, 10) + '...');
    
    const decoded = jwt.verify(token, secret);
    console.log('✅ Token decoded successfully');
    console.log('Decoded payload:', decoded);
    
    // Normalize role to lowercase for consistency
    let role = decoded.role || 'user';
    if (typeof role === 'string') {
      role = role.toLowerCase();
    }
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      role: role,
      originalRole: decoded.role, // Keep original for reference
      name: decoded.name || 'User',
      email: decoded.email
    };
    
    console.log('✅ User authenticated:', { id: req.user.id, role: req.user.role, name: req.user.name });
    next();
    
  } catch (error) {
    console.error('❌ Auth error:', error.message);
    console.error('Error name:', error.name);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'AUTH_ERROR'
    });
  }
};

// Role-based authorization middleware (case insensitive)
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Please login first.'
      });
    }
    
    // Normalize allowed roles to lowercase
    const normalizedAllowedRoles = roles.map(role => role.toLowerCase());
    const userRole = req.user.role.toLowerCase();
    
    if (!normalizedAllowedRoles.includes(userRole)) {
      const allowedRolesList = roles.join(', ');
      return res.status(403).json({
        success: false,
        message: `Access denied. Role "${req.user.originalRole || req.user.role}" is not authorized. Allowed roles: ${allowedRolesList}`,
        yourRole: req.user.originalRole || req.user.role,
        allowedRoles: roles
      });
    }
    
    next();
  };
};

// Check if user is admin (convenience middleware)
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Please login first.'
    });
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  next();
};

// Check if user is designer
export const isDesigner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Please login first.'
    });
  }
  
  if (req.user.role !== 'designer' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Designer access required'
    });
  }
  
  next();
};

// Check if user is tailor
export const isTailor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Please login first.'
    });
  }
  
  if (req.user.role !== 'tailor' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Tailor access required'
    });
  }
  
  next();
};

// Optional: Attach user info to response locals (for views)
export const attachUser = async (req, res, next) => {
  if (req.user) {
    res.locals.user = req.user;
  }
  next();
};