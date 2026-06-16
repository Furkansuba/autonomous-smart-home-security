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
const FIRE_HAZARD_TYPES = ['fire_detected'];
const HAZARD_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEMO_AUTO_ACK_SAFE_ACTIONS = new Set(['buzzer_off', 'buzzer_on', 'pump_off']);
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
// Returns a recent hazard event of the given types for the device, or null.
async function findActiveHazard(deviceId, eventTypes) {
  const hazardCutoff = new Date(Date.now() - HAZARD_WINDOW_MS);
  return Event.findOne({
    device_id: deviceId,
    event_type: { $in: eventTypes },
    occurred_at: { $gte: hazardCutoff },
  });
}
// Fire is considered active for a device when the most recent recent-window
// fire_detected event is NEWER than the latest successful (executed)
// maintenance_reset for the same device. A confirmed maintenance_reset clears
// the prior fire; a new fire_detected after that reset re-activates it.
async function isFireActive(deviceId) {
  const hazardCutoff = new Date(Date.now() - HAZARD_WINDOW_MS);
  const latestFire = await Event.findOne({
    device_id: deviceId,
    event_type: { $in: FIRE_HAZARD_TYPES },
    occurred_at: { $gte: hazardCutoff },
  })
    .sort({ occurred_at: -1 })
    .lean();
  if (!latestFire) {
    return false;
  }
  const latestReset = await OverrideRequest.findOne({
    device_id: deviceId,
    action: 'maintenance_reset',
    status: 'executed',
  })
    .sort({ result_at: -1, requested_at: -1 })
    .lean();
  if (!latestReset) {
    return true;
  }
  const resetAt = latestReset.result_at || latestReset.requested_at;
  return new Date(latestFire.occurred_at) > new Date(resetAt);
}
// Persists a blocked override and responds. No MQTT command is published and
// the action is never auto-acked, so a blocked override can never appear as
// "executed". Hazard events themselves are left untouched.
async function createBlockedOverride(res, body, blockedReason, skipReason) {
  const blocked = await OverrideRequest.create({
    override_id: body.override_id || createOverrideId(),
    device_id: body.device_id,
    requested_by: body.requested_by,
    actuator_id: body.actuator_id,
    action: body.action,
    reason: body.reason,
    status: 'blocked',
    blocked_reason: blockedReason,
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
      reason: skipReason,
    },
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
  // Confirm Threat Cleared is an auditable safety action: a reason is mandatory.
  if (action === 'maintenance_reset' && (!reason || !reason.trim())) {
    return res.status(400).json({
      error: 'maintenance_reset requires a non-empty reason.',
      action,
    });
  }
  try {
    // Gas/CO pump lockout: never start a pump while a gas or CO hazard is active.
    if (PUMP_ACTIONS.includes(action)) {
      const activeHazard = await findActiveHazard(device_id, GAS_CO_HAZARD_TYPES);
      if (activeHazard) {
        return createBlockedOverride(
          res,
          req.body,
          'Gas or CO hazard is active for this device. Pump activation is not permitted.',
          'pump_lockout_gas_co'
        );
      }
    }
    // Fire-aware Stop Pump: never let pump_off look "executed" while a fire is
    // active. The firmware safety loop owns the pump relay during a fire and
    // keeps suppression running, so a normal pump_off must not be published or
    // auto-acked. A fire that has been cleared by a successful maintenance_reset
    // (Confirm Threat Cleared) is no longer active, so pump_off is allowed again.
    if (action === 'pump_off') {
      const fireActive = await isFireActive(device_id);
      if (fireActive) {
        return createBlockedOverride(
          res,
          req.body,
          'Fire is active for this device. The pump cannot be stopped while fire suppression is engaged. Use Confirm Threat Cleared (maintenance reset) once the threat is verified clear.',
          'pump_off_blocked_fire_active'
        );
      }
    }
    // Evacuation safety: never lock the door while a fire/gas/CO hazard is active.
    // door_unlock is intentionally NOT blocked — evacuation may require unlocking,
    // and the firmware safety loop auto-unlocks during a hazard. Fire-active respects
    // maintenance_reset (a confirmed threat-cleared reset re-allows door_lock); gas/CO
    // use the recent hazard-event window.
    if (action === 'door_lock') {
      const fireActive = await isFireActive(device_id);
      const gasCoActive = fireActive
        ? null
        : await findActiveHazard(device_id, GAS_CO_HAZARD_TYPES);
      if (fireActive || gasCoActive) {
        return createBlockedOverride(
          res,
          req.body,
          'A fire/gas/CO hazard is active for this device. The door cannot be locked while a hazard is active so evacuation is never blocked. Door lock is re-allowed once the threat is cleared.',
          'door_lock_blocked_hazard'
        );
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
