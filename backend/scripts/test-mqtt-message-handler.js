const fs = require('fs');
const path = require('path');
const {
  parseMqttMessagePayload,
  handleMqttMessage,
} = require('../src/mqtt/mqttMessageHandler.service');
const examplesDir = path.join(__dirname, '..', '..', 'contracts', 'examples');
function readExample(fileName) {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, fileName), 'utf8'));
}
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
async function main() {
  const heartbeatPayload = readExample('heartbeat.json');
  const heartbeatBuffer = Buffer.from(JSON.stringify(heartbeatPayload), 'utf8');
  const parsed = parseMqttMessagePayload(heartbeatBuffer);
  assert(parsed.parsed === true, 'valid JSON buffer should parse');
  assert(parsed.payload.device_id === 'esp32_home_01', 'parsed payload should include device_id');
  console.log('[OK] valid MQTT payload parsing');
  const invalidParsed = parseMqttMessagePayload(Buffer.from('{invalid-json', 'utf8'));
  assert(invalidParsed.parsed === false, 'invalid JSON should fail parsing');
  console.log('[OK] invalid MQTT payload parsing');
  const handledHeartbeat = await handleMqttMessage(
    'home/esp32_home_01/heartbeat',
    heartbeatBuffer,
    {
      received_at: '2026-06-01T22:00:00Z',
      persist: false,
    }
  );
  assert(handledHeartbeat.handled === true, 'valid heartbeat should be handled');
  assert(handledHeartbeat.accepted === true, 'valid heartbeat should be accepted');
  assert(handledHeartbeat.payload_type === 'heartbeat', 'payload type should be heartbeat');
  assert(
    handledHeartbeat.persistence.reason === 'persistence_disabled',
    'persistence should be disabled in this test'
  );
  console.log('[OK] valid MQTT heartbeat handling');
  const mismatchResult = await handleMqttMessage(
    'home/esp32_other_01/heartbeat',
    heartbeatBuffer,
    {
      received_at: '2026-06-01T22:00:00Z',
      persist: false,
    }
  );
  assert(mismatchResult.handled === false, 'device_id mismatch should not be handled');
  assert(
    mismatchResult.reason === 'device_id_mismatch',
    'device_id mismatch should be rejected'
  );
  console.log('[OK] MQTT device_id mismatch rejection');
  const invalidJsonResult = await handleMqttMessage(
    'home/esp32_home_01/heartbeat',
    Buffer.from('{invalid-json', 'utf8'),
    {
      persist: false,
    }
  );
  assert(invalidJsonResult.handled === false, 'invalid JSON should not be handled');
  assert(invalidJsonResult.reason === 'invalid_json', 'invalid JSON reason should be returned');
  console.log('[OK] MQTT invalid JSON rejection');
  console.log('MQTT message handler tests passed.');
}
main().catch((error) => {
  console.error('[FAIL] MQTT message handler test failed');
  console.error(error);
  process.exit(1);
});
