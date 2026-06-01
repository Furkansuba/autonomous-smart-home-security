const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  DEVICE_STATUSES,
} = require('../validators/contract.constants');
const deviceSchema = new Schema(
  {
    device_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: DEVICE_STATUSES,
      default: 'offline',
      index: true,
    },
    firmware_version: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    last_seen_at: {
      type: Date,
      default: null,
      index: true,
    },
    last_heartbeat_at: {
      type: Date,
      default: null,
    },
    wifi_rssi: {
      type: Number,
      min: -120,
      max: 0,
    },
    location_label: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.models.Device || mongoose.model('Device', deviceSchema);
