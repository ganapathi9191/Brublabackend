import mongoose from 'mongoose';

const { Schema } = mongoose;


// User Schema without required and trim
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    // Removed 'required' and 'trim'
  },
  email: {
    type: String,
    lowercase: true,
  },
  mobile: {
    type: String,
  },
  otp: {
    type: String,
  },
  password: {
  type: String,
},
confirmPassword: {
  type: String,
},

otpExpires: {
  type: Date
},
role: {
  type: String
},

profileImage: {
  type: String
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
    ref: "User", // designer bhi user hi hai
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


 // ✅ Delete account fields
  deleteToken: {
    type: String,
  },
  deleteTokenExpiration: {
    type: Date,
  },
}, {
  timestamps: true  // CreatedAt and UpdatedAt fields automatically
});

// Create model based on schema
const User = mongoose.model('User', userSchema);

export default User;
