const { refreshAllDeviceStatuses } = require('./deviceStatus.service');
const { sendDeviceOfflineNotification } = require('./notification.service');

const MONITOR_INTERVAL_MS = 30 * 1000;

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
        sendDeviceOfflineNotification(entry.device_id).catch((err) => {
          console.error(
            '[MONITOR] offline notification failed for ' + entry.device_id + ': ' + err.message
          );
        });
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
  startDeviceStatusMonitor,
  stopDeviceStatusMonitor,
};
