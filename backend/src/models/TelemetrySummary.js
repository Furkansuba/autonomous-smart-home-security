const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  ROOM_IDS,
} = require('../validators/contract.constants');
const telemetrySummarySchema = new Schema(
  {
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
    temperature_c: {
      type: Number,
      min: -20,
      max: 100,
    },
    humidity_percent: {
      type: Number,
      min: 0,
      max: 100,
    },
    gas_raw: {
      type: Number,
      min: 0,
      max: 4095,
    },
    co_raw: {
      type: Number,
      min: 0,
      max: 4095,
    },
    flame_detected: {
      type: Boolean,
    },
    motion_detected: {
      type: Boolean,
    },
    reed_open: {
      type: Boolean,
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
telemetrySummarySchema.index({ device_id: 1, occurred_at: -1 });
telemetrySummarySchema.index({ room_id: 1, occurred_at: -1 });
module.exports =
  mongoose.models.TelemetrySummary ||
  mongoose.model('TelemetrySummary', telemetrySummarySchema);
