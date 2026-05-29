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

// const userSchema = new mongoose.Schema({
//   name: {
//     type: String,
//   },
//   email: {
//     type: String,
//     lowercase: true,
//   },
//   mobile: {
//     type: String,
//     unique: true,
//     sparse: true,
//   },
//   about: {
//     type: String,
//     maxlength: 5000,
//     default: ''
//   },
//   otp: {
//     type: String,
//   },
//   otpExpires: {
//     type: Date,
//   },
//   role: {
//     type: String,
//     enum: ['Tailor', 'Designer', 'User', 'Stylist'],
//     default: 'User',
//   },
//   profileImage: {
//     type: String,
//   },
//   designerProfileImg: {
//     type: String,
//   },
//   startingPrice: {
//     type: Number,
//   },
//   addresses: [addressSchema],
//   liveLocation: liveLocationSchema,
//   wishlist: [
//     {
//       productId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Product',
//       },
//         addedAt: {
//         type: Date,
//         default: Date.now,
//       }
//     }
//   ],
//   notifications: [
//     {
//       message: String,
//       createdAt: {
//         type: Date,
//         default: Date.now,
//       },
//     },
//   ],
//   deleteToken: {
//     type: String,
//   },
//   deleteTokenExpiration: {
//     type: Date,
//   },
//   authToken: {
//     type: String,
//   },
//   authTokenExpires: {
//     type: Date,
//   },
//   isVerified: {
//     type: Boolean,
//     default: false,
//   },
// }, {
//   timestamps: true,
// });

// // Add to userSchema in Models/User.js

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

// // Order Item Schema
// const orderItemSchema = new mongoose.Schema({
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
//     required: true
//   },
//   price: {
//     type: Number,
//     required: true
//   },
//   status: {
//     type: String,
//     enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
//     default: 'pending'
//   }
// });

// // Order Schema
// const orderSchema = new mongoose.Schema({
//   orderId: {
//     type: String,
//     unique: true,
//     required: true
//   },
//   items: [orderItemSchema],
//   totalAmount: {
//     type: Number,
//     required: true
//   },
//   discountAmount: {
//     type: Number,
//     default: 0
//   },
//   finalAmount: {
//     type: Number,
//     required: true
//   },
//   deliveryAddress: {
//     type: addressSchema,
//     required: true
//   },
//   paymentMethod: {
//     type: String,
//     enum: ['cod', 'card', 'upi', 'netbanking'],
//     required: true
//   },
//   paymentStatus: {
//     type: String,
//     enum: ['pending', 'completed', 'failed', 'refunded'],
//     default: 'pending'
//   },
//   orderStatus: {
//     type: String,
//     enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
//     default: 'pending'
//   },
//   trackingId: String,
//   estimatedDelivery: Date,
//   deliveredAt: Date,
//   cancelledAt: Date,
//   cancellationReason: String,
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Add to userSchema
// userSchema.add({
//   cart: [cartItemSchema],
//   orders: [orderSchema]
// });

// // Also add to indexes
// userSchema.index({ 'cart.productId': 1 });
// userSchema.index({ 'orders.createdAt': -1 });
// userSchema.index({ 'orders.orderStatus': 1 });

// // Define all indexes here to avoid duplicates
// userSchema.index({ email: 1 });
// userSchema.index({ mobile: 1 }, { unique: true, sparse: true });
// userSchema.index({ role: 1 });
// userSchema.index({ createdAt: -1 });
// userSchema.index({ 'addresses.isDefault': 1 });
// userSchema.index({ 'liveLocation.updatedAt': -1 });

// const User = mongoose.model('User', userSchema);
// export default User;


// Models/User.js
import mongoose from 'mongoose';

// Address Schema
const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  },
  fullName: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: true
  },
  pincode: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  landmark: {
    type: String
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Live Location Schema
const liveLocationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  address: {
    type: String
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Cart Item Schema
const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  sizeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  variant: {
    color: String,
    size: String,
    actualPrice: Number,
    discountPrice: Number,
    mainImage: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// Main User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  mobile: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  about: {
    type: String,
    maxlength: 5000,
    default: ''
  },
  otp: {
    type: String
  },
  otpExpires: {
    type: Date
  },
  role: {
    type: String,
    enum: ['Tailor', 'Designer', 'User', 'Stylist'],
    default: 'User'
  },
  profileImage: {
    type: String
  },
  designerProfileImg: {
    type: String
  },
  startingPrice: {
    type: Number
  },
  addresses: [addressSchema],
  liveLocation: liveLocationSchema,
  wishlist: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  cart: [cartItemSchema],
  notifications: [
    {
      message: String,
      type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info'
      },
      isRead: {
        type: Boolean,
        default: false
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  deleteToken: {
    type: String
  },
  deleteTokenExpiration: {
    type: Date
  },
  authToken: {
    type: String
  },
  authTokenExpires: {
    type: Date
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});


const User = mongoose.model('User', userSchema);
export default User;