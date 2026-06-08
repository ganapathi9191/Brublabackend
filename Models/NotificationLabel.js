// Models/NotificationLabel.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  notifications: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const NotificationLabel = mongoose.model('NotificationLabel', notificationSchema);
export default NotificationLabel;