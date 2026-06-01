const {
  buildOverrideCommandTopic,
  buildOverrideCommandPayload,
  publishOverrideCommand,
} = require('../src/mqtt/mqttCommandPublisher.service');
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
async function main() {
  const override = {
    override_id: 'ovr_test_001',
    device_id: 'esp32_home_01',
    requested_by: 'usr_admin_001',
    actuator_id: 'buzzer_01',
    action: 'buzzer_off',
    reason: 'Command publisher unit test.',
  };
  const topic = buildOverrideCommandTopic(override.device_id);
  assert(
    topic === 'home/esp32_home_01/command/override',
    'override command topic should match contract'
  );
  const payload = buildOverrideCommandPayload(override);
  assert(payload.override_id === override.override_id, 'payload should include override_id');
  assert(payload.device_id === override.device_id, 'payload should include device_id');
  assert(payload.actuator_id === override.actuator_id, 'payload should include actuator_id');
  assert(payload.action === override.action, 'payload should include action');
  assert(payload.requested_by === override.requested_by, 'payload should include requested_by');
  assert(Boolean(payload.timestamp), 'payload should include timestamp');
  console.log('[OK] override command topic builder');
  console.log('[OK] override command payload builder');
  const publishResult = await publishOverrideCommand(override);
  assert(
    publishResult.published === false,
    'publish should not happen when MQTT client is not connected'
  );
  assert(
    publishResult.reason === 'mqtt_not_connected',
    'publish should return mqtt_not_connected when client is not connected'
  );
  console.log('[OK] override command safe skipped publish');
  console.log('MQTT override command publisher tests passed.');
}
main().catch((error) => {
  console.error('[FAIL] MQTT override command publisher test failed');
  console.error(error);
  process.exit(1);
});
