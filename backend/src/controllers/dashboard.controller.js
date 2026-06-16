const {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  TelemetrySummary,
} = require('../models');
const { getDatabaseStatus } = require('../config/database');
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
}
async function getDeviceStatusCounts() {
  // Only active devices contribute to the dashboard health metrics, so deactivated
  // records never inflate the online/degraded/offline counts. This matches
  // total_active, which already filters is_active:true. (Seeded demo controllers are
  // removed entirely from the devices collection by cleanup-demo-devices.js.)
  const rows = await Device.aggregate([
    {
      $match: { is_active: true },
    },
    {
      $group: {
        _id: '$status',
        count: {
          $sum: 1,
        },
      },
    },
  ]);
  const counts = {
    online: 0,
    degraded: 0,
    offline: 0,
  };
  for (const row of rows) {
    if (row._id && Object.prototype.hasOwnProperty.call(counts, row._id)) {
      counts[row._id] = row.count;
    }
  }
  return counts;
}
async function getDashboardSummary(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      deviceStatusCounts,
      totalDevices,
      recentCriticalEventsCount,
      pendingOverridesCount,
      latestEvents,
      latestAccessLogs,
      latestTelemetry,
      mainController,
    ] = await Promise.all([
      getDeviceStatusCounts(),
      Device.countDocuments({ is_active: true }),
      Event.countDocuments({
        severity: 'critical',
        occurred_at: {
          $gte: since24h,
        },
      }),
      OverrideRequest.countDocuments({
        status: 'requested',
      }),
      Event.find({})
        .sort({ occurred_at: -1, received_at: -1 })
        .limit(5)
        .lean(),
      AccessLog.find({})
        .sort({ occurred_at: -1, received_at: -1 })
        .limit(5)
        .lean(),
      TelemetrySummary.find({})
        .sort({ occurred_at: -1, received_at: -1 })
        .limit(5)
        .lean(),
      Device.findOne({ device_id: 'esp32_home_01' })
        .select('device_id security_armed door_locked')
        .lean(),
    ]);
    return res.status(200).json({
      generated_at: new Date().toISOString(),
      devices: {
        total_active: totalDevices,
        status_counts: deviceStatusCounts,
      },
      events: {
        recent_critical_24h_count: recentCriticalEventsCount,
        latest: latestEvents,
      },
      access_logs: {
        latest: latestAccessLogs,
      },
      telemetry: {
        latest: latestTelemetry,
      },
      overrides: {
        pending_count: pendingOverridesCount,
      },
      security: {
        device_id: 'esp32_home_01',
        // null when the main controller has not registered yet; otherwise true/false.
        armed: mainController ? mainController.security_armed !== false : null,
      },
      door: {
        device_id: 'esp32_home_01',
        // Device-reported / last-commanded lock state (NOT sensor-verified).
        // null = unknown (device not registered or has not reported yet).
        locked: mainController && typeof mainController.door_locked === 'boolean'
          ? mainController.door_locked
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to build dashboard summary.',
      message: error.message,
    });
  }
}
module.exports = {
  getDashboardSummary,
};
