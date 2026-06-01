// Models/LoginScreenMedia.js
import mongoose from 'mongoose';

const loginScreenMediaSchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

const LoginScreenMedia = mongoose.model('LoginScreenMedia', loginScreenMediaSchema);
export default LoginScreenMedia;