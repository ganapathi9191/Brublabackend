// // Models/User.js
// import mongoose from 'mongoose';

// // Address Schema
// const addressSchema = new mongoose.Schema({
//   type: {
//     type: String,
//     enum: ['home', 'work', 'other'],
//     default: 'home'
//   },
//   fullName: {
//     type: String,
//     required: true
//   },
//   mobile: {
//     type: String,
//     required: true
//   },
//   pincode: {
//     type: String,
//     required: true
//   },
//   address: {
//     type: String,
//     required: true
//   },
//   city: {
//     type: String,
//     required: true
//   },
//   state: {
//     type: String,
//     required: true
//   },
//   landmark: {
//     type: String
//   },
//   isDefault: {
//     type: Boolean,
//     default: false
//   }
// }, {
//   timestamps: true
// });

// // Live Location Schema
// const liveLocationSchema = new mongoose.Schema({
//   latitude: {
//     type: Number,
//     required: true
//   },
//   longitude: {
//     type: Number,
//     required: true
//   },
//   address: {
//     type: String
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Cart Item Schema
// const cartItemSchema = new mongoose.Schema({
//   productId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Product',
//     required: true
//   },
//   variantId: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: true
//   },
//   sizeId: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: true
//   },
//   variant: {
//     color: String,
//     size: String,
//     actualPrice: Number,
//     discountPrice: Number,
//     mainImage: String
//   },
//   quantity: {
//     type: Number,
//     required: true,
//     min: 1,
//     default: 1
//   },
//   price: {
//     type: Number,
//     required: true
//   },
//   addedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Main User Schema
// const userSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     trim: true
//   },
//   email: {
//     type: String,
//     lowercase: true,
//     trim: true
//   },
//   mobile: {
//     type: String,
//     unique: true,
//     sparse: true,
//     trim: true
//   },
//   about: {
//     type: String,
//     maxlength: 5000,
//     default: ''
//   },
//   otp: {
//     type: String
//   },
//   otpExpires: {
//     type: Date
//   },
//   role: {
//     type: String,
//     enum: ['Tailor', 'Designer', 'User', 'Stylist'],
//     default: 'User'
//   },
//   profileImage: {
//     type: String
//   },
//   designerProfileImg: {
//     type: String
//   },
//   startingPrice: {
//     type: Number
//   },
//   addresses: [addressSchema],
//   liveLocation: liveLocationSchema,
//   wishlist: [
//     {
//       productId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Product'
//       },
//       addedAt: {
//         type: Date,
//         default: Date.now
//       }
//     }
//   ],
//   cart: [cartItemSchema],
//   notifications: [
//     {
//       message: String,
//       type: {
//         type: String,
//         enum: ['info', 'success', 'warning', 'error'],
//         default: 'info'
//       },
//       isRead: {
//         type: Boolean,
//         default: false
//       },
//       createdAt: {
//         type: Date,
//         default: Date.now
//       }
//     }
//   ],
//   deleteToken: {
//     type: String
//   },
//   deleteTokenExpiration: {
//     type: Date
//   },
//   authToken: {
//     type: String
//   },
//   authTokenExpires: {
//     type: Date
//   },
//   isVerified: {
//     type: Boolean,
//     default: false
//   }
// }, {
//   timestamps: true
// });


// const User = mongoose.model('User', userSchema);
// export default User;


// Models/User.js - Complete with wallet
import mongoose from 'mongoose';

// Address Schema
const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  },
  fullName: { type: String, required: true },
  mobile: { type: String, required: true },
  pincode: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  landmark: { type: String },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

// Live Location Schema
const liveLocationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  address: { type: String },
  updatedAt: { type: Date, default: Date.now }
});

// Cart Item Schema
const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sizeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  variant: {
    color: String,
    size: String,
    actualPrice: Number,
    discountPrice: Number,
    mainImage: String
  },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  price: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now }
});

// Wallet Transaction Schema
const walletTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit', 'refund', 'cashback'],
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
  description: { type: String, required: true },
  referenceId: { type: String, default: null },
  referenceType: {
    type: String,
    enum: ['order', 'payment', 'refund', 'cashback', 'admin', 'recharge'],
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  balance: { type: Number, required: true }
}, { timestamps: true });

// Main User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  mobile: { type: String, unique: true, sparse: true, trim: true },
  about: { type: String, maxlength: 5000, default: '' },
  otp: { type: String },
  otpExpires: { type: Date },
  role: {
    type: String,
    enum: ['Tailor', 'Designer', 'User', 'Stylist'],
    default: 'User'
  },
  profileImage: { type: String },
  designerProfileImg: { type: String },
  startingPrice: { type: Number },
  brandName: { type: String },
  addresses: [addressSchema],
  liveLocation: liveLocationSchema,
  
  // Wishlist
  wishlist: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    addedAt: { type: Date, default: Date.now }
  }],
  
  // Cart
  cart: [cartItemSchema],
  
  // Wallet (Simplified)
  wallet: {
    balance: { type: Number, default: 0, min: 0 },
    transactions: [walletTransactionSchema],
    isActive: { type: Boolean, default: true }
  },
  
  // Notifications
  notifications: [{
    message: String,
    type: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Auth
  deleteToken: { type: String },
  deleteTokenExpiration: { type: Date },
  authToken: { type: String },
  authTokenExpires: { type: Date },
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;