const { User, NotificationLog } = require('../models');
const { sendToToken } = require('./fcm.service');

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
  const results = [];
  for (const user of users) {
    if (!user.fcm_token || user.fcm_token.trim().length === 0) {
      continue;
    }
    const sendResult = await sendToToken(user.fcm_token, title, body);
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

async function sendDeviceOfflineNotification(deviceId) {
  try {
    const { title, body } = buildOfflineMessage(deviceId);
    const users = await getActiveTokenHolders();
    if (users.length === 0) {
      return { sent: false, skipped: true, reason: 'no_registered_tokens' };
    }
    const results = await dispatchToUsers(users, title, body, {
      device_id: deviceId,
      severity: 'warning',
    });
    return { dispatched: true, count: results.length, results };
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
  sendDeviceOfflineNotification,
};
