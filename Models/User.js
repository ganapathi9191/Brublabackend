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

const userSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    lowercase: true,
  },
  mobile: {
    type: String,
    unique: true,
    sparse: true,
  },
  about: {
    type: String,
    maxlength: 5000,
    default: ''
  },
  otp: {
    type: String,
  },
  otpExpires: {
    type: Date,
  },
  role: {
    type: String,
    enum: ['Tailor', 'Designer', 'User', 'Stylist'],
    default: 'User',
  },
  profileImage: {
    type: String,
  },
  designerProfileImg: {
    type: String,
  },
  startingPrice: {
    type: Number,
  },
  addresses: [addressSchema],
  liveLocation: liveLocationSchema,
  wishlist: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  notifications: [
    {
      message: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  deleteToken: {
    type: String,
  },
  deleteTokenExpiration: {
    type: Date,
  },
  authToken: {
    type: String,
  },
  authTokenExpires: {
    type: Date,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Define all indexes here to avoid duplicates
userSchema.index({ email: 1 });
userSchema.index({ mobile: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'addresses.isDefault': 1 });
userSchema.index({ 'liveLocation.updatedAt': -1 });

const User = mongoose.model('User', userSchema);
export default User;