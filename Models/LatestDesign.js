import mongoose from 'mongoose';

const latestDesignSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const LatestDesign = mongoose.model('LatestDesign', latestDesignSchema);
export default LatestDesign;