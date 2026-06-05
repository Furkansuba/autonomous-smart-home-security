const http = require('http');
const mqtt = require('mqtt');

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
const deviceId = 'esp32_home_01';
const runId = Date.now();
const eventId = 'evt_live_' + runId;
const accessId = 'acc_live_' + runId;

function now() {
  return new Date().toISOString();
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port: Number(parsed.port) || 80,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function loginAdmin() {
  const result = await httpPost(backendUrl + '/api/auth/login', {
    email: 'admin@smarthome.local',
    password: 'Admin123!',
  });
  if (result.status !== 200 || !result.body.token) {
    throw new Error(
      '[PUBLISHER] admin login failed (HTTP ' +
        result.status +
        '). Ensure the backend is running and seed:demo-admin has been executed.'
    );
  }
  console.log('[PUBLISHER] admin login successful');
  return { token: result.body.token, userId: result.body.user.user_id };
}

async function createPendingOverride(token, userId) {
  const result = await httpPost(
    backendUrl + '/api/overrides',
    {
      device_id: deviceId,
      requested_by: userId,
      actuator_id: 'buzzer_01',
      action: 'buzzer_off',
      reason: 'MQTT live demo override result test.',
    },
    { Authorization: 'Bearer ' + token }
  );
  if (result.status !== 201 || !result.body.override) {
    throw new Error(
      '[PUBLISHER] failed to create pending override (HTTP ' + result.status + ').'
    );
  }
  const overrideId = result.body.override.override_id;
  console.log('[PUBLISHER] pending override created: ' + overrideId);
  return overrideId;
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
  const { token, userId } = await loginAdmin();
  const overrideId = await createPendingOverride(token, userId);

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

  await publishMessage(client, 'home/' + deviceId + '/heartbeat', {
    device_id: deviceId,
    status: 'online',
    firmware_version: '0.1.0',
    uptime_seconds: 3600,
    wifi_rssi: -55,
    timestamp: now(),
  });

  await publishMessage(client, 'home/' + deviceId + '/telemetry', {
    device_id: deviceId,
    room_id: 'kitchen',
    temperature_c: 24.6,
    humidity_percent: 48.2,
    gas_raw: 315,
    co_raw: 120,
    flame_detected: false,
    motion_detected: false,
    reed_open: false,
    timestamp: now(),
  });

  await publishMessage(client, 'home/' + deviceId + '/event', {
    event_id: eventId,
    device_id: deviceId,
    room_id: 'kitchen',
    event_type: 'fire_detected',
    severity: 'critical',
    message: 'Fire detected in kitchen.',
    sensor_id: 'flame_kitchen_01',
    raw_value: 1,
    confirmed: true,
    timestamp: now(),
  });

  await publishMessage(client, 'home/' + deviceId + '/access', {
    access_id: accessId,
    device_id: deviceId,
    gate_id: 'main_door',
    user_id: 'usr_resident_001',
    access_method: 'nfc',
    result: 'granted',
    card_uid_hash: 'sha256:example_hash_value',
    timestamp: now(),
  });

  await publishMessage(client, 'home/' + deviceId + '/override/result', {
    override_id: overrideId,
    device_id: deviceId,
    actuator_id: 'buzzer_01',
    action: 'buzzer_off',
    result: 'executed',
    blocked_reason: null,
    timestamp: now(),
  });

  client.end(false, {}, () => {
    console.log('[PUBLISHER] disconnected');
  });
}

main().catch((error) => {
  console.error('[PUBLISHER] failed');
  console.error(error);
  process.exit(1);
});
