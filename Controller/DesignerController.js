// // controllers/designerController.js
// import Product from '../Models/Product.js';
// import Order from '../Models/Order.js';
// import Category from '../Models/Category.js';
// import User from '../Models/User.js';
// import { getFileUrl, deleteFile } from '../utils/fileUtils.js';
// import path from 'path';

// // Get designer dashboard statistics
// export const getDesignerStats = async (req, res) => {
//   try {
//     const designerId = req.user.id;
    
//     const totalProducts = await Product.countDocuments({ 
//       creatorId: designerId,
//       createdBy: 'designer'
//     });
    
//     const pendingApproval = await Product.countDocuments({ 
//       creatorId: designerId,
//       approvalStatus: 'pending'
//     });
    
//     const approvedProducts = await Product.countDocuments({ 
//       creatorId: designerId,
//       approvalStatus: 'approved',
//       isActive: true
//     });
    
//     const rejectedProducts = await Product.countDocuments({ 
//       creatorId: designerId,
//       approvalStatus: 'rejected'
//     });
    
//     // Get designer's products for order calculation
//     const designerProducts = await Product.find({ 
//       creatorId: designerId 
//     }).select('_id');
    
//     const productIds = designerProducts.map(p => p._id);
    
//     // Get orders containing designer's products
//     const orders = await Order.find({
//       'items.productId': { $in: productIds }
//     });
    
//     let totalSales = 0;
//     let totalOrders = orders.length;
    
//     orders.forEach(order => {
//       order.items.forEach(item => {
//         if (productIds.some(id => id.toString() === item.productId.toString())) {
//           totalSales += item.price * item.quantity;
//         }
//       });
//     });
    
//     return res.status(200).json({
//       success: true,
//       data: {
//         totalProducts,
//         pendingApproval,
//         approvedProducts,
//         rejectedProducts,
//         totalSales,
//         totalOrders
//       }
//     });
    
//   } catch (error) {
//     console.error('getDesignerStats error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// // Get designer's profile
// export const getDesignerProfile = async (req, res) => {
//   try {
//     const designerId = req.user.id;
    
//     const designer = await User.findById(designerId).select('-otp -otpExpires -authToken -authTokenExpires -deleteToken -deleteTokenExpiration');
    
//     if (!designer) {
//       return res.status(404).json({
//         success: false,
//         message: 'Designer not found'
//       });
//     }
    
//     const designerObj = designer.toObject();
//     if (designerObj.profileImage) {
//       const normalizedPath = designerObj.profileImage.replace(/\\/g, '/');
//       designerObj.profileImageUrl = `${req.protocol}://${req.get('host')}/${normalizedPath}`;
//     }
    
//     return res.status(200).json({
//       success: true,
//       data: designerObj
//     });
    
//   } catch (error) {
//     console.error('getDesignerProfile error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// // Update designer profile
// export const updateDesignerProfile = async (req, res) => {
//   try {
//     const designerId = req.user.id;
//     const { name, email, about, brandName } = req.body;
    
//     const updateData = {};
//     if (name) updateData.name = name;
//     if (email) updateData.email = email;
//     if (about) updateData.about = about;
//     if (brandName) updateData.brandName = brandName;
    
//     const designer = await User.findByIdAndUpdate(
//       designerId,
//       updateData,
//       { new: true, runValidators: true }
//     ).select('-otp -otpExpires -authToken -authTokenExpires');
    
//     if (!designer) {
//       return res.status(404).json({
//         success: false,
//         message: 'Designer not found'
//       });
//     }
    
//     return res.status(200).json({
//       success: true,
//       message: 'Profile updated successfully',
//       data: designer
//     });
    
//   } catch (error) {
//     console.error('updateDesignerProfile error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// // Get all products for designer (with filters)
// export const getDesignerProducts = async (req, res) => {
//   try {
//     const designerId = req.user.id;
//     const { status, page = 1, limit = 20, search } = req.query;
    
//     let query = { 
//       creatorId: designerId,
//       createdBy: 'designer'
//     };
    
//     if (status === 'pending') query.approvalStatus = 'pending';
//     if (status === 'approved') query.approvalStatus = 'approved';
//     if (status === 'rejected') query.approvalStatus = 'rejected';
//     if (status === 'active') query.isActive = true;
    
//     if (search) {
//       query.$or = [
//         { name: { $regex: search, $options: 'i' } },
//         { description: { $regex: search, $options: 'i' } }
//       ];
//     }
    
//     const skip = (parseInt(page) - 1) * parseInt(limit);
    
//     const products = await Product.find(query)
//       .populate('categoryId', 'name')
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit));
    
//     const total = await Product.countDocuments(query);
    
