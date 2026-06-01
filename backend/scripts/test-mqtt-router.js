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
if (hasFailure) {
  process.exit(1);
}
console.log('MQTT payload router tests passed.');
