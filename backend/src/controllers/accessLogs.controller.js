const { AccessLog } = require('../models');
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
function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(Math.floor(parsed), 100);
}
function buildAccessLogFilter(query) {
  const filter = {};
  if (query.device_id) {
    filter.device_id = query.device_id;
  }
  if (query.gate_id) {
    filter.gate_id = query.gate_id;
  }
  if (query.user_id) {
    filter.user_id = query.user_id;
  }
  if (query.access_method) {
    filter.access_method = query.access_method;
  }
  if (query.result) {
    filter.result = query.result;
  }
  return filter;
}
async function listAccessLogs(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = buildAccessLogFilter(req.query);
  const limit = parseLimit(req.query.limit);
  try {
    const accessLogs = await AccessLog.find(filter)
      .sort({ occurred_at: -1, received_at: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({
      count: accessLogs.length,
      access_logs: accessLogs,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list access logs.',
      message: error.message,
    });
  }
}
async function getAccessLogById(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const { accessId } = req.params;
  try {
    const accessLog = await AccessLog.findOne({ access_id: accessId }).lean();
    if (!accessLog) {
      return res.status(404).json({
        error: 'Access log not found.',
        access_id: accessId,
      });
    }
    return res.status(200).json({
      access_log: accessLog,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get access log.',
      message: error.message,
    });
  }
}
module.exports = {
  listAccessLogs,
  getAccessLogById,
};
