// Models/RecommendedProduct.js
import mongoose from 'mongoose';

const recommendedProductSchema = new mongoose.Schema({
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

const RecommendedProduct = mongoose.model('RecommendedProduct', recommendedProductSchema);
export default RecommendedProduct;