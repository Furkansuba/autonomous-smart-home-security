const {
  heartbeatSchema,
  telemetrySchema,
  eventSchema,
  validatePayload,
} = require('../src/validators/payload.schemas');

const TIMESTAMP = '2026-06-01T18:45:00Z';

function makeHeartbeat(deviceId) {
  return {
    device_id: deviceId,
    status: 'online',
    firmware_version: '0.1.0',
    uptime_seconds: 3600,
    wifi_rssi: -55,
    timestamp: TIMESTAMP,
  };
}

let hasFailure = false;

function assertValid(label, schema, payload) {
  const result = validatePayload(schema, payload);
  if (!result.valid) {
    hasFailure = true;
    console.error('[FAIL] expected VALID — ' + label);
    console.error(result.errors);
  } else {
    console.log('[OK]   valid — ' + label);
  }
}

function assertInvalid(label, schema, payload) {
  const result = validatePayload(schema, payload);
  if (result.valid) {
    hasFailure = true;
    console.error('[FAIL] expected INVALID — ' + label);
    console.error('  payload device_id:', payload.device_id);
  } else {
    console.log('[OK]   invalid — ' + label);
  }
}

// --- Valid device IDs — approved list from contract §4 ---
console.log('\n-- valid device IDs --');
const validIds = [
  // Main controller
  'esp32_home_01',
  // Bus / expander
  'pcf8574_01',
  // Sensors
  'flame_sensor_01',
  'mq2_sensor_01',
  'mq7_sensor_01',
  'dht_sensor_01',
  'pir_sensor_01',
  'impact_sensor_01',
  'reed_sensor_01',
  // Access peripheral
  'door_controller_01',
  // Zone pumps (4-pump topology — no valve_01)
  'pump_rm1_01',
  'pump_rm2_01',
  'pump_kit_01',
  'pump_liv_01',
  // Actuator
  'buzzer_01',
];
for (const id of validIds) {
  assertValid('heartbeat device_id=' + id, heartbeatSchema, makeHeartbeat(id));
}

// --- Invalid device IDs ---
console.log('\n-- invalid device IDs --');
const invalidIds = [
  ['uppercase start', 'Flame_sensor_01'],
  ['all uppercase', 'PUMP_01'],
  ['mixed case', 'Pump_01'],
  ['hyphen separator', 'flame-sensor-01'],
  ['slash in ID', 'flame/sensor_01'],
  ['space in ID', 'flame sensor_01'],
  ['no numeric suffix', 'flame_sensor'],
  ['no underscore', 'pump01'],
  ['starts with digit', '1pump_01'],
  ['starts with underscore', '_pump_01'],
  ['empty string', ''],
  ['single char', 'p'],
];
for (const [label, id] of invalidIds) {
  assertInvalid('heartbeat device_id: ' + label + ' (' + id + ')', heartbeatSchema, makeHeartbeat(id));
}

// --- Logical device IDs work in telemetry schema ---
console.log('\n-- telemetry schema with logical device ID --');
const telemetryPayload = {
  device_id: 'flame_sensor_01',
  room_id: 'kitchen',
  flame_detected: true,
  timestamp: TIMESTAMP,
};
assertValid('telemetry with flame_sensor_01', telemetrySchema, telemetryPayload);

// --- Event schema with logical device ID ---
console.log('\n-- event schema with logical device ID --');
const eventPayload = {
  event_id: 'evt_test_001',
  device_id: 'flame_sensor_01',
  room_id: 'kitchen',
  event_type: 'fire_detected',
  severity: 'critical',
  message: 'Flame detected in kitchen.',
  confirmed: true,
  timestamp: TIMESTAMP,
};
assertValid('event fire_detected with flame_sensor_01', eventSchema, eventPayload);

if (hasFailure) {
  console.error('\nPayload schema tests FAILED.');
  process.exit(1);
}
console.log('\nPayload schema tests passed.');
