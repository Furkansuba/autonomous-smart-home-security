const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  OVERRIDE_ACTIONS,
  OVERRIDE_RESULTS,
} = require('../validators/contract.constants');
const overrideRequestSchema = new Schema(
  {
    override_id: {
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
    requested_by: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    actuator_id: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    action: {
      type: String,
      required: true,
      enum: OVERRIDE_ACTIONS,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    status: {
      type: String,
      enum: ['requested', ...OVERRIDE_RESULTS],
      default: 'requested',
      index: true,
    },
    result: {
      type: String,
      enum: OVERRIDE_RESULTS,
    },
    blocked_reason: {
      type: String,
      trim: true,
      maxlength: 240,
      default: null,
    },
    requested_at: {
      type: Date,
      required: true,
      index: true,
    },
    result_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);
overrideRequestSchema.index({ device_id: 1, requested_at: -1 });
overrideRequestSchema.index({ requested_by: 1, requested_at: -1 });
module.exports =
  mongoose.models.OverrideRequest ||
  mongoose.model('OverrideRequest', overrideRequestSchema);
