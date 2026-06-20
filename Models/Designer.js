// Models/Designer.js
import mongoose from 'mongoose';

// Designer Wallet Transaction Schema
const designerWalletTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit', 'refund', 'cashback'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  referenceId: {
    type: String,
    default: null
  },
  referenceType: {
    type: String,
    enum: ['product_fee', 'cashback', 'admin', 'recharge', 'refund'],
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  balance: {
    type: Number,
    required: true
  }
}, { timestamps: true });

// Designer Settings Schema
const designerSettingsSchema = new mongoose.Schema({
  productFee: {
    type: Number,
    default: 500
  },
  cashbackPercentage: {
    type: Number,
    default: 60
  },
  salesThresholdForCashback: {
    type: Number,
    default: 100
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Designer Schema
const designerSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  about: {
    type: String,
    maxlength: 5000,
    default: ''
  },
  brandName: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: ''
  },
  
  // Auth
  otp: { type: String },
  otpExpires: { type: Date },
  authToken: { type: String },
  authTokenExpires: { type: Date },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  rejectionReason: {
    type: String,
    default: null
  },
  
  // Wallet
  wallet: {
    balance: {
      type: Number,
      default: 0,
      min: 0
    },
    transactions: [designerWalletTransactionSchema],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  
  // Products
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // Stats
  totalProductsAdded: {
    type: Number,
    default: 0
  },
  totalProductsSold: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  productFeePaid: {
    type: Number,
    default: 0
  },
  cashbackReceived: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Designer = mongoose.model('Designer', designerSchema);

// ✅ Fixed: Designer Settings Model (Only one declaration)
const DesignerSettings = mongoose.model('DesignerSettings', designerSettingsSchema);

export { Designer, DesignerSettings };