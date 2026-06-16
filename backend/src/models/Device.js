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
    // Security ARM/DISARM mode for intrusion monitoring only. true = ARMED.
    // Updated solely by a confirmed device ACK (arm/disarm override) or a heartbeat
    // that reports security_armed. Never affects fire/gas/CO safety behavior.
    security_armed: {
      type: Boolean,
      default: true,
    },
    // Device-reported / last-commanded physical door lock state. true = LOCKED.
    // This is NOT independently sensor-verified — there is no physical lock sensor.
    // Updated only by a heartbeat that reports door_locked, or by a confirmed
    // (executed) door_lock/door_unlock ACK. null = unknown until first reported.
    door_locked: {
      type: Boolean,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.models.Device || mongoose.model('Device', deviceSchema);
