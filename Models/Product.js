
// // Models/Product.js
// import mongoose from 'mongoose';

// // Review Schema
// const reviewSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   userName: {
//     type: String,
//     required: true
//   },
//   userImage: {
//     type: String,
//     default: ''
//   },
//   rating: {
//     type: Number,
//     required: true,
//     min: 1,
//     max: 5
//   },
//   description: {
//     type: String,
//     required: true
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Size Schema
// const sizeSchema = new mongoose.Schema({
//   size: {
//     type: String,
//     enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Custom'],
//     required: true
//   },
//   stock: {
//     type: Number,
//     required: true,
//     default: 0,
//     min: 0
//   }
// });

// // Color Variant Schema
// const colorVariantSchema = new mongoose.Schema({
//   color: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0
//   },
//   discountPrice: {
//     type: Number,
//     default: null,
//     min: 0
//   },
//   sizes: [sizeSchema],
//   images: [{
//     type: String
//   }],
//   sku: {
//     type: String,
//     unique: true,
//     sparse: true,
//     trim: true
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   }
// });

// // Main Product Schema
// const productSchema = new mongoose.Schema({
//   // Basic Information
//   name: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   description: {
//     type: String,
//     required: true
//   },
  
//   // Category Information
//   categoryId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Category',
//     required: true
//   },
//   subcategoryId: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: true
//   },
//   subcategoryName: {
//     type: String,
//     required: true
//   },
  
//   // Color Variants
//   variants: [colorVariantSchema],
  
//   // Main Images (first image from each variant)
//   mainImages: [{
//     type: String
//   }],
  
//   // Media
//   sizeGuide: [{
//     type: String
//   }],
  
//   // Delivery Information
//   deliveryAddresses: [{
//     type: String,
//     required: true
//   }],
  
//   // Pricing (derived)
//   displayPrice: {
//     type: Number,
//     default: 0
//   },
//   displayActualPrice: {
//     type: Number,
//     default: 0
//   },
//   maxDiscount: {
//     type: Number,
//     default: 0
//   },
  
//   // Creator Information
//   createdBy: {
//     type: String,
//     enum: ['admin', 'designer', 'tailor'],
//     required: true
//   },
//   creatorId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   creatorDetails: {
//     name: String,
//     profileImage: String,
//     role: String,
//     brandName: String,
//     shopName: String
//   },
  
//   // Approval Workflow
//   approvalStatus: {
//     type: String,
//     enum: ['pending', 'approved', 'rejected', 'not_required'],
//     default: 'not_required'
//   },
//   rejectionReason: {
//     type: String
//   },
  
//   // Reviews
//   reviews: [reviewSchema],
//   averageRating: {
//     type: Number,
//     default: 0
//   },
  
//   // Status
//   isActive: {
//     type: Boolean,
//     default: true
//   },
  
//   // Tags
//   tags: [{
//     type: String,
//     trim: true
//   }]
// }, {
//   timestamps: true
// });

// // Indexes
// productSchema.index({ categoryId: 1, subcategoryId: 1 });
// productSchema.index({ createdBy: 1, creatorId: 1 });
// productSchema.index({ approvalStatus: 1, isActive: 1 });
// productSchema.index({ 'variants.sku': 1 });

// // Pre-save middleware
// productSchema.pre('save', function(next) {
//   // Calculate display prices
//   if (this.variants && this.variants.length > 0) {
//     let lowestPrice = Infinity;
//     let lowestActualPrice = Infinity;
//     let maxDiscountPercent = 0;
//     const mainImagesArray = [];
    
//     this.variants.forEach(variant => {
//       const currentPrice = variant.discountPrice || variant.price;
//       if (currentPrice < lowestPrice) {
//         lowestPrice = currentPrice;
//         lowestActualPrice = variant.price;
//       }
      
