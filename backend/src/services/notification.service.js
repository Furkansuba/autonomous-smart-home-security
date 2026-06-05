const { User, NotificationLog } = require('../models');
const { sendToToken } = require('./fcm.service');
const { sendSmsToNumber } = require('./sms.service');
const { env } = require('../config/env');

const NOTIFIABLE_EVENT_TYPES = [
  'fire_detected',
  'gas_detected',
  'co_detected',
  'intrusion_detected',
];

function isNotifiable(eventType) {
  return NOTIFIABLE_EVENT_TYPES.includes(eventType);
}

function buildEventMessage(eventData) {
  const room = eventData.room_id || 'unknown room';
  const device = eventData.device_id || 'unknown device';
  switch (eventData.event_type) {
    case 'fire_detected':
      return {
        title: 'Fire Detected',
        body: 'Fire detected in ' + room + '. Immediate action required.',
      };
    case 'gas_detected':
      return {
        title: 'Gas Detected',
        body: 'Dangerous gas level in ' + room + '. Ventilate immediately.',
      };
    case 'co_detected':
      return {
        title: 'CO Detected',
        body: 'Carbon monoxide in ' + room + '. Evacuate immediately.',
      };
    case 'intrusion_detected':
      return {
        title: 'Intrusion Alert',
        body: 'Intrusion detected in ' + room + ' on ' + device + '.',
      };
    default:
      return {
        title: 'Smart Home Alert',
        body: eventData.message || 'An alert has been triggered.',
      };
  }
}

function buildOfflineMessage(deviceId) {
  return {
    title: 'Device Offline',
    body: 'Device ' + deviceId + ' has gone offline.',
  };
}

function makeNotificationId() {
  return 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

async function getActiveTokenHolders() {
  return User.find({
    is_active: true,
    fcm_token: { $ne: null, $exists: true, $ne: '' },
  }).lean();
}

async function dispatchToUsers(users, title, body, context) {
  const seenTokens = new Set();
  const results = [];
  for (const user of users) {
    const token = user.fcm_token ? user.fcm_token.trim() : '';
    if (!token) {
      continue;
    }
    if (seenTokens.has(token)) {
      await NotificationLog.create({
        notification_id: makeNotificationId(),
        device_id: context.device_id || 'unknown',
        event_id: context.event_id || null,
        recipient_user_id: user.user_id,
        channel: 'fcm',
        title,
        body,
        severity: context.severity || 'warning',
        status: 'skipped',
        error_message: 'duplicate_token',
        sent_at: null,
      });
      results.push({ user_id: user.user_id, sent: false, skipped: true, reason: 'duplicate_token' });
      continue;
    }
    seenTokens.add(token);
    const sendResult = await sendToToken(token, title, body);
    let status;
    if (sendResult.sent) {
      status = 'sent';
    } else if (sendResult.skipped) {
      status = 'skipped';
    } else {
      status = 'failed';
    }
    await NotificationLog.create({
      notification_id: makeNotificationId(),
      device_id: context.device_id || 'unknown',
      event_id: context.event_id || null,
      recipient_user_id: user.user_id,
      channel: 'fcm',
      title,
      body,
      severity: context.severity || 'warning',
      status,
      error_message: sendResult.error || null,
      sent_at: sendResult.sent ? new Date() : null,
    });
    results.push({ user_id: user.user_id, ...sendResult });
  }
  return results;
}

async function sendEventNotification(eventData) {
  if (!isNotifiable(eventData.event_type)) {
    return { sent: false, skipped: true, reason: 'event_type_not_notifiable' };
  }
  try {
    const { title, body } = buildEventMessage(eventData);
    const users = await getActiveTokenHolders();
    if (users.length === 0) {
      return { sent: false, skipped: true, reason: 'no_registered_tokens' };
    }
    const results = await dispatchToUsers(users, title, body, {
      device_id: eventData.device_id,
      event_id: eventData.event_id,
      severity: eventData.severity || 'critical',
    });
    return { dispatched: true, count: results.length, results };
  } catch (error) {
    console.error('[NOTIFICATION] sendEventNotification failed: ' + error.message);
    return { sent: false, skipped: false, error: error.message };
  }
}

async function sendSmsOfflineNotification(deviceId) {
  const { title, body } = buildOfflineMessage(deviceId);
  if (!env.smsEnabled) {
    await NotificationLog.create({
      notification_id: makeNotificationId(),
      device_id: deviceId,
      event_id: null,
      recipient_user_id: null,
      channel: 'sms',
      title,
      body,
      severity: 'warning',
      status: 'skipped',
      error_message: 'sms_disabled',
      sent_at: null,
    });
    return { sent: false, skipped: true, reason: 'sms_disabled' };
  }
  const sendResult = await sendSmsToNumber(env.smsAlertTo, title + ': ' + body);
  const status = sendResult.sent ? 'sent' : (sendResult.skipped ? 'skipped' : 'failed');
  await NotificationLog.create({
    notification_id: makeNotificationId(),
    device_id: deviceId,
    event_id: null,
    recipient_user_id: null,
    channel: 'sms',
    title,
    body,
    severity: 'warning',
    status,
    error_message: sendResult.error || sendResult.reason || null,
    sent_at: sendResult.sent ? new Date() : null,
  });
  return { dispatched: true, ...sendResult };
}

async function sendDeviceOfflineNotification(deviceId) {
  try {
    const { title, body } = buildOfflineMessage(deviceId);
    const users = await getActiveTokenHolders();

    // FCM dispatch
    let fcmResult;
    if (users.length === 0) {
      fcmResult = { sent: false, skipped: true, reason: 'no_registered_tokens' };
    } else {
      const results = await dispatchToUsers(users, title, body, {
        device_id: deviceId,
        severity: 'warning',
      });
      fcmResult = { dispatched: true, count: results.length, results };
    }

    // SMS dispatch — always runs independently, always auditable via NotificationLog
    sendSmsOfflineNotification(deviceId).catch((err) => {
      console.error('[SMS] offline notification failed for ' + deviceId + ': ' + err.message);
    });

    return fcmResult;
  } catch (error) {
    console.error('[NOTIFICATION] sendDeviceOfflineNotification failed: ' + error.message);
    return { sent: false, skipped: false, error: error.message };
  }
}

module.exports = {
  NOTIFIABLE_EVENT_TYPES,
  isNotifiable,
  buildEventMessage,
  buildOfflineMessage,
  sendEventNotification,
  sendSmsOfflineNotification,
  sendDeviceOfflineNotification,
};
