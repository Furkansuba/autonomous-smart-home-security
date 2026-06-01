const fs = require('fs');
const net = require('net');
const path = require('path');
const mqtt = require('mqtt');
process.env.MQTT_ENABLED = 'true';
process.env.MQTT_BROKER_URL = 'mqtt://localhost:1884';
process.env.MQTT_CLIENT_ID = 'smart_home_backend_e2e_test';
process.env.MQTT_SUBSCRIBE_TOPICS =
  'home/+/heartbeat,home/+/telemetry,home/+/event,home/+/access';
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const {
  Device,
  Event,
  AccessLog,
  TelemetrySummary,
} = require('../src/models');
const {
  startMqttClient,
  stopMqttClient,
} = require('../src/mqtt/mqttClient.service');
const {
  handleMqttMessage,
} = require('../src/mqtt/mqttMessageHandler.service');
const examplesDir = path.join(__dirname, '..', '..', 'contracts', 'examples');
const TEST_PORT = 1884;
function readExample(fileName) {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, fileName), 'utf8'));
}
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
function publishMessage(client, topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 0 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
async function publishTestMessages(deviceId, ids) {
  const publisher = mqtt.connect('mqtt://localhost:' + TEST_PORT, {
    clientId: 'mqtt_e2e_publisher_' + Date.now(),
    clean: true,
    connectTimeout: 10000,
  });
  await new Promise((resolve, reject) => {
    publisher.once('connect', resolve);
    publisher.once('error', reject);
  });
  const heartbeat = readExample('heartbeat.json');
  heartbeat.device_id = deviceId;
  heartbeat.timestamp = '2026-06-01T22:30:00Z';
  const telemetry = readExample('telemetry.json');
  telemetry.device_id = deviceId;
  telemetry.timestamp = '2026-06-01T22:30:01Z';
  const event = readExample('event_fire_detected.json');
  event.device_id = deviceId;
  event.event_id = ids.event_id;
  event.timestamp = '2026-06-01T22:30:02Z';
  const access = readExample('access_granted.json');
  access.device_id = deviceId;
  access.access_id = ids.access_id;
  access.timestamp = '2026-06-01T22:30:03Z';
  await publishMessage(publisher, 'home/' + deviceId + '/heartbeat', heartbeat);
  await publishMessage(publisher, 'home/' + deviceId + '/telemetry', telemetry);
  await publishMessage(publisher, 'home/' + deviceId + '/event', event);
  await publishMessage(publisher, 'home/' + deviceId + '/access', access);
  await new Promise((resolve) => {
    publisher.end(false, {}, resolve);
  });
  console.log('[OK] test MQTT messages published');
}
async function cleanup(deviceId, ids) {
  await Device.deleteMany({ device_id: deviceId });
  await TelemetrySummary.deleteMany({ device_id: deviceId });
  await Event.deleteMany({ event_id: ids.event_id });
  await AccessLog.deleteMany({ access_id: ids.access_id });
}
async function main() {
  const runId = String(Date.now());
  const deviceId = 'esp32_mqtt_e2e_' + runId + '_01';
  const ids = {
    event_id: 'evt_mqtt_e2e_' + runId,
    access_id: 'acc_mqtt_e2e_' + runId,
  };
  let broker;
  let server;
  try {
    const dbResult = await connectDatabase();
    if (!dbResult.connected) {
      console.error('MongoDB connection is required for this test.');
      console.error(dbResult);
      process.exit(1);
    }
    await cleanup(deviceId, ids);
    const brokerContext = await startLocalBroker();
    broker = brokerContext.broker;
    server = brokerContext.server;
    const mqttStartResult = await startMqttClient(async (topic, messageBuffer) => {
      const result = await handleMqttMessage(topic, messageBuffer);
      if (!result.handled) {
        console.warn('[MQTT E2E] rejected ' + topic + ': ' + result.reason);
      }
    });
    assert(mqttStartResult.started === true, 'backend MQTT client should start');
    console.log('[OK] backend MQTT client started and subscribed');
    await publishTestMessages(deviceId, ids);
    const persisted = await waitFor(async () => {
      const [device, telemetry, event, access] = await Promise.all([
        Device.findOne({ device_id: deviceId }),
        TelemetrySummary.findOne({ device_id: deviceId }),
        Event.findOne({ event_id: ids.event_id }),
        AccessLog.findOne({ access_id: ids.access_id }),
      ]);
      return Boolean(device && telemetry && event && access);
    });
    assert(persisted, 'MQTT messages should be persisted to MongoDB');
    const device = await Device.findOne({ device_id: deviceId });
    const event = await Event.findOne({ event_id: ids.event_id });
    const access = await AccessLog.findOne({ access_id: ids.access_id });
    assert(device.status === 'online', 'persisted device should be online');
    assert(event.severity === 'critical', 'persisted event should be critical');
    assert(access.result === 'granted', 'persisted access log should be granted');
    console.log('[OK] MQTT messages persisted to MongoDB');
    console.log('MQTT local end-to-end tests passed.');
  } finally {
    await cleanup(deviceId, ids);
    await stopMqttClient();
    if (broker && server) {
      await stopLocalBroker(broker, server);
    }
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] MQTT local end-to-end test failed');
  console.error(error);
  await stopMqttClient();
  await disconnectDatabase();
  process.exit(1);
});
