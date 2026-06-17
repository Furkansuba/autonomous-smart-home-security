const { OverrideRequest } = require('../models');
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
const { getActiveSafetyHazards } = require('../services/hazardState.service');
const PUMP_ACTIONS = ['pump_on'];
const DEMO_AUTO_ACK_SAFE_ACTIONS = new Set(['buzzer_off', 'buzzer_on', 'pump_off']);
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
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
  // Informational only: warn if a hazard is currently active (short TTL) when a
  // safe action auto-acks. This does not change the hazard or block the action.
  const hazards = await getActiveSafetyHazards(override.device_id);
  if (hazards.active) {
    console.log(
      '[AUTO_ACK] ' + override.override_id + ': alarm silenced — SAFETY HAZARD STILL ACTIVE on ' +
      override.device_id + ' (fire=' + hazards.fire + ', gas/co=' + hazards.gasCo +
      '). Hazard NOT resolved by this action.'
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
    // "Active" hazard = a fire/gas/CO event within its short TTL that is newer than
    // the latest confirmed maintenance_reset (see hazardState.service). Stale historical
    // events (older than the TTL) never block — they remain immutable audit records.
    // door_unlock is intentionally never blocked (evacuation may require unlocking).
    const needsHazardCheck =
      PUMP_ACTIONS.includes(action) || action === 'pump_off' || action === 'door_lock';
    const hazards = needsHazardCheck
      ? await getActiveSafetyHazards(device_id)
      : { fire: false, gasCo: false, active: false };

    // Gas/CO pump lockout: never start a pump while a gas or CO hazard is active.
    if (PUMP_ACTIONS.includes(action) && hazards.gasCo) {
      return createBlockedOverride(
        res,
        req.body,
        'Gas or CO hazard is active for this device. Pump activation is not permitted.',
        'pump_lockout_gas_co'
      );
    }
    // Fire-aware Stop Pump: never let pump_off look "executed" while a fire is active.
    // The firmware safety loop owns the pump relay during a fire and keeps suppression
    // running, so a normal pump_off must not be published or auto-acked. A fire that is
    // stale (past TTL) or cleared by a confirmed maintenance_reset no longer blocks.
    if (action === 'pump_off' && hazards.fire) {
      return createBlockedOverride(
        res,
        req.body,
        'Fire is active for this device. The pump cannot be stopped while fire suppression is engaged. Use Confirm Threat Cleared (maintenance reset) once the threat is verified clear.',
        'pump_off_blocked_fire_active'
      );
    }
    // Evacuation safety: never lock the door while a fire/gas/CO hazard is active, so
    // evacuation is never blocked. door_unlock is NOT blocked. Door lock is re-allowed
    // once the hazard goes stale (past TTL) or a maintenance_reset confirms it cleared.
    if (action === 'door_lock' && hazards.active) {
      return createBlockedOverride(
        res,
        req.body,
        'A fire/gas/CO hazard is active for this device. The door cannot be locked while a hazard is active so evacuation is never blocked. Door lock is re-allowed once the hazard clears or is confirmed cleared.',
        'door_lock_blocked_hazard'
      );
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
