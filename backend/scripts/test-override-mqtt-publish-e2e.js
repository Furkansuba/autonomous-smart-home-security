const net = require('net');
const mqtt = require('mqtt');
process.env.MQTT_ENABLED = 'true';
process.env.MQTT_BROKER_URL = 'mqtt://localhost:1885';
process.env.MQTT_CLIENT_ID = 'smart_home_backend_override_e2e_test';
process.env.MQTT_SUBSCRIBE_TOPICS =
  'home/+/heartbeat,home/+/telemetry,home/+/event,home/+/access,home/+/override/result';
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { OverrideRequest } = require('../src/models');
const {
  startMqttClient,
  stopMqttClient,
} = require('../src/mqtt/mqttClient.service');
const {
  createOverride,
} = require('../src/controllers/overrides.controller');
const TEST_PORT = 1885;
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitFor(conditionFn, timeoutMs = 8000, intervalMs = 250) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await conditionFn()) {
      return true;
    }
    await sleep(intervalMs);
  }
  return false;
}
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}
async function startLocalBroker() {
  const { Aedes } = await import('aedes');
  const broker = await Aedes.createBroker();
  const server = net.createServer(broker.handle);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(TEST_PORT, resolve);
  });
  console.log('[OK] local MQTT broker started on port ' + TEST_PORT);
  return {
    broker,
    server,
  };
}
async function stopLocalBroker(broker, server) {
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
  await new Promise((resolve) => {
    broker.close(() => resolve());
  });
}
async function startCommandSubscriber(deviceId, receivedMessages) {
  const topic = 'home/' + deviceId + '/command/override';
  const subscriber = mqtt.connect('mqtt://localhost:' + TEST_PORT, {
    clientId: 'override_command_subscriber_' + Date.now(),
    clean: true,
    connectTimeout: 10000,
  });
  await new Promise((resolve, reject) => {
    subscriber.once('connect', resolve);
    subscriber.once('error', reject);
  });
  await new Promise((resolve, reject) => {
    subscriber.subscribe(topic, { qos: 0 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  subscriber.on('message', (receivedTopic, messageBuffer) => {
    receivedMessages.push({
      topic: receivedTopic,
      payload: JSON.parse(messageBuffer.toString('utf8')),
    });
  });
  console.log('[OK] command subscriber listening on ' + topic);
  return subscriber;
}
async function cleanup(overrideId) {
  await OverrideRequest.deleteMany({ override_id: overrideId });
}
async function main() {
  const runId = String(Date.now());
  const deviceId = 'esp32_override_e2e_' + runId + '_01';
  const overrideId = 'ovr_override_e2e_' + runId;
  let broker;
  let server;
  let subscriber;
  const receivedMessages = [];
  try {
    const dbResult = await connectDatabase();
    if (!dbResult.connected) {
      console.error('MongoDB connection is required for this test.');
      console.error(dbResult);
      process.exit(1);
    }
    await cleanup(overrideId);
    const brokerContext = await startLocalBroker();
    broker = brokerContext.broker;
    server = brokerContext.server;
    subscriber = await startCommandSubscriber(deviceId, receivedMessages);
    const mqttStartResult = await startMqttClient();
    assert(mqttStartResult.started === true, 'backend MQTT client should start');
    console.log('[OK] backend MQTT client started');
    const req = {
      body: {
        override_id: overrideId,
        device_id: deviceId,
        requested_by: 'usr_admin_001',
        actuator_id: 'buzzer_01',
        action: 'buzzer_off',
        reason: 'Override MQTT publish E2E test.',
      },
    };
    const res = createMockRes();
    await createOverride(req, res);
    assert(res.statusCode === 201, 'createOverride should return 201');
    assert(res.body.created === true, 'override should be created');
    assert(res.body.mqtt_publish.published === true, 'MQTT command should be published');
    assert(
      res.body.mqtt_publish.command_topic === 'home/' + deviceId + '/command/override',
      'command topic should match device command topic'
    );
    console.log('[OK] override created and MQTT publish result is true');
    const received = await waitFor(() => receivedMessages.length > 0);
    assert(received, 'subscriber should receive override command');
    const command = receivedMessages[0];
    assert(
      command.topic === 'home/' + deviceId + '/command/override',
      'subscriber should receive expected command topic'
    );
    assert(
      command.payload.override_id === overrideId,
      'subscriber payload should include override_id'
    );
    assert(
      command.payload.action === 'buzzer_off',
      'subscriber payload should include action'
    );
    const savedOverride = await OverrideRequest.findOne({ override_id: overrideId });
    assert(savedOverride, 'override request should be saved to MongoDB');
    assert(savedOverride.status === 'requested', 'override status should be requested');
    console.log('[OK] subscriber received override MQTT command');
    console.log('[OK] override request persisted to MongoDB');
    console.log('Override MQTT publish E2E tests passed.');
  } finally {
    await cleanup(overrideId);
    if (subscriber) {
      await new Promise((resolve) => subscriber.end(false, {}, resolve));
    }
    await stopMqttClient();
    if (broker && server) {
      await stopLocalBroker(broker, server);
    }
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] Override MQTT publish E2E test failed');
  console.error(error);
  await stopMqttClient();
  await disconnectDatabase();
  process.exit(1);
});
