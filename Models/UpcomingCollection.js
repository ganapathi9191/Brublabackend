// models/UpcomingCollection.js
import mongoose from 'mongoose';

const upcomingCollectionSchema = new mongoose.Schema({
  collectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection',
    required: true
  },
  goLiveDateTime: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const UpcomingCollection = mongoose.model('UpcomingCollection', upcomingCollectionSchema);
export default UpcomingCollection;