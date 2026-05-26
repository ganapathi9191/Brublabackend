// // Models/Product.js
// import mongoose from 'mongoose';

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
//   // No images array in review
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

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
//   price: {
//     type: Number,
//     required: true
//   },
//   discountPrice: {
//     type: Number,
//     default: null
//   },
  
//   // Category and Subcategory
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
  
//   // Images (Array of images)
//   images: [{
//     type: String,
//     required: true
//   }],
  
//   // Sizes (String array)
//   sizes: [{
//     type: String,
//     enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Custom'],
//     default: 'M'
//   }],
  
//   // Size Guide (Array of videos)
//   sizeGuide: [{
//     type: String, // Video URLs
//     validate: {
//       validator: function(v) {
//         return /\.(mp4|mov|webm|avi)$/i.test(v) || v.startsWith('http');
//       },
//       message: 'Invalid video format'
//     }
//   }],
  
//   // Delivery Addresses (Array of strings)
//   deliveryAddresses: [{
//     type: String,
//     required: true
//   }],
  
//   // Designer Information (Only if product created by designer)
//   designerInfo: {
//     designerId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     },
//     designerName: {
//       type: String
//     },
//     designerImage: {
//       type: String
//     },
//     isDesignerProduct: {
//       type: Boolean,
//       default: false
//     }
//   },
  
//   // Reviews
//   reviews: [reviewSchema],
  
//   // Average Rating
//   averageRating: {
//     type: Number,
//     default: 0
//   },
  
//   // Product Status
//   isActive: {
//     type: Boolean,
//     default: true
//   },
  
//   // Stock
//   stock: {
//     type: Number,
//     default: 0
//   },
  
//   // Created by (Admin or Designer)
//   createdBy: {
//     type: String,
//     enum: ['admin', 'designer'],
//     required: true
//   },
  
//   // Admin who created/modified
//   adminId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Admin'
//   }
// }, {
//   timestamps: true
// });

// // Index for better query performance
// productSchema.index({ categoryId: 1, subcategoryId: 1 });
// productSchema.index({ createdBy: 1 });
// productSchema.index({ isActive: 1 });
// productSchema.index({ averageRating: -1 });

// // Method to calculate average rating
// productSchema.methods.calculateAverageRating = function() {
//   if (this.reviews.length === 0) {
//     this.averageRating = 0;
//   } else {
//     const sum = this.reviews.reduce((total, review) => total + review.rating, 0);
//     this.averageRating = sum / this.reviews.length;
//   }
//   return this.averageRating;
// };

// export default mongoose.model('Product', productSchema);



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

// Product Variant Schema
const productVariantSchema = new mongoose.Schema({
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  size: {
    type: String,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Custom'],
    required: true
  },
  actualPrice: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: {
    type: Number,
    default: null,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  mainImage: {
    type: String,
    default: ''
  },
  images: [{
    type: String
  }],
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
  
  // Pricing (derived from variants)
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
  
  // Variants
  variants: [productVariantSchema],
  
  // Media
  sizeGuide: [{
    type: String
  }],
  
  // Delivery Information
  deliveryAddresses: [{
    type: String,
    required: true
  }],
  
  // Creator Information
  createdBy: {
    type: String,
    enum: ['admin', 'designer', 'tailor'],
    required: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Creator Details (denormalized)
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
  
  // Reviews & Ratings
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

// Indexes
productSchema.index({ categoryId: 1, subcategoryId: 1 });
productSchema.index({ createdBy: 1, creatorId: 1 });
productSchema.index({ approvalStatus: 1, isActive: 1 });
productSchema.index({ 'variants.sku': 1 });

// Pre-save middleware
productSchema.pre('save', function(next) {
  // Calculate display prices from variants
  if (this.variants && this.variants.length > 0) {
    let lowestPrice = Infinity;
    let lowestActualPrice = Infinity;
    let maxDiscountPercent = 0;
    
    this.variants.forEach(variant => {
      const currentPrice = variant.discountPrice || variant.actualPrice;
      if (currentPrice < lowestPrice) {
        lowestPrice = currentPrice;
        lowestActualPrice = variant.actualPrice;
      }
      
      // Calculate discount percentage
      if (variant.discountPrice && variant.discountPrice < variant.actualPrice) {
        const discount = Math.round(((variant.actualPrice - variant.discountPrice) / variant.actualPrice) * 100);
        if (discount > maxDiscountPercent) maxDiscountPercent = discount;
      }
    });
    
    this.displayPrice = lowestPrice;
    this.displayActualPrice = lowestActualPrice;
    this.maxDiscount = maxDiscountPercent;
  }
  
  // Auto-generate SKU if not provided
  this.variants.forEach(variant => {
    if (!variant.sku) {
      const productPrefix = this.name.substring(0, 3).toUpperCase();
      const colorPrefix = variant.color.substring(0, 3).toUpperCase();
      variant.sku = `${productPrefix}-${colorPrefix}-${variant.size}-${Date.now()}`;
    }
  });
  
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

// Update average rating when reviews change
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
productSchema.methods.hasStock = function(variantId, quantity = 1) {
  const variant = this.variants.id(variantId);
  return variant && variant.stock >= quantity;
};

productSchema.methods.reduceStock = function(variantId, quantity = 1) {
  const variant = this.variants.id(variantId);
  if (variant && variant.stock >= quantity) {
    variant.stock -= quantity;
    return true;
  }
  return false;
};

// Virtuals
productSchema.virtual('availableColors').get(function() {
  return [...new Set(this.variants.filter(v => v.stock > 0).map(v => v.color))];
});

productSchema.virtual('availableSizes').get(function() {
  return [...new Set(this.variants.filter(v => v.stock > 0).map(v => v.size))];
});

productSchema.virtual('totalStock').get(function() {
  return this.variants.reduce((total, variant) => total + variant.stock, 0);
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

const Product = mongoose.model('Product', productSchema);
export default Product;