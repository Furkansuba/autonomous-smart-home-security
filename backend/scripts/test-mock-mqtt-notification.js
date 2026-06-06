// Verifies that POST /api/mock/mqtt dispatches sendEventNotification for
// accepted event payloads and does not dispatch for heartbeats, telemetry,
// validation failures, or persistence failures.
// Uses module-level stubs — no DB, FCM, or Twilio required.
process.env.FCM_ENABLED = 'false';
process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = '';
process.env.SMS_ENABLED = 'false';
process.env.TWILIO_ACCOUNT_SID = '';
process.env.TWILIO_AUTH_TOKEN = '';
process.env.TWILIO_FROM_NUMBER = '';
process.env.SMS_ALERT_TO = '';

// Patch persistence.service before loading the controller so the
// controller's destructured persistAcceptedIngestion captures the stub.
const persistenceService = require('../src/services/persistence.service');
let stubSavedResult = { saved: true };
persistenceService.persistAcceptedIngestion = async () => stubSavedResult;

// Spy on notification.service before loading the controller so the
// controller's destructured sendEventNotification captures the spy.
const notificationService = require('../src/services/notification.service');
let sendEventCallCount = 0;
let sendEventLastData = null;
notificationService.sendEventNotification = async (data) => {
  sendEventCallCount++;
  sendEventLastData = data;
  return { dispatched: true };
};

// Load controller after stubs are in place.
const { ingestMockMqttMessage } = require('../src/controllers/mockMqtt.controller');

function assert(condition, message) {
  if (!condition) throw new Error('ASSERT FAILED: ' + message);
}

function makeReq(topic, payload) {
  return { body: { topic, payload } };
}

function makeRes() {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

let _idSeq = 0;
function makeEventPayload(overrides) {
  _idSeq++;
  return {
    event_id: 'evt_mocktest_' + _idSeq,
    device_id: 'esp32_home_01',
    room_id: 'kitchen',
    event_type: 'fire_detected',
    severity: 'critical',
    message: 'Test event.',
    confirmed: true,
    timestamp: '2026-06-01T18:45:00Z',
    ...overrides,
  };
}

function makeHeartbeatPayload() {
  return {
    device_id: 'esp32_home_01',
    status: 'online',
    firmware_version: '0.1.0',
    uptime_seconds: 3600,
    wifi_rssi: -55,
    timestamp: '2026-06-01T18:45:00Z',
  };
}

const NOTIFIABLE_EVENT_TYPES = [
  { event_type: 'fire_detected',     severity: 'critical' },
  { event_type: 'gas_detected',      severity: 'critical' },
  { event_type: 'co_detected',       severity: 'critical' },
  { event_type: 'intrusion_detected',severity: 'warning'  },
];

async function main() {
  // Each critical event type must trigger sendEventNotification
  for (const { event_type, severity } of NOTIFIABLE_EVENT_TYPES) {
    sendEventCallCount = 0;
    sendEventLastData = null;
    stubSavedResult = { saved: true };
    const req = makeReq('home/esp32_home_01/event', makeEventPayload({ event_type, severity }));
    const res = makeRes();
    await ingestMockMqttMessage(req, res);
    assert(res.statusCode === 200, event_type + ' should return 200');
    assert(sendEventCallCount === 1, event_type + ' → sendEventNotification must be called once');
    assert(
      sendEventLastData && sendEventLastData.event_type === event_type,
      event_type + ' → sendEventNotification must receive correct event_type'
    );
    console.log('[OK] ' + event_type + ' → sendEventNotification called');
  }

  // heartbeat → sendEventNotification must NOT be called
  sendEventCallCount = 0;
  stubSavedResult = { saved: true };
  const hbRes = makeRes();
  await ingestMockMqttMessage(makeReq('home/esp32_home_01/heartbeat', makeHeartbeatPayload()), hbRes);
  assert(hbRes.statusCode === 200, 'heartbeat should return 200');
  assert(sendEventCallCount === 0, 'heartbeat → sendEventNotification must NOT be called');
  console.log('[OK] heartbeat → sendEventNotification NOT called');

  // event with persistence.saved=false → sendEventNotification must NOT be called
  sendEventCallCount = 0;
  stubSavedResult = { saved: false, reason: 'persistence_error' };
  const failRes = makeRes();
  await ingestMockMqttMessage(
    makeReq('home/esp32_home_01/event', makeEventPayload()),
    failRes
  );
  assert(failRes.statusCode === 200, 'persistence-failed event should still return 200');
  assert(sendEventCallCount === 0, 'persistence failure → sendEventNotification must NOT be called');
  console.log('[OK] persistence failure → sendEventNotification NOT called');

  // missing topic → 400, sendEventNotification must NOT be called
  sendEventCallCount = 0;
  const noTopicRes = makeRes();
  await ingestMockMqttMessage(makeReq(null, makeEventPayload()), noTopicRes);
  assert(noTopicRes.statusCode === 400, 'missing topic must return 400');
  assert(sendEventCallCount === 0, 'missing topic → sendEventNotification must NOT be called');
  console.log('[OK] missing topic → 400, sendEventNotification NOT called');

  // ingestion validation failure (unknown event_type) → 422, sendEventNotification must NOT be called
  sendEventCallCount = 0;
  stubSavedResult = { saved: true };
  const badRes = makeRes();
  await ingestMockMqttMessage(
    makeReq('home/esp32_home_01/event', makeEventPayload({ event_type: 'not_a_real_event' })),
    badRes
  );
  assert(badRes.statusCode === 422, 'unknown event_type must return 422');
  assert(sendEventCallCount === 0, 'validation failure → sendEventNotification must NOT be called');
  console.log('[OK] validation failure → 422, sendEventNotification NOT called');

  console.log('Mock MQTT notification dispatch tests passed.');
}

main().catch((error) => {
  console.error('[FAIL] Mock MQTT notification dispatch test failed');
  console.error(error.message);
  process.exit(1);
});
