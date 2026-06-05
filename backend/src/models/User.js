const mongoose = require('mongoose');
const USER_ROLES = ['admin', 'resident', 'guest'];
const UserSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
      select: false,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: USER_ROLES,
      default: 'resident',
      index: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    last_login_at: {
      type: Date,
      default: null,
    },
    fcm_token: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('User', UserSchema);
