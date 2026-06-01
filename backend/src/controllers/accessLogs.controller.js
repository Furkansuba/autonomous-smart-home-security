const { AccessLog } = require('../models');
const { getDatabaseStatus } = require('../config/database');
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
  const pagination = getPagination(req.query);
  try {
    const [accessLogs, total] = await Promise.all([
      AccessLog.find(filter)
        .sort({ occurred_at: -1, received_at: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      AccessLog.countDocuments(filter),
    ]);
    return res.status(200).json(
      buildPaginatedResponse('access_logs', accessLogs, {
        total,
        page: pagination.page,
        limit: pagination.limit,
      })
    );
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
