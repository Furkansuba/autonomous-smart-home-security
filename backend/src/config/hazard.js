// Shared hazard time-to-live configuration.
//
// A published hazard event is only treated as a CURRENTLY-active hazard for a short
// window after it occurred. A real, ongoing hazard keeps producing fresh telemetry/
// events within this window; an old historical event (audit record) must NOT be
// treated as active forever. These TTLs are the single source of truth used by both
// the Sensors/Telemetry "recent hazard" view and the override safety checks.
//
// Safety hazards (fire/gas/CO) additionally respect maintenance_reset: a confirmed
// reset clears any hazard event that occurred before it. Event documents are never
// mutated or deleted — this is purely a derived "is it active right now" decision.
const HAZARD_TTL_SECONDS = {
  fire_detected: 120,
  gas_detected: 120,
  co_detected: 120,
  intrusion_detected: 90,
  vibration_detected: 90,
  reed_switch_opened: 90,
  motion_detected: 90,
};

module.exports = { HAZARD_TTL_SECONDS };
