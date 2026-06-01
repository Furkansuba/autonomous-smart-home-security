const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  ROOM_IDS,
  EVENT_TYPES,
  SEVERITY_LEVELS,
} = require('../validators/contract.constants');
const eventSchema = new Schema(
  {
    event_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    device_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    room_id: {
      type: String,
      required: true,
      enum: ROOM_IDS,
      index: true,
    },
    event_type: {
      type: String,
      required: true,
      enum: EVENT_TYPES,
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: SEVERITY_LEVELS,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    sensor_id: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    raw_value: {
      type: Schema.Types.Mixed,
    },
    confirmed: {
      type: Boolean,
      default: true,
    },
    occurred_at: {
      type: Date,
      required: true,
      index: true,
    },
    received_at: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);
eventSchema.index({ device_id: 1, occurred_at: -1 });
eventSchema.index({ room_id: 1, occurred_at: -1 });
eventSchema.index({ severity: 1, occurred_at: -1 });
module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
