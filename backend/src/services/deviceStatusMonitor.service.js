const { refreshAllDeviceStatuses } = require('./deviceStatus.service');
const { sendDeviceOfflineNotification } = require('./notification.service');
const { NotificationLog } = require('../models');

// Only controller devices trigger FCM on offline.
// Logical component devices are UI-visible only (no FCM push).
const OFFLINE_PUSH_CONTROLLER_DEVICE_IDS = new Set(['esp32_home_01']);

const MONITOR_INTERVAL_MS = 30 * 1000;

function makeNotifId() {
  return 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

let intervalHandle = null;
let isRunning = false;

async function runStatusCheck() {
  if (isRunning) {
    console.log('[MONITOR] status check skipped — previous check still running');
    return;
  }
  isRunning = true;
  try {
    const result = await refreshAllDeviceStatuses();
    if (!result.refreshed) {
      console.log('[MONITOR] status check skipped: ' + result.reason);
      return;
    }
    const changed = result.results.filter((entry) => entry.changed);
    if (changed.length > 0) {
      console.log(
        '[MONITOR] ' + changed.length + ' device(s) changed status: ' +
          changed
            .map((e) => e.device_id + ' ' + e.previous_status + '→' + e.current_status)
            .join(', ')
      );
    }
    for (const entry of result.results) {
      if (
        entry.changed &&
        entry.current_status === 'offline' &&
        entry.previous_status !== 'offline'
      ) {
        if (OFFLINE_PUSH_CONTROLLER_DEVICE_IDS.has(entry.device_id)) {
          sendDeviceOfflineNotification(entry.device_id).catch((err) => {
            console.error(
              '[MONITOR] offline notification failed for ' + entry.device_id + ': ' + err.message
            );
          });
        } else {
          console.info('[MONITOR] component offline (ui-only, no FCM): ' + entry.device_id);
          NotificationLog.create({
            notification_id: makeNotifId(),
            device_id: entry.device_id,
            event_id: null,
            recipient_user_id: null,
            channel: 'fcm',
            title: 'Device Offline',
            body: 'Device ' + entry.device_id + ' has gone offline.',
            severity: 'warning',
            status: 'skipped',
            error_message: 'component_offline_ui_only',
            sent_at: null,
          }).catch((err) => {
            console.error('[MONITOR] failed to log component offline skip for ' + entry.device_id + ': ' + err.message);
          });
        }
      }
    }
  } catch (error) {
    console.error('[MONITOR] status check error: ' + error.message);
  } finally {
    isRunning = false;
  }
}

function startDeviceStatusMonitor() {
  if (intervalHandle) {
    return;
  }
  console.log('[MONITOR] device status monitor started (interval: ' + MONITOR_INTERVAL_MS / 1000 + 's)');
  intervalHandle = setInterval(runStatusCheck, MONITOR_INTERVAL_MS);
}

function stopDeviceStatusMonitor() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    isRunning = false;
  }
}

module.exports = {
  OFFLINE_PUSH_CONTROLLER_DEVICE_IDS,
  startDeviceStatusMonitor,
  stopDeviceStatusMonitor,
};