//       if (variant.discountPrice && variant.discountPrice < variant.price) {
//         const discount = Math.round(((variant.price - variant.discountPrice) / variant.price) * 100);
//         if (discount > maxDiscountPercent) maxDiscountPercent = discount;
//       }
      
//       // Generate SKU
//       if (!variant.sku) {
//         const productPrefix = this.name.substring(0, 3).toUpperCase();
//         const colorPrefix = variant.color.substring(0, 3).toUpperCase();
//         variant.sku = `${productPrefix}-${colorPrefix}-${Date.now()}`;
//       }
      
//       // Collect main images
//       if (variant.images && variant.images.length > 0) {
//         mainImagesArray.push(variant.images[0]);
//       }
//     });
    
//     this.displayPrice = lowestPrice;
//     this.displayActualPrice = lowestActualPrice;
//     this.maxDiscount = maxDiscountPercent;
//     this.mainImages = mainImagesArray;
//   }
  
//   // Set approval status for new products
//   if (this.isNew) {
//     if (this.createdBy === 'admin') {
//       this.approvalStatus = 'not_required';
//       this.isActive = true;
//     } else {
//       this.approvalStatus = 'pending';
//       this.isActive = false;
//     }
//   }
  
//   next();
// });

// // Update average rating
// productSchema.pre('save', function(next) {
//   if (this.reviews && this.reviews.length > 0) {
//     const sum = this.reviews.reduce((total, review) => total + review.rating, 0);
//     this.averageRating = sum / this.reviews.length;
//   } else {
//     this.averageRating = 0;
//   }
//   next();
// });

// // Instance Methods
// productSchema.methods.reduceStock = function(variantIndex, sizeIndex, quantity = 1) {
//   const variant = this.variants[variantIndex];
//   if (!variant) return false;
//   const sizeObj = variant.sizes[sizeIndex];
//   if (sizeObj && sizeObj.stock >= quantity) {
//     sizeObj.stock -= quantity;
//     return true;
//   }
//   return false;
// };

// // Virtuals
// productSchema.virtual('availableColors').get(function() {
//   return this.variants.filter(v => v.isActive).map(v => v.color);
// });

// productSchema.virtual('availableSizes').get(function() {
//   const sizesSet = new Set();
//   this.variants.forEach(variant => {
//     variant.sizes.forEach(size => {
//       if (size.stock > 0) sizesSet.add(size.size);
//     });
//   });
//   return [...sizesSet];
// });

// productSchema.virtual('totalStock').get(function() {
//   let total = 0;
//   this.variants.forEach(variant => {
//     variant.sizes.forEach(size => {
//       total += size.stock;
//     });
//   });
//   return total;
// });

// productSchema.set('toJSON', { virtuals: true });
// productSchema.set('toObject', { virtuals: true });

// const Product = mongoose.model('Product', productSchema);
// export default Product;


// Models/Product.js
import mongoose from 'mongoose';

// Review Schema
const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userImage: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Size Schema
const sizeSchema = new mongoose.Schema({
  size: {
    type: String,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Custom'],
    required: true
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  }
});

