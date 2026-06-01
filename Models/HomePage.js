// Models/HomePage.js
import mongoose from 'mongoose';

// Hero Section Schema
const heroSectionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Banner Section Schema
const bannerSectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  buttonText: {
    type: String,
    default: 'Shop Now'
  },
  image: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Main Home Page Schema
const homePageSchema = new mongoose.Schema({
  heroSections: [heroSectionSchema],
  banners: [bannerSectionSchema]
}, {
  timestamps: true
});

const HomePage = mongoose.model('HomePage', homePageSchema);
export default HomePage;