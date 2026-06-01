const {
  buildMqttOptions,
  getMqttStatus,
  startMqttClient,
  stopMqttClient,
} = require('../src/mqtt/mqttClient.service');
const { env, getSafeEnvSummary } = require('../src/config/env');
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
async function main() {
  const options = buildMqttOptions();
  assert(options.clientId === env.mqttClientId, 'MQTT clientId should match env.');
  assert(options.clean === true, 'MQTT clean option should be true.');
  assert(options.reconnectPeriod === 5000, 'MQTT reconnectPeriod should be 5000.');
  const safeEnv = getSafeEnvSummary();
  assert(Array.isArray(safeEnv.mqttSubscribeTopics), 'MQTT subscribe topics should be an array.');
  assert(safeEnv.mqttSubscribeTopics.length > 0, 'MQTT subscribe topics should not be empty.');
  const initialStatus = getMqttStatus();
  assert(initialStatus.broker_url === env.mqttBrokerUrl, 'MQTT broker URL should match env.');
  assert(initialStatus.client_id === env.mqttClientId, 'MQTT client ID should match env.');
  const startResult = await startMqttClient();
  if (!env.mqttEnabled) {
    assert(startResult.skipped === true, 'MQTT start should be skipped when disabled.');
    assert(startResult.started === false, 'MQTT should not start when disabled.');
  }
  const stopResult = await stopMqttClient();
  if (!env.mqttEnabled) {
    assert(stopResult.skipped === true, 'MQTT stop should be skipped when client was not started.');
  }
  console.log('[OK] MQTT client options');
  console.log('[OK] MQTT safe env summary');
  console.log('[OK] MQTT disabled-mode behavior');
  console.log('MQTT client service tests passed.');
}
main().catch((error) => {
  console.error('[FAIL] MQTT client service test failed');
  console.error(error);
  process.exit(1);
});
