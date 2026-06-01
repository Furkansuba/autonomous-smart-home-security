const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  ACCESS_METHODS,
  ACCESS_RESULTS,
} = require('../validators/contract.constants');
const accessLogSchema = new Schema(
  {
    access_id: {
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
    gate_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    user_id: {
      type: String,
      trim: true,
      index: true,
    },
    access_method: {
      type: String,
      required: true,
      enum: ACCESS_METHODS,
    },
    result: {
      type: String,
      required: true,
      enum: ACCESS_RESULTS,
      index: true,
    },
    card_uid_hash: {
      type: String,
      trim: true,
      maxlength: 160,
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
accessLogSchema.index({ device_id: 1, occurred_at: -1 });
accessLogSchema.index({ user_id: 1, occurred_at: -1 });
accessLogSchema.index({ gate_id: 1, occurred_at: -1 });
module.exports =
  mongoose.models.AccessLog || mongoose.model('AccessLog', accessLogSchema);