// Color Variant Schema
const colorVariantSchema = new mongoose.Schema({
  color: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: {
    type: Number,
    default: null,
    min: 0
  },
  sizes: [sizeSchema],
  images: [{
    type: String
  }],
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Main Product Schema
const productSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Category Information
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subcategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  subcategoryName: {
    type: String,
    required: true
  },
  
  // Color Variants
  variants: [colorVariantSchema],
  
  // Main Images (first image from each variant)
  mainImages: [{
    type: String
  }],
  
  // Media
  sizeGuide: [{
    type: String
  }],
  
  // Delivery Information
  deliveryAddresses: [{
    type: String,
    required: true
  }],
  
  // Pricing (derived)
  displayPrice: {
    type: Number,
    default: 0
  },
  displayActualPrice: {
    type: Number,
    default: 0
  },
  maxDiscount: {
    type: Number,
    default: 0
  },
  
  // Creator Information
  createdBy: {
    type: String,
    enum: ['admin', 'designer', 'tailor', 'Stylist'],
    required: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creatorDetails: {
    name: String,
    profileImage: String,
    role: String,
    brandName: String,
    shopName: String
  },
  
  // Approval Workflow
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_required'],
    default: 'not_required'
  },
  rejectionReason: {
    type: String
  },
  
  // Reviews
  reviews: [reviewSchema],
  averageRating: {
    type: Number,
    default: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Tags
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});


// Pre-save middleware
productSchema.pre('save', function(next) {
  // Calculate display prices
  if (this.variants && this.variants.length > 0) {
    let lowestPrice = Infinity;
    let lowestActualPrice = Infinity;
    let maxDiscountPercent = 0;
    const mainImagesArray = [];
    
    this.variants.forEach(variant => {
      const currentPrice = variant.discountPrice || variant.price;
      if (currentPrice < lowestPrice) {
        lowestPrice = currentPrice;
        lowestActualPrice = variant.price;
      }
      
      if (variant.discountPrice && variant.discountPrice < variant.price) {
        const discount = Math.round(((variant.price - variant.discountPrice) / variant.price) * 100);
        if (discount > maxDiscountPercent) maxDiscountPercent = discount;
      }
      
      // Generate SKU
      if (!variant.sku) {
        const productPrefix = this.name.substring(0, 3).toUpperCase();
        const colorPrefix = variant.color.substring(0, 3).toUpperCase();
        variant.sku = `${productPrefix}-${colorPrefix}-${Date.now()}`;
      }
      
      // Collect main images
      if (variant.images && variant.images.length > 0) {
        mainImagesArray.push(variant.images[0]);
      }
    });
    
    this.displayPrice = lowestPrice;
    this.displayActualPrice = lowestActualPrice;
    this.maxDiscount = maxDiscountPercent;
    this.mainImages = mainImagesArray;
  }
  
  // Set approval status for new products
  if (this.isNew) {
    if (this.createdBy === 'admin') {
      this.approvalStatus = 'not_required';
      this.isActive = true;
    } else {
      this.approvalStatus = 'pending';
      this.isActive = false;
    }
  }
  
  next();
});

// Update average rating
productSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const sum = this.reviews.reduce((total, review) => total + review.rating, 0);
    this.averageRating = sum / this.reviews.length;
  } else {
    this.averageRating = 0;
  }
  next();
});

// Instance Methods
productSchema.methods.reduceStock = function(variantIndex, sizeIndex, quantity = 1) {
  const variant = this.variants[variantIndex];
  if (!variant) return false;
  const sizeObj = variant.sizes[sizeIndex];
  if (sizeObj && sizeObj.stock >= quantity) {
    sizeObj.stock -= quantity;
    return true;
  }
  return false;
};

// Virtuals
productSchema.virtual('availableColors').get(function() {
  if (!this.variants || !Array.isArray(this.variants)) return [];
  return [...new Set(this.variants.filter(v => v && v.stock > 0).map(v => v.color))];
});

productSchema.virtual('availableSizes').get(function() {
  if (!this.variants || !Array.isArray(this.variants)) return [];
  const sizesSet = new Set();
  this.variants.forEach(variant => {
    if (variant && variant.sizes && Array.isArray(variant.sizes)) {
      variant.sizes.forEach(size => {
        if (size && size.stock > 0) sizesSet.add(size.size);
      });
    }
  });
  return [...sizesSet];
});

productSchema.virtual('totalStock').get(function() {
  if (!this.variants || !Array.isArray(this.variants)) return 0;
  let total = 0;
  this.variants.forEach(variant => {
    if (variant && variant.sizes && Array.isArray(variant.sizes)) {
      variant.sizes.forEach(size => {
        if (size && size.stock) total += size.stock;
      });
    }
  });
  return total;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model('Product', productSchema);
export default Product;