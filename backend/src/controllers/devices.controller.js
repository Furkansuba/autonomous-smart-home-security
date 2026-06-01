const { Device } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const { refreshAllDeviceStatuses } = require('../services/deviceStatus.service');
const {
  getPagination,
  buildPaginatedResponse,
} = require('../utils/pagination');
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
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
  const pagination = getPagination(req.query);
  try {
    const [devices, total] = await Promise.all([
      Device.find(filter)
        .sort({ last_seen_at: -1, device_id: 1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Device.countDocuments(filter),
    ]);
    return res.status(200).json(
      buildPaginatedResponse('devices', devices, {
        total,
        page: pagination.page,
        limit: pagination.limit,
      })
    );
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
