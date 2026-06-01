const { OverrideRequest } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const {
  OVERRIDE_ACTIONS,
} = require('../validators/contract.constants');
const {
  publishOverrideCommand,
} = require('../mqtt/mqttCommandPublisher.service');
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
function buildOverrideFilter(query) {
  const filter = {};
  if (query.device_id) {
    filter.device_id = query.device_id;
  }
  if (query.requested_by) {
    filter.requested_by = query.requested_by;
  }
  if (query.action) {
    filter.action = query.action;
  }
  if (query.status) {
    filter.status = query.status;
  }
  return filter;
}
function createOverrideId() {
  return 'ovr_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
}
async function listOverrides(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = buildOverrideFilter(req.query);
  const pagination = getPagination(req.query);
  try {
    const [overrides, total] = await Promise.all([
      OverrideRequest.find(filter)
        .sort({ requested_at: -1, createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      OverrideRequest.countDocuments(filter),
    ]);
    return res.status(200).json(
      buildPaginatedResponse('overrides', overrides, {
        total,
        page: pagination.page,
        limit: pagination.limit,
      })
    );
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list overrides.',
      message: error.message,
    });
  }
}
async function getOverrideById(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const { overrideId } = req.params;
  try {
    const override = await OverrideRequest.findOne({ override_id: overrideId }).lean();
    if (!override) {
      return res.status(404).json({
        error: 'Override request not found.',
        override_id: overrideId,
      });
    }
    return res.status(200).json({
      override,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get override request.',
      message: error.message,
    });
  }
}
async function createOverride(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const {
    override_id,
    device_id,
    requested_by,
    actuator_id,
    action,
    reason,
  } = req.body;
  if (!device_id || !requested_by || !actuator_id || !action) {
    return res.status(400).json({
      error: 'Missing required fields.',
      required: ['device_id', 'requested_by', 'actuator_id', 'action'],
    });
  }
  if (!OVERRIDE_ACTIONS.includes(action)) {
    return res.status(400).json({
      error: 'Invalid override action.',
      action,
      supported_actions: OVERRIDE_ACTIONS,
    });
  }
  try {
    const override = await OverrideRequest.create({
      override_id: override_id || createOverrideId(),
      device_id,
      requested_by,
      actuator_id,
      action,
      reason,
      status: 'requested',
      requested_at: new Date(),
    });
    const mqttPublish = await publishOverrideCommand(override);
    return res.status(201).json({
      created: true,
      override,
      mqtt_publish: mqttPublish,
      next_step: mqttPublish.published
        ? 'Override command published to MQTT.'
        : 'Override request stored. MQTT command publishing was skipped or failed.',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create override request.',
      message: error.message,
    });
  }
}
module.exports = {
  listOverrides,
  getOverrideById,
  createOverride,
};