//     const transformedProducts = products.map(product => {
//       const productObj = product.toObject();
//       const firstVariant = productObj.variants?.[0];
//       const mainImage = firstVariant?.images?.[0] || productObj.mainImages?.[0] || null;
      
//       return {
//         _id: productObj._id,
//         name: productObj.name,
//         description: productObj.description,
//         displayPrice: productObj.displayPrice,
//         displayActualPrice: productObj.displayActualPrice,
//         maxDiscount: productObj.maxDiscount,
//         mainImage: mainImage,
//         approvalStatus: productObj.approvalStatus,
//         isActive: productObj.isActive,
//         rejectionReason: productObj.rejectionReason,
//         variantsCount: productObj.variants?.length || 0,
//         createdAt: productObj.createdAt,
//         updatedAt: productObj.updatedAt
//       };
//     });
    
//     return res.status(200).json({
//       success: true,
//       count: transformedProducts.length,
//       total,
//       page: parseInt(page),
//       pages: Math.ceil(total / parseInt(limit)),
//       products: transformedProducts
//     });
    
//   } catch (error) {
//     console.error('getDesignerProducts error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// // Get single product by ID for designer
// export const getDesignerProductById = async (req, res) => {
//   try {
//     const { productId } = req.params;
//     const designerId = req.user.id;
    
//     const product = await Product.findOne({ 
//       _id: productId,
//       creatorId: designerId,
//       createdBy: 'designer'
//     }).populate('categoryId', 'name');
    
//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: 'Product not found or you don\'t have access'
//       });
//     }
    
//     return res.status(200).json({
//       success: true,
//       product
//     });
    
//   } catch (error) {
//     console.error('getDesignerProductById error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// // Create product (designer) - Same as admin but with approval pending
// export const createDesignerProduct = async (req, res) => {
//   try {
//     const designerId = req.user.id;
//     const userRole = req.user.role;

//     if (userRole !== 'designer' && userRole !== 'admin') {
//       return res.status(403).json({
//         success: false,
//         message: 'Only designers can create products'
//       });
//     }

//     const {
//       name,
//       description,
//       categoryId,
//       subcategoryId,
//       variants,
//       deliveryAddresses,
//       tags
//     } = req.body;

//     if (!name || !description || !categoryId || !subcategoryId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Missing required fields: name, description, categoryId, subcategoryId'
//       });
//     }

//     // Parse variants
//     let variantsArray = [];
//     try {
//       variantsArray = typeof variants === 'string' ? JSON.parse(variants) : variants;
//     } catch (e) {
//       variantsArray = [];
//     }

//     if (!variantsArray.length) {
//       return res.status(400).json({
//         success: false,
//         message: 'At least one color variant is required'
//       });
//     }

//     // Validate category
//     const category = await Category.findById(categoryId);
//     if (!category) {
//       return res.status(404).json({ success: false, message: 'Category not found' });
//     }

//     const subcategory = category.subcategories.id(subcategoryId);
//     if (!subcategory) {
//       return res.status(404).json({ success: false, message: 'Subcategory not found' });
//     }

//     // Process files
//     const variantImageMap = {};
//     const videoFiles = [];
    
//     if (req.files && Array.isArray(req.files)) {
//       req.files.forEach(file => {
//         if (file.mimetype.startsWith('image/')) {
//           const match = file.fieldname.match(/variant_(\d+)_images/);
//           if (match) {
//             const variantIndex = parseInt(match[1]);
//             if (!variantImageMap[variantIndex]) {
//               variantImageMap[variantIndex] = [];
//             }
//             variantImageMap[variantIndex].push(file);
//           }
//         } else if (file.mimetype.startsWith('video/')) {
//           videoFiles.push(file);
//         }
//       });
//     }

//     console.log('📸 Variant images:', Object.keys(variantImageMap).map(k => `${k}: ${variantImageMap[k].length} images`).join(', '));

//     // Process variants
//     const processedVariants = variantsArray.map((variant, index) => {
//       let variantImages = [];
      
//       if (variantImageMap[index] && variantImageMap[index].length > 0) {
//         variantImages = variantImageMap[index].map(file => 
//           getFileUrl(req, path.basename(file.path), 'products')
//         );
//       }

//       let sizesArray = variant.sizes || [];
//       if (typeof sizesArray === 'string') {
//         try {
//           sizesArray = JSON.parse(sizesArray);
//         } catch (e) {
//           sizesArray = [];
//         }
//       }

//       return {
//         color: variant.color,
//         price: parseFloat(variant.price),
//         discountPrice: variant.discountPrice ? parseFloat(variant.discountPrice) : null,
//         sizes: sizesArray,
//         images: variantImages,
//         isActive: true
//       };
//     });

