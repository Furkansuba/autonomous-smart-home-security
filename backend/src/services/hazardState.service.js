const { Event, OverrideRequest } = require('../models');
const { HAZARD_TTL_SECONDS } = require('../config/hazard');

// Single source of truth for "is a safety hazard active right now" for a device.
//
// A fire/gas/CO event counts as ACTIVE only when BOTH:
//   1. it occurred within its short hazard TTL (see config/hazard.js), AND
//   2. it is NEWER than the latest successful (executed) maintenance_reset.
//
// This deliberately avoids any long (e.g. 24h) "active" window: a stale historical
// hazard event — kept forever as an immutable audit record — never blocks overrides.
// A genuinely ongoing hazard keeps emitting fresh events within the TTL, and a
// confirmed maintenance_reset clears everything before it (future events re-arm it).
const FIRE_TYPES = ['fire_detected'];
const GAS_CO_TYPES = ['gas_detected', 'co_detected'];

async function latestExecutedResetAt(deviceId) {
  const reset = await OverrideRequest.findOne({
    device_id: deviceId,
    action: 'maintenance_reset',
    status: 'executed',
  })
    .sort({ result_at: -1, requested_at: -1 })
    .lean();
  if (!reset) return null;
  return new Date(reset.result_at || reset.requested_at);
}

async function isTypeActive(deviceId, types, ttlSeconds, resetAt, nowMs) {
  // Latest event of these types overall (no time filter) — then apply TTL + reset.
  const latest = await Event.findOne({
    device_id: deviceId,
    event_type: { $in: types },
  })
    .sort({ occurred_at: -1 })
    .lean();
  if (!latest) return false;
  const occurredMs = new Date(latest.occurred_at).getTime();
  if (nowMs - occurredMs > ttlSeconds * 1000) return false; // stale → not active
  if (resetAt && occurredMs <= resetAt.getTime()) return false; // cleared by reset
  return true;
}

// Returns { fire, gasCo, active } booleans for the device's current safety state.
async function getActiveSafetyHazards(deviceId, nowMs = Date.now()) {
  const resetAt = await latestExecutedResetAt(deviceId);
  const [fire, gasCo] = await Promise.all([
    isTypeActive(deviceId, FIRE_TYPES, HAZARD_TTL_SECONDS.fire_detected, resetAt, nowMs),
    // gas_detected and co_detected share the same TTL (120s).
    isTypeActive(deviceId, GAS_CO_TYPES, HAZARD_TTL_SECONDS.gas_detected, resetAt, nowMs),
  ]);
  return { fire, gasCo, active: fire || gasCo };
}

module.exports = {
  getActiveSafetyHazards,
  FIRE_TYPES,
  GAS_CO_TYPES,
};
