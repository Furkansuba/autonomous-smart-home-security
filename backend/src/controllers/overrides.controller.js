const { OverrideRequest } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const {
  OVERRIDE_ACTIONS,
  OVERRIDE_RESULTS,
} = require('../validators/contract.constants');
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
  const limit = parseLimit(req.query.limit);
  try {
    const overrides = await OverrideRequest.find(filter)
      .sort({ requested_at: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({
      count: overrides.length,
      overrides,
    });
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
    return res.status(201).json({
      created: true,
      override,
      next_step: 'MQTT command publishing is not implemented yet.',
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