//     const videoUrls = videoFiles.map(file => 
//       getFileUrl(req, path.basename(file.path), 'products')
//     );

//     let addressesArray = [];
//     if (deliveryAddresses) {
//       try {
//         addressesArray = typeof deliveryAddresses === 'string' ? JSON.parse(deliveryAddresses) : deliveryAddresses;
//       } catch (e) {}
//     }

//     let tagsArray = [];
//     if (tags) {
//       try {
//         tagsArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
//       } catch (e) {}
//     }

//     // Get designer details for creatorDetails
//     const designer = await User.findById(designerId);
    
//     // Handle case when designer not found
//     if (!designer) {
//       return res.status(404).json({
//         success: false,
//         message: 'Designer profile not found. Please complete your profile first.'
//       });
//     }
    
//     const creatorDetails = {
//       name: designer.name || 'Designer',
//       profileImage: designer.profileImage || '',
//       role: 'designer',
//       brandName: designer.brandName || designer.name || 'Designer Brand',
//       shopName: null
//     };

//     const product = new Product({
//       name,
//       description,
//       categoryId,
//       subcategoryId,
//       subcategoryName: subcategory.name,
//       variants: processedVariants,
//       deliveryAddresses: addressesArray,
//       sizeGuide: videoUrls,
//       tags: tagsArray,
//       createdBy: 'designer',
//       creatorId: designerId,
//       creatorDetails,
//       approvalStatus: 'pending',
//       isActive: false
//     });

//     await product.save();

//     return res.status(201).json({
//       success: true,
//       message: 'Product submitted for admin approval',
//       product,
//       requiresApproval: true
//     });

//   } catch (error) {
//     console.error('createDesignerProduct error:', error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || 'Internal server error'
//     });
//   }
// };

// // Update product (designer)
// export const updateDesignerProduct = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const designerId = req.user.id;
//     const {
//       name,
//       description,
//       categoryId,
//       subcategoryId,
//       variants,
//       deliveryAddresses,
//       tags,
//       isActive
//     } = req.body;

//     const product = await Product.findOne({
//       _id: id,
//       creatorId: designerId,
//       createdBy: 'designer'
//     });
    
//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: 'Product not found or you don\'t have access'
//       });
//     }

//     // Don't allow editing if product is approved and active
//     if (product.approvalStatus === 'approved' && product.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: 'Approved products cannot be edited. Please contact admin.'
//       });
//     }

//     // Update basic fields
//     if (name) product.name = name;
//     if (description) product.description = description;
//     if (isActive !== undefined) product.isActive = isActive === 'true';

//     // Update category if changed
//     if (categoryId && categoryId !== product.categoryId.toString()) {
//       const category = await Category.findById(categoryId);
//       if (!category) {
//         return res.status(404).json({ success: false, message: 'Category not found' });
//       }
      
//       if (subcategoryId) {
//         const subcategory = category.subcategories.id(subcategoryId);
//         if (!subcategory) {
//           return res.status(404).json({ success: false, message: 'Subcategory not found' });
//         }
//         product.subcategoryName = subcategory.name;
//         product.subcategoryId = subcategoryId;
//       }
      
//       product.categoryId = categoryId;
//     }

//     // Update variants if provided
//     if (variants) {
//       try {
//         let variantsArray = typeof variants === 'string' ? JSON.parse(variants) : variants;
        
//         const variantImageMap = {};
//         const videoFiles = [];
        
//         if (req.files && Array.isArray(req.files)) {
//           req.files.forEach(file => {
//             if (file.mimetype.startsWith('image/')) {
//               const match = file.fieldname.match(/variant_(\d+)_images/);
//               if (match) {
//                 const variantIndex = parseInt(match[1]);
//                 if (!variantImageMap[variantIndex]) {
//                   variantImageMap[variantIndex] = [];
//                 }
//                 variantImageMap[variantIndex].push(file);
//               }
//             } else if (file.mimetype.startsWith('video/')) {
//               videoFiles.push(file);
//             }
//           });
//         }
        
//         const processedVariants = variantsArray.map((variant, index) => {
//           let variantImages = [];
          
//           if (variantImageMap[index] && variantImageMap[index].length > 0) {
//             variantImages = variantImageMap[index].map(file => 
//               getFileUrl(req, path.basename(file.path), 'products')
//             );
//           } else if (variant.images && Array.isArray(variant.images)) {
//             variantImages = variant.images;
//           }
          
//           let sizesArray = variant.sizes || [];
//           if (typeof sizesArray === 'string') {
//             try {
//               sizesArray = JSON.parse(sizesArray);
//             } catch (e) {
//               sizesArray = [];
//             }
//           }
          
