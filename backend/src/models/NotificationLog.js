const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  SEVERITY_LEVELS,
} = require('../validators/contract.constants');
const notificationLogSchema = new Schema(
  {
    notification_id: {
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
    event_id: {
      type: String,
      trim: true,
      index: true,
    },
    recipient_user_id: {
      type: String,
      trim: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['fcm', 'sms', 'in_app'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    severity: {
      type: String,
      enum: SEVERITY_LEVELS,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped'],
      default: 'queued',
      index: true,
    },
    error_message: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    sent_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
notificationLogSchema.index({ device_id: 1, createdAt: -1 });
notificationLogSchema.index({ event_id: 1, createdAt: -1 });
notificationLogSchema.index({ recipient_user_id: 1, createdAt: -1 });
module.exports =
  mongoose.models.NotificationLog ||
  mongoose.model('NotificationLog', notificationLogSchema);
