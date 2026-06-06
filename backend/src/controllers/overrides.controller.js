const { OverrideRequest, Event } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const { env } = require('../config/env');
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
const { persistMappedOperation } = require('../services/persistence.service');
const PUMP_ACTIONS = ['pump_on'];
const GAS_CO_HAZARD_TYPES = ['gas_detected', 'co_detected'];
const HAZARD_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEMO_AUTO_ACK_SAFE_ACTIONS = new Set(['buzzer_off', 'buzzer_on', 'pump_off', 'valve_close']);
const SAFETY_HAZARD_TYPES = ['fire_detected', 'gas_detected', 'co_detected'];
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
}
async function autoAckDemoOverride(override, delayMs) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const hazardCutoff = new Date(Date.now() - HAZARD_WINDOW_MS);
  const activeHazard = await Event.findOne({
    device_id: override.device_id,
    event_type: { $in: SAFETY_HAZARD_TYPES },
    occurred_at: { $gte: hazardCutoff },
  }).lean();
  if (activeHazard) {
    console.log(
      '[AUTO_ACK] ' + override.override_id + ': alarm silenced — SAFETY HAZARD STILL ACTIVE: ' +
      activeHazard.event_type + ' on ' + override.device_id + '. Hazard NOT resolved by this action.'
    );
  }
  const result = await persistMappedOperation({
    kind: 'update',
    model: 'OverrideRequest',
    filter: { override_id: override.override_id, status: 'requested' },
    update: {
      $set: {
        status: 'executed',
        result: 'executed',
        blocked_reason: null,
        result_at: new Date(),
      },
    },
    options: { returnDocument: 'after' },
  });
  if (result.saved) {
    console.log('[AUTO_ACK] ' + override.override_id + ' → executed (demo-simulated, no real hardware)');
  } else {
    console.log('[AUTO_ACK] No-op for ' + override.override_id + ': ' + (result.reason || 'already resolved'));
  }
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
    if (PUMP_ACTIONS.includes(action)) {
      const hazardCutoff = new Date(Date.now() - HAZARD_WINDOW_MS);
      const activeHazard = await Event.findOne({
        device_id,
        event_type: { $in: GAS_CO_HAZARD_TYPES },
        occurred_at: { $gte: hazardCutoff },
      });
      if (activeHazard) {
        const blocked = await OverrideRequest.create({
          override_id: override_id || createOverrideId(),
          device_id,
          requested_by,
          actuator_id,
          action,
          reason,
          status: 'blocked',
          blocked_reason:
            'Gas or CO hazard is active for this device. Pump activation is not permitted.',
          requested_at: new Date(),
          result_at: new Date(),
        });
        return res.status(201).json({
          created: true,
          blocked: true,
          override: blocked,
          mqtt_publish: {
            published: false,
            skipped: true,
            reason: 'pump_lockout_gas_co',
          },
        });
      }
    }
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
    if (env.overrideDemoAutoAck && DEMO_AUTO_ACK_SAFE_ACTIONS.has(action)) {
      autoAckDemoOverride(
        override.toObject ? override.toObject() : override,
        env.overrideDemoAutoAckDelayMs
      ).catch((err) =>
        console.error('[AUTO_ACK] Error for ' + override.override_id + ': ' + err.message)
      );
    }
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
