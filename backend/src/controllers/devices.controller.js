const { Device } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const { refreshAllDeviceStatuses } = require('../services/deviceStatus.service');
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
}
function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(Math.floor(parsed), 100);
}
async function listDevices(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.active === 'true') {
    filter.is_active = true;
  }
  if (req.query.active === 'false') {
    filter.is_active = false;
  }
  const limit = parseLimit(req.query.limit);
  try {
    const devices = await Device.find(filter)
      .sort({ last_seen_at: -1, device_id: 1 })
      .limit(limit)
      .lean();
    return res.status(200).json({
      count: devices.length,
      devices,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list devices.',
      message: error.message,
    });
  }
}
async function getDeviceById(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const { deviceId } = req.params;
  try {
    const device = await Device.findOne({ device_id: deviceId }).lean();
    if (!device) {
      return res.status(404).json({
        error: 'Device not found.',
        device_id: deviceId,
      });
    }
    return res.status(200).json({
      device,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get device.',
      message: error.message,
    });
  }
}
async function refreshDeviceStatuses(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  try {
    const result = await refreshAllDeviceStatuses();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to refresh device statuses.',
      message: error.message,
    });
  }
}
module.exports = {
  listDevices,
  getDeviceById,
  refreshDeviceStatuses,
};
