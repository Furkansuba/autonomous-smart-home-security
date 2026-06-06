const mongoose = require('mongoose');
const crypto = require('crypto');

const AdminKeySchema = new mongoose.Schema(
  {
    key_hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    device_id: {
      type: String,
      trim: true,
      default: null,
    },
    is_used: {
      type: Boolean,
      default: false,
      index: true,
    },
    used_by: {
      type: String,
      default: null,
    },
    used_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// SHA-256 of the plain key — deterministic, allows O(1) lookup, safe against DB dump
AdminKeySchema.statics.hashKey = function hashKey(plainKey) {
  return crypto.createHash('sha256').update(String(plainKey).trim()).digest('hex');
};

module.exports = mongoose.model('AdminKey', AdminKeySchema);