//           return {
//             color: variant.color,
//             price: parseFloat(variant.price),
//             discountPrice: variant.discountPrice ? parseFloat(variant.discountPrice) : null,
//             sizes: sizesArray,
//             images: variantImages,
//             isActive: variant.isActive !== false
//           };
//         });
        
//         product.variants = processedVariants;
        
//         if (videoFiles.length > 0) {
//           const videoUrls = videoFiles.map(file => 
//             getFileUrl(req, path.basename(file.path), 'products')
//           );
//           product.sizeGuide = videoUrls;
//         }
        
//       } catch (e) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid variants format',
//           error: e.message
//         });
//       }
//     }

//     // Update other fields
//     if (deliveryAddresses) {
//       try {
//         product.deliveryAddresses = typeof deliveryAddresses === 'string' 
//           ? JSON.parse(deliveryAddresses) 
//           : deliveryAddresses;
//       } catch (e) {}
//     }

//     if (tags) {
//       try {
//         product.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
//       } catch (e) {}
//     }

//     // Reset approval status if product was rejected
//     if (product.approvalStatus === 'rejected') {
//       product.approvalStatus = 'pending';
//       product.rejectionReason = null;
//     }
//     product.isActive = false;

//     await product.save();

//     return res.status(200).json({
//       success: true,
//       message: 'Product updated and resubmitted for approval',
//       product
//     });

//   } catch (error) {
//     console.error('updateDesignerProduct error:', error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || 'Internal server error'
//     });
//   }
// };

// // Delete product (designer)
// export const deleteDesignerProduct = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const designerId = req.user.id;

//     const product = await Product.findOne({
//       _id: id,
//       creatorId: designerId,
//       createdBy: 'designer'
//     });
    
//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: 'Product not found or you don\'t have access'
//       });
//     }

//     // Delete variant images
//     if (product.variants && product.variants.length) {
//       product.variants.forEach(variant => {
//         if (variant.images && variant.images.length) {
//           variant.images.forEach(image => {
//             if (!image.startsWith('http')) {
//               deleteFile(image);
//             }
//           });
//         }
//       });
//     }

//     // Delete size guide videos
//     if (product.sizeGuide && product.sizeGuide.length) {
//       product.sizeGuide.forEach(video => {
//         if (!video.startsWith('http')) {
//           deleteFile(video);
//         }
//       });
//     }

//     await Product.findByIdAndDelete(id);

//     return res.status(200).json({
//       success: true,
//       message: 'Product deleted successfully'
//     });

//   } catch (error) {
//     console.error('deleteDesignerProduct error:', error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || 'Internal server error'
//     });
//   }
// };

// // Submit product for approval (resubmit rejected product)
// export const submitForApproval = async (req, res) => {
//   try {
//     const { productId } = req.params;
//     const designerId = req.user.id;
    
//     const product = await Product.findOne({ 
//       _id: productId,
//       creatorId: designerId,
//       createdBy: 'designer'
//     });
    
//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: 'Product not found'
//       });
//     }
    
//     if (product.approvalStatus === 'approved') {
//       return res.status(400).json({
//         success: false,
//         message: 'Product is already approved'
//       });
//     }
    
//     product.approvalStatus = 'pending';
//     product.isActive = false;
//     product.rejectionReason = null;
//     await product.save();
    
//     return res.status(200).json({
//       success: true,
//       message: 'Product submitted for approval successfully',
//       product
//     });
    
//   } catch (error) {
//     console.error('submitForApproval error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };

// // Get designer's orders (products sold)
// export const getDesignerOrders = async (req, res) => {
//   try {
//     const designerId = req.user.id;
//     const { page = 1, limit = 20 } = req.query;
    
//     // Get designer's products
//     const designerProducts = await Product.find({ 
//       creatorId: designerId 
//     }).select('_id name');
    
//     const productIds = designerProducts.map(p => p._id);
    
//     if (productIds.length === 0) {
//       return res.status(200).json({
//         success: true,
//         count: 0,
//         total: 0,
//         orders: []
//       });
//     }
    
//     const skip = (parseInt(page) - 1) * parseInt(limit);
    
//     // Find orders containing designer's products
//     const orders = await Order.find({
//       'items.productId': { $in: productIds }
//     })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(parseInt(limit))
//       .populate('userId', 'name email mobile');
    
//     const total = await Order.countDocuments({
//       'items.productId': { $in: productIds }
//     });
    
//     // Transform orders to show only designer's items
//     const transformedOrders = orders.map(order => {
//       const designerItems = order.items.filter(item => 
//         productIds.some(id => id.toString() === item.productId.toString())
//       );
      
//       const designerProductsList = designerItems.map(item => {
//         const product = designerProducts.find(p => p._id.toString() === item.productId.toString());
//         return {
//           productId: item.productId,
//           productName: product?.name || 'Unknown',
//           variant: item.variant,
//           quantity: item.quantity,
//           price: item.price,
//           total: item.price * item.quantity
//         };
//       });
      
