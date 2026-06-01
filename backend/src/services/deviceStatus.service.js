const { Device } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const HEARTBEAT_POLICY = {
  heartbeatIntervalSeconds: 30,
  degradedThresholdSeconds: 60,
  offlineThresholdSeconds: 90,
};
function secondsBetween(laterDate, earlierDate) {
  return Math.floor((laterDate.getTime() - earlierDate.getTime()) / 1000);
}
function toDateOrNull(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}
function computeDeviceStatus(lastHeartbeatAt, now = new Date(), policy = HEARTBEAT_POLICY) {
  const heartbeatDate = toDateOrNull(lastHeartbeatAt);
  if (!heartbeatDate) {
    return {
      status: 'offline',
      seconds_since_last_heartbeat: null,
      reason: 'missing_heartbeat',
    };
  }
  const elapsedSeconds = secondsBetween(now, heartbeatDate);
  if (elapsedSeconds <= policy.degradedThresholdSeconds) {
    return {
      status: 'online',
      seconds_since_last_heartbeat: elapsedSeconds,
      reason: 'heartbeat_recent',
    };
  }
  if (elapsedSeconds <= policy.offlineThresholdSeconds) {
    return {
      status: 'degraded',
      seconds_since_last_heartbeat: elapsedSeconds,
      reason: 'heartbeat_delayed',
    };
  }
  return {
    status: 'offline',
    seconds_since_last_heartbeat: elapsedSeconds,
    reason: 'heartbeat_timeout',
  };
}
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
async function refreshSingleDeviceStatus(device, now = new Date()) {
  const computed = computeDeviceStatus(device.last_heartbeat_at, now);
  const previousStatus = device.status;
  device.status = computed.status;
  if (computed.status !== previousStatus) {
    device.last_seen_at = now;
  }
  await device.save();
  return {
    device_id: device.device_id,
    previous_status: previousStatus,
    current_status: computed.status,
    changed: previousStatus !== computed.status,
    seconds_since_last_heartbeat: computed.seconds_since_last_heartbeat,
    reason: computed.reason,
  };
}
async function refreshAllDeviceStatuses(now = new Date()) {
  if (!isDatabaseConnected()) {
    return {
      refreshed: false,
      skipped: true,
      reason: 'database_not_connected',
      database: getDatabaseStatus(),
    };
  }
  const devices = await Device.find({ is_active: true });
  const results = [];
  for (const device of devices) {
    const result = await refreshSingleDeviceStatus(device, now);
    results.push(result);
  }
  return {
    refreshed: true,
    skipped: false,
    checked_count: results.length,
    changed_count: results.filter((item) => item.changed).length,
    results,
  };
}
module.exports = {
  HEARTBEAT_POLICY,
  computeDeviceStatus,
  refreshSingleDeviceStatus,
  refreshAllDeviceStatuses,
};
