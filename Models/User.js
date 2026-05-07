import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    lowercase: true,
    // No index here
  },
  mobile: {
    type: String,
    unique: true,
    sparse: true,
  },
  otp: {
    type: String,
  },
  otpExpires: {
    type: Date,
  },
  password: {
    type: String,
  },
  confirmPassword: {
    type: String,
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

const User = mongoose.model('User', userSchema);
export default User;