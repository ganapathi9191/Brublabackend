// Models/Product.js
import mongoose from 'mongoose';

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
  // No images array in review
  createdAt: {
    type: Date,
    default: Date.now
  }
});

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
  price: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number,
    default: null
  },
  
  // Category and Subcategory
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
  
  // Images (Array of images)
  images: [{
    type: String,
    required: true
  }],
  
  // Sizes (String array)
  sizes: [{
    type: String,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Custom'],
    default: 'M'
  }],
  
  // Size Guide (Array of videos)
  sizeGuide: [{
    type: String, // Video URLs
    validate: {
      validator: function(v) {
        return /\.(mp4|mov|webm|avi)$/i.test(v) || v.startsWith('http');
      },
      message: 'Invalid video format'
    }
  }],
  
  // Delivery Addresses (Array of strings)
  deliveryAddresses: [{
    type: String,
    required: true
  }],
  
  // Designer Information (Only if product created by designer)
  designerInfo: {
    designerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    designerName: {
      type: String
    },
    designerImage: {
      type: String
    },
    isDesignerProduct: {
      type: Boolean,
      default: false
    }
  },
  
  // Reviews
  reviews: [reviewSchema],
  
  // Average Rating
  averageRating: {
    type: Number,
    default: 0
  },
  
  // Product Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Stock
  stock: {
    type: Number,
    default: 0
  },
  
  // Created by (Admin or Designer)
  createdBy: {
    type: String,
    enum: ['admin', 'designer'],
    required: true
  },
  
  // Admin who created/modified
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Index for better query performance
productSchema.index({ categoryId: 1, subcategoryId: 1 });
productSchema.index({ createdBy: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ averageRating: -1 });

// Method to calculate average rating
productSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.averageRating = 0;
  } else {
    const sum = this.reviews.reduce((total, review) => total + review.rating, 0);
    this.averageRating = sum / this.reviews.length;
  }
  return this.averageRating;
};

export default mongoose.model('Product', productSchema);