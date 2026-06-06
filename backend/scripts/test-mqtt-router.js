const fs = require('fs');
const path = require('path');
const { routeMqttPayload } = require('../src/mqtt/mqttPayloadRouter');
const examplesDir = path.join(__dirname, '..', '..', 'contracts', 'examples');
const checks = [
  ['home/esp32_home_01/heartbeat', 'heartbeat.json'],
  ['home/esp32_home_01/telemetry', 'telemetry.json'],
  ['home/esp32_home_01/event', 'event_fire_detected.json'],
  ['home/esp32_home_01/access', 'access_granted.json'],
  ['home/esp32_home_01/override/result', 'override_result.json'],
];
let hasFailure = false;
for (const [topic, fileName] of checks) {
  const filePath = path.join(examplesDir, fileName);
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const result = routeMqttPayload(topic, payload);
  if (!result.routed) {
    hasFailure = true;
    console.error('[FAIL] ' + topic + ' -> ' + fileName);
    console.error(result);
  } else {
    console.log('[OK] ' + topic + ' -> ' + result.payload_type);
  }
}
const mismatchPayload = JSON.parse(
  fs.readFileSync(path.join(examplesDir, 'heartbeat.json'), 'utf8')
);
const mismatchResult = routeMqttPayload(
  'home/esp32_other_01/heartbeat',
  mismatchPayload
);
if (mismatchResult.reason !== 'device_id_mismatch') {
  hasFailure = true;
  console.error('[FAIL] device_id mismatch test did not fail as expected.');
  console.error(mismatchResult);
} else {
  console.log('[OK] device_id mismatch is rejected.');
}

// --- Logical component device heartbeat routing — approved list §4 (no valve_01, no pump_01) ---
const TIMESTAMP = '2026-06-01T18:45:00Z';
const logicalDeviceIds = [
  'pcf8574_01',
  'flame_sensor_01',
  'mq2_sensor_01',
  'mq7_sensor_01',
  'dht_sensor_01',
  'pir_sensor_01',
  'impact_sensor_01',
  'reed_sensor_01',
  'door_controller_01',
  'pump_rm1_01',
  'pump_rm2_01',
  'pump_kit_01',
  'pump_liv_01',
  'buzzer_01',
];
for (const deviceId of logicalDeviceIds) {
  const topic = 'home/' + deviceId + '/heartbeat';
  const payload = {
    device_id: deviceId,
    status: 'online',
    firmware_version: '0.1.0',
    uptime_seconds: 3600,
    wifi_rssi: -62,
    timestamp: TIMESTAMP,
  };
  const result = routeMqttPayload(topic, payload);
  if (!result.routed) {
    hasFailure = true;
    console.error('[FAIL] logical device heartbeat rejected: ' + topic);
    console.error(result);
  } else {
    console.log('[OK] logical device heartbeat accepted: ' + deviceId);
  }
}

if (hasFailure) {
  process.exit(1);
}
console.log('MQTT payload router tests passed.');
