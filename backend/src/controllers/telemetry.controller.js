const { TelemetrySummary } = require('../models');
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
function buildTelemetryFilter(query) {
  const filter = {};
  if (query.device_id) {
    filter.device_id = query.device_id;
  }
  if (query.room_id) {
    filter.room_id = query.room_id;
  }
  return filter;
}
async function listTelemetry(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = buildTelemetryFilter(req.query);
  const pagination = getPagination(req.query);
  try {
    const [telemetry, total] = await Promise.all([
      TelemetrySummary.find(filter)
        .sort({ occurred_at: -1, received_at: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      TelemetrySummary.countDocuments(filter),
    ]);
    return res.status(200).json(
      buildPaginatedResponse('telemetry', telemetry, {
        total,
        page: pagination.page,
        limit: pagination.limit,
      })
    );
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list telemetry.',
      message: error.message,
    });
  }
}
async function getLatestTelemetry(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = buildTelemetryFilter(req.query);
  try {
    const latest = await TelemetrySummary.findOne(filter)
      .sort({ occurred_at: -1, received_at: -1 })
      .lean();
    if (!latest) {
      return res.status(404).json({
        error: 'Telemetry not found.',
        filter,
      });
    }
    return res.status(200).json({
      telemetry: latest,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get latest telemetry.',
      message: error.message,
    });
  }
}
module.exports = {
  listTelemetry,
  getLatestTelemetry,
};