//       const totalAmount = designerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
//       return {
//         _id: order._id,
//         orderId: order.orderId,
//         orderStatus: order.orderStatus,
//         paymentStatus: order.paymentStatus,
//         createdAt: order.createdAt,
//         customer: order.userId,
//         items: designerProductsList,
//         totalAmount
//       };
//     });
    
//     return res.status(200).json({
//       success: true,
//       count: transformedOrders.length,
//       total,
//       page: parseInt(page),
//       pages: Math.ceil(total / parseInt(limit)),
//       orders: transformedOrders
//     });
    
//   } catch (error) {
//     console.error('getDesignerOrders error:', error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };


// controllers/designerController.js
import Product from '../Models/Product.js';
import Order from '../Models/Order.js';
import Category from '../Models/Category.js';
import User from '../Models/User.js';
import { getFileUrl, deleteFile } from '../utils/fileUtils.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'olhjk8051perkul94729199s';

// ==================== DESIGNER AUTHENTICATION ====================

// Generate random auth token
const generateAuthToken = () => crypto.randomBytes(32).toString('hex');

// Designer Registration
export const designerRegister = async (req, res) => {
  try {
    const { name, mobile, email, brandName, about } = req.body;

    if (!name || !mobile || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile and email are required'
      });
    }

    // Check if already exists
    const existing = await User.findOne({ $or: [{ mobile }, { email }] });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Mobile number or email already registered'
      });
    }

    const otp = '1234';
    const authToken = generateAuthToken();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const newDesigner = new User({
      name,
      mobile,
      email,
      role: 'Designer',
      brandName: brandName || name,
      about: about || '',
      otp,
      otpExpires,
      authToken,
      authTokenExpires: otpExpires,
      isVerified: false,
    });
    await newDesigner.save();

    console.log(`[Designer Registration OTP for ${mobile}]: ${otp}`);

    return res.status(201).json({
      success: true,
      message: 'OTP sent for verification',
      token: authToken,
    });
  } catch (error) {
    console.error('designerRegister error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Designer Registration OTP
export const designerVerifyRegisterOtp = async (req, res) => {
  try {
    const { mobile, token, otp } = req.body;

    if (!mobile || !token || !otp) {
      return res.status(400).json({ success: false, message: 'mobile, token and otp are required' });
    }

    const user = await User.findOne({ mobile, role: 'Designer' });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Designer not found' });
    }

    if (user.authToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (!user.authTokenExpires || user.authTokenExpires < new Date()) {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }

    if (user.otp !== otp || otp !== '1234') {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    // Clear temp fields
    user.otp = undefined;
    user.otpExpires = undefined;
    user.authToken = undefined;
    user.authTokenExpires = undefined;
    user.isVerified = true;
    await user.save();

    const jwtToken = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Designer registration successful',
      jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        profileImage: user.profileImage,
        brandName: user.brandName,
      },
    });
  } catch (error) {
    console.error('designerVerifyRegisterOtp error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Designer Login Request
export const designerLoginRequest = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const user = await User.findOne({ mobile, role: 'Designer' });

    if (!user) {
      return res.status(404).json({
        success: false,
        exists: false,
        message: 'Designer account not found. Please register as Designer first.',
      });
    }

    const otp = '1234';
    const authToken = generateAuthToken();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    user.authToken = authToken;
    user.authTokenExpires = otpExpires;
    await user.save();

    console.log(`[Designer Login OTP for ${mobile}]: ${otp}`);

    return res.status(200).json({
      success: true,
      exists: true,
      message: 'OTP sent to your mobile number',
      token: authToken,
    });
  } catch (error) {
    console.error('designerLoginRequest error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Designer Login OTP
export const designerVerifyOtp = async (req, res) => {
  try {
    const { mobile, token, otp } = req.body;

    if (!mobile || !token || !otp) {
      return res.status(400).json({ success: false, message: 'mobile, token and otp are required' });
    }

    const user = await User.findOne({ mobile, role: 'Designer' });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Designer not found' });
    }

    if (user.authToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (!user.authTokenExpires || user.authTokenExpires < new Date()) {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }

    if (user.otp !== otp || otp !== '1234') {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    // Clear temp fields
    user.otp = undefined;
    user.otpExpires = undefined;
    user.authToken = undefined;
    user.authTokenExpires = undefined;
    user.isVerified = true;
    await user.save();

    const jwtToken = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Designer login successful',
      jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        profileImage: user.profileImage,
        brandName: user.brandName,
      },
    });
  } catch (error) {
    console.error('designerVerifyOtp error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DESIGNER DASHBOARD & PROFILE ====================

// Get designer dashboard statistics
export const getDesignerStats = async (req, res) => {
  try {
    const designerId = req.user.id;
    
    const totalProducts = await Product.countDocuments({ 
      creatorId: designerId,
      createdBy: 'designer'
    });
    
    const pendingApproval = await Product.countDocuments({ 
      creatorId: designerId,
      approvalStatus: 'pending'
    });
    
    const approvedProducts = await Product.countDocuments({ 
      creatorId: designerId,
      approvalStatus: 'approved',
      isActive: true
    });
    
    const rejectedProducts = await Product.countDocuments({ 
      creatorId: designerId,
      approvalStatus: 'rejected'
    });
    
    // Get designer's products for order calculation
    const designerProducts = await Product.find({ 
      creatorId: designerId 
    }).select('_id');
    
    const productIds = designerProducts.map(p => p._id);
    
    // Get orders containing designer's products
    const orders = await Order.find({
      'items.productId': { $in: productIds }
    });
    
    let totalSales = 0;
    let totalOrders = orders.length;
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (productIds.some(id => id.toString() === item.productId.toString())) {
          totalSales += item.price * item.quantity;
        }
      });
    });
    
    return res.status(200).json({
      success: true,
      data: {
        totalProducts,
        pendingApproval,
        approvedProducts,
        rejectedProducts,
        totalSales,
        totalOrders
      }
    });
    
  } catch (error) {
    console.error('getDesignerStats error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get designer's profile
export const getDesignerProfile = async (req, res) => {
  try {
    const designerId = req.user.id;
    
    const designer = await User.findById(designerId).select('-otp -otpExpires -authToken -authTokenExpires -deleteToken -deleteTokenExpiration');
    
    if (!designer) {
      return res.status(404).json({
        success: false,
        message: 'Designer not found'
      });
    }
    
    const designerObj = designer.toObject();
    if (designerObj.profileImage) {
      const normalizedPath = designerObj.profileImage.replace(/\\/g, '/');
      designerObj.profileImageUrl = `${req.protocol}://${req.get('host')}/${normalizedPath}`;
    }
    
    return res.status(200).json({
      success: true,
      data: designerObj
    });
    
  } catch (error) {
    console.error('getDesignerProfile error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Update designer profile
export const updateDesignerProfile = async (req, res) => {
  try {
    const designerId = req.user.id;
    const { name, email, about, brandName } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (about) updateData.about = about;
    if (brandName) updateData.brandName = brandName;
    
    const designer = await User.findByIdAndUpdate(
      designerId,
      updateData,
      { new: true, runValidators: true }
    ).select('-otp -otpExpires -authToken -authTokenExpires');
    
    if (!designer) {
      return res.status(404).json({
        success: false,
        message: 'Designer not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: designer
    });
    
  } catch (error) {
    console.error('updateDesignerProfile error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DESIGNER PRODUCT MANAGEMENT ====================

// Get all products for designer
export const getDesignerProducts = async (req, res) => {
  try {
    const designerId = req.user.id;
    const { status, page = 1, limit = 20, search } = req.query;
    
    let query = { 
      creatorId: designerId,
      createdBy: 'designer'
    };
    
    if (status === 'pending') query.approvalStatus = 'pending';
    if (status === 'approved') query.approvalStatus = 'approved';
    if (status === 'rejected') query.approvalStatus = 'rejected';
    if (status === 'active') query.isActive = true;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const products = await Product.find(query)
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Product.countDocuments(query);
    
    const transformedProducts = products.map(product => {
      const productObj = product.toObject();
      const firstVariant = productObj.variants?.[0];
      const mainImage = firstVariant?.images?.[0] || productObj.mainImages?.[0] || null;
      
      return {
        _id: productObj._id,
        name: productObj.name,
        description: productObj.description,
        displayPrice: productObj.displayPrice,
        displayActualPrice: productObj.displayActualPrice,
        maxDiscount: productObj.maxDiscount,
        mainImage: mainImage,
        approvalStatus: productObj.approvalStatus,
        isActive: productObj.isActive,
        rejectionReason: productObj.rejectionReason,
        variantsCount: productObj.variants?.length || 0,
        createdAt: productObj.createdAt,
        updatedAt: productObj.updatedAt
      };
    });
    
    return res.status(200).json({
      success: true,
      count: transformedProducts.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      products: transformedProducts
    });
    
  } catch (error) {
    console.error('getDesignerProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get single product by ID for designer
export const getDesignerProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const designerId = req.user.id;
    
    const product = await Product.findOne({ 
      _id: productId,
      creatorId: designerId,
      createdBy: 'designer'
    }).populate('categoryId', 'name');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you don\'t have access'
      });
    }
    
    return res.status(200).json({
      success: true,
      product
    });
    
  } catch (error) {
    console.error('getDesignerProductById error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Create product (designer)
export const createDesignerProduct = async (req, res) => {
  try {
    const designerId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'designer' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only designers can create products'
      });
    }

    const {
      name,
      description,
      categoryId,
      subcategoryId,
      variants,
      deliveryAddresses,
      tags
    } = req.body;

    if (!name || !description || !categoryId || !subcategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, description, categoryId, subcategoryId'
      });
    }

    // Parse variants
    let variantsArray = [];
    try {
      variantsArray = typeof variants === 'string' ? JSON.parse(variants) : variants;
    } catch (e) {
      variantsArray = [];
    }

    if (!variantsArray.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one color variant is required'
      });
    }

    // Validate category
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
      return res.status(404).json({ success: false, message: 'Subcategory not found' });
    }

    // Process files
    const variantImageMap = {};
    const videoFiles = [];
    
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        if (file.mimetype.startsWith('image/')) {
          const match = file.fieldname.match(/variant_(\d+)_images/);
          if (match) {
            const variantIndex = parseInt(match[1]);
            if (!variantImageMap[variantIndex]) {
              variantImageMap[variantIndex] = [];
            }
            variantImageMap[variantIndex].push(file);
          }
        } else if (file.mimetype.startsWith('video/')) {
          videoFiles.push(file);
        }
      });
    }

    console.log('📸 Variant images:', Object.keys(variantImageMap).map(k => `${k}: ${variantImageMap[k].length} images`).join(', '));

    // Process variants
    const processedVariants = variantsArray.map((variant, index) => {
      let variantImages = [];
      
      if (variantImageMap[index] && variantImageMap[index].length > 0) {
        variantImages = variantImageMap[index].map(file => 
          getFileUrl(req, path.basename(file.path), 'products')
        );
      }

      let sizesArray = variant.sizes || [];
      if (typeof sizesArray === 'string') {
        try {
          sizesArray = JSON.parse(sizesArray);
        } catch (e) {
          sizesArray = [];
        }
      }

      return {
        color: variant.color,
        price: parseFloat(variant.price),
        discountPrice: variant.discountPrice ? parseFloat(variant.discountPrice) : null,
        sizes: sizesArray,
        images: variantImages,
        isActive: true
      };
    });

    const videoUrls = videoFiles.map(file => 
      getFileUrl(req, path.basename(file.path), 'products')
    );

    let addressesArray = [];
    if (deliveryAddresses) {
      try {
        addressesArray = typeof deliveryAddresses === 'string' ? JSON.parse(deliveryAddresses) : deliveryAddresses;
      } catch (e) {}
    }

    let tagsArray = [];
    if (tags) {
      try {
        tagsArray = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {}
    }

    // Get designer details
    const designer = await User.findById(designerId);
    
    if (!designer) {
      return res.status(404).json({
        success: false,
        message: 'Designer profile not found. Please complete your profile first.'
      });
    }
    
    const creatorDetails = {
      name: designer.name || 'Designer',
      profileImage: designer.profileImage || '',
      role: 'designer',
      brandName: designer.brandName || designer.name || 'Designer Brand',
      shopName: null
    };

    const product = new Product({
      name,
      description,
      categoryId,
      subcategoryId,
      subcategoryName: subcategory.name,
      variants: processedVariants,
      deliveryAddresses: addressesArray,
      sizeGuide: videoUrls,
      tags: tagsArray,
      createdBy: 'designer',
      creatorId: designerId,
      creatorDetails,
      approvalStatus: 'pending',
      isActive: false
    });

    await product.save();

    return res.status(201).json({
      success: true,
      message: 'Product submitted for admin approval',
      product,
      requiresApproval: true
    });

  } catch (error) {
    console.error('createDesignerProduct error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Update product (designer)
export const updateDesignerProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const designerId = req.user.id;
    const {
      name,
      description,
      categoryId,
      subcategoryId,
      variants,
      deliveryAddresses,
      tags,
      isActive
    } = req.body;

    const product = await Product.findOne({
      _id: id,
      creatorId: designerId,
      createdBy: 'designer'
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you don\'t have access'
      });
    }

    if (product.approvalStatus === 'approved' && product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Approved products cannot be edited. Please contact admin.'
      });
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (isActive !== undefined) product.isActive = isActive === 'true';

    if (categoryId && categoryId !== product.categoryId.toString()) {
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      
      if (subcategoryId) {
        const subcategory = category.subcategories.id(subcategoryId);
        if (!subcategory) {
          return res.status(404).json({ success: false, message: 'Subcategory not found' });
        }
        product.subcategoryName = subcategory.name;
        product.subcategoryId = subcategoryId;
      }
      
      product.categoryId = categoryId;
    }

    if (variants) {
      try {
        let variantsArray = typeof variants === 'string' ? JSON.parse(variants) : variants;
        
        const variantImageMap = {};
        
        if (req.files && Array.isArray(req.files)) {
          req.files.forEach(file => {
            if (file.mimetype.startsWith('image/')) {
              const match = file.fieldname.match(/variant_(\d+)_images/);
              if (match) {
                const variantIndex = parseInt(match[1]);
                if (!variantImageMap[variantIndex]) {
                  variantImageMap[variantIndex] = [];
                }
                variantImageMap[variantIndex].push(file);
              }
            }
          });
        }
        
        const processedVariants = variantsArray.map((variant, index) => {
          let variantImages = [];
          
          if (variantImageMap[index] && variantImageMap[index].length > 0) {
            variantImages = variantImageMap[index].map(file => 
              getFileUrl(req, path.basename(file.path), 'products')
            );
          } else if (variant.images && Array.isArray(variant.images)) {
            variantImages = variant.images;
          }
          
          let sizesArray = variant.sizes || [];
          if (typeof sizesArray === 'string') {
            try {
              sizesArray = JSON.parse(sizesArray);
            } catch (e) {
              sizesArray = [];
            }
          }
          
          return {
            color: variant.color,
            price: parseFloat(variant.price),
            discountPrice: variant.discountPrice ? parseFloat(variant.discountPrice) : null,
            sizes: sizesArray,
            images: variantImages,
            isActive: variant.isActive !== false
          };
        });
        
        product.variants = processedVariants;
        
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid variants format',
          error: e.message
        });
      }
    }

    if (deliveryAddresses) {
      try {
        product.deliveryAddresses = typeof deliveryAddresses === 'string' 
          ? JSON.parse(deliveryAddresses) 
          : deliveryAddresses;
      } catch (e) {}
    }

    if (tags) {
      try {
        product.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {}
    }

    if (product.approvalStatus === 'rejected') {
      product.approvalStatus = 'pending';
      product.rejectionReason = null;
    }
    product.isActive = false;

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product updated and resubmitted for approval',
      product
    });

  } catch (error) {
    console.error('updateDesignerProduct error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Delete product (designer)
export const deleteDesignerProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const designerId = req.user.id;

    const product = await Product.findOne({
      _id: id,
      creatorId: designerId,
      createdBy: 'designer'
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or you don\'t have access'
      });
    }

    if (product.variants && product.variants.length) {
      product.variants.forEach(variant => {
        if (variant.images && variant.images.length) {
          variant.images.forEach(image => {
            if (!image.startsWith('http')) {
              deleteFile(image);
            }
          });
        }
      });
    }

    if (product.sizeGuide && product.sizeGuide.length) {
      product.sizeGuide.forEach(video => {
        if (!video.startsWith('http')) {
          deleteFile(video);
        }
      });
    }

    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('deleteDesignerProduct error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

// Submit product for approval
export const submitForApproval = async (req, res) => {
  try {
    const { productId } = req.params;
    const designerId = req.user.id;
    
    const product = await Product.findOne({ 
      _id: productId,
      creatorId: designerId,
      createdBy: 'designer'
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (product.approvalStatus === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Product is already approved'
      });
    }
    
    product.approvalStatus = 'pending';
    product.isActive = false;
    product.rejectionReason = null;
    await product.save();
    
    return res.status(200).json({
      success: true,
      message: 'Product submitted for approval successfully',
      product
    });
    
  } catch (error) {
    console.error('submitForApproval error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get designer's orders
export const getDesignerOrders = async (req, res) => {
  try {
    const designerId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const designerProducts = await Product.find({ 
      creatorId: designerId 
    }).select('_id name');
    
    const productIds = designerProducts.map(p => p._id);
    
    if (productIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        orders: []
      });
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await Order.find({
      'items.productId': { $in: productIds }
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email mobile');
    
    const total = await Order.countDocuments({
      'items.productId': { $in: productIds }
    });
    
    const transformedOrders = orders.map(order => {
      const designerItems = order.items.filter(item => 
        productIds.some(id => id.toString() === item.productId.toString())
      );
      
      const designerProductsList = designerItems.map(item => {
        const product = designerProducts.find(p => p._id.toString() === item.productId.toString());
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown',
          variant: item.variant,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        };
      });
      
      const totalAmount = designerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      return {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        customer: order.userId,
        items: designerProductsList,
        totalAmount
      };
    });
    
    return res.status(200).json({
      success: true,
      count: transformedOrders.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      orders: transformedOrders
    });
    
  } catch (error) {
    console.error('getDesignerOrders error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};