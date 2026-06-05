const { NotificationLog } = require('../models');
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
function buildNotificationLogFilter(query) {
  const filter = {};
  if (query.channel)   filter.channel           = query.channel;
  if (query.status)    filter.status            = query.status;
  if (query.device_id) filter.device_id         = query.device_id;
  if (query.user_id)   filter.recipient_user_id = query.user_id;
  return filter;
}
async function listNotificationLogs(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = buildNotificationLogFilter(req.query);
  const pagination = getPagination(req.query);
  try {
    const [logs, total] = await Promise.all([
      NotificationLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      NotificationLog.countDocuments(filter),
    ]);
    return res.status(200).json(
      buildPaginatedResponse('notification_logs', logs, {
        total,
        page: pagination.page,
        limit: pagination.limit,
      })
    );
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list notification logs.',
      message: error.message,
    });
  }
}
module.exports = {
  listNotificationLogs,
};
