const fs = require('fs');
const path = require('path');
const {
  INGESTION_ACTIONS,
  ingestMqttMessage,
} = require('../src/services/ingestion.service');
const examplesDir = path.join(__dirname, '..', '..', 'contracts', 'examples');
function readExample(fileName) {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, fileName), 'utf8'));
}
const fixedReceivedAt = '2026-06-01T18:50:00Z';
const checks = [
  {
    topic: 'home/esp32_home_01/heartbeat',
    file: 'heartbeat.json',
    expectedAction: INGESTION_ACTIONS.heartbeat,
  },
  {
    topic: 'home/esp32_home_01/telemetry',
    file: 'telemetry.json',
    expectedAction: INGESTION_ACTIONS.telemetry,
  },
  {
    topic: 'home/esp32_home_01/event',
    file: 'event_fire_detected.json',
    expectedAction: INGESTION_ACTIONS.event,
  },
  {
    topic: 'home/esp32_home_01/access',
    file: 'access_granted.json',
    expectedAction: INGESTION_ACTIONS.access,
  },
  {
    topic: 'home/esp32_home_01/override/result',
    file: 'override_result.json',
    expectedAction: INGESTION_ACTIONS.override_result,
  },
];
let hasFailure = false;
for (const check of checks) {
  const payload = readExample(check.file);
  const result = ingestMqttMessage(check.topic, payload, {
    received_at: fixedReceivedAt,
  });
  if (!result.accepted) {
    hasFailure = true;
    console.error('[FAIL] expected accepted ingestion for ' + check.topic);
    console.error(result);
    continue;
  }
  if (result.action !== check.expectedAction) {
    hasFailure = true;
    console.error('[FAIL] wrong action for ' + check.topic);
    console.error({
      expected: check.expectedAction,
      actual: result.action,
    });
    continue;
  }
  if (result.received_at !== fixedReceivedAt) {
    hasFailure = true;
    console.error('[FAIL] received_at was not preserved for ' + check.topic);
    console.error(result);
    continue;
  }
  console.log('[OK] ' + check.topic + ' -> ' + result.action);
}
const invalidTopicResult = ingestMqttMessage(
  'home/esp32_home_01/cmd/reset',
  readExample('heartbeat.json'),
  { received_at: fixedReceivedAt }
);
if (invalidTopicResult.accepted || invalidTopicResult.reason !== 'invalid_topic') {
  hasFailure = true;
  console.error('[FAIL] backend-to-device command topic should be rejected.');
  console.error(invalidTopicResult);
} else {
  console.log('[OK] backend-to-device command topic is rejected.');
}
const mismatchResult = ingestMqttMessage(
  'home/esp32_other_01/heartbeat',
  readExample('heartbeat.json'),
  { received_at: fixedReceivedAt }
);
if (mismatchResult.accepted || mismatchResult.reason !== 'device_id_mismatch') {
  hasFailure = true;
  console.error('[FAIL] device_id mismatch should be rejected.');
  console.error(mismatchResult);
} else {
  console.log('[OK] device_id mismatch is rejected at ingestion layer.');
}
if (hasFailure) {
  process.exit(1);
}
console.log('Ingestion service tests passed.');
