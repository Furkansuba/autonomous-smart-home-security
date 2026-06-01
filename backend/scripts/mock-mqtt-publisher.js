const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');
const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const examplesDir = path.join(__dirname, '..', '..', 'contracts', 'examples');
function readExample(fileName) {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, fileName), 'utf8'));
}
function publishMessage(client, topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 0 }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      console.log('[PUBLISHER] published ' + topic);
      resolve();
    });
  });
}
async function main() {
  const client = mqtt.connect(brokerUrl, {
    clientId: 'mock_device_publisher_' + Date.now(),
    clean: true,
    connectTimeout: 10000,
  });
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });
  console.log('[PUBLISHER] connected to ' + brokerUrl);
  const heartbeat = readExample('heartbeat.json');
  const telemetry = readExample('telemetry.json');
  const event = readExample('event_fire_detected.json');
  const access = readExample('access_granted.json');
  const overrideResult = readExample('override_result.json');
  await publishMessage(client, 'home/esp32_home_01/heartbeat', heartbeat);
  await publishMessage(client, 'home/esp32_home_01/telemetry', telemetry);
  await publishMessage(client, 'home/esp32_home_01/event', event);
  await publishMessage(client, 'home/esp32_home_01/access', access);
  await publishMessage(client, 'home/esp32_home_01/override/result', overrideResult);
  client.end(false, {}, () => {
    console.log('[PUBLISHER] disconnected');
  });
}
main().catch((error) => {
  console.error('[PUBLISHER] failed');
  console.error(error);
  process.exit(1);
});
