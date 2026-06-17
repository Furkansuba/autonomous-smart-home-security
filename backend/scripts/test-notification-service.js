// Logic tests for notification.service.
// isNotifiable / buildEventMessage are pure (no DB, Firebase, or Twilio).
// The deduplication test stubs the User/NotificationLog models in memory, so it still
// needs NO real database connection, Firebase, or Twilio.
process.env.FCM_ENABLED = 'false';
process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = '';
process.env.SMS_ENABLED = 'false';
process.env.TWILIO_ACCOUNT_SID = '';
process.env.TWILIO_AUTH_TOKEN = '';
process.env.TWILIO_FROM_NUMBER = '';
process.env.SMS_ALERT_TO = '';

// Stub the models in memory BEFORE loading notification.service. The service calls
// User.find(...).lean() and NotificationLog.create(...) as methods on these objects, so
// replacing the methods here is observed by the service without any DB connection.
const models = require('../src/models');
let stubbedUsers = [];
const createdLogs = [];
models.User.find = () => ({ lean: async () => stubbedUsers });
models.NotificationLog.create = async (doc) => {
  createdLogs.push(doc);
  return doc;
};

const {
  NOTIFIABLE_EVENT_TYPES,
  isNotifiable,
  buildEventMessage,
  buildOfflineMessage,
  sendEventNotification,
} = require('../src/services/notification.service');

const { getSmsStatus } = require('../src/services/sms.service');

function assert(condition, message) {
  if (!condition) throw new Error('ASSERT FAILED: ' + message);
}

async function main() {
  // isNotifiable — every sensor/security Event type must push.
  const REQUIRED = [
    'fire_detected',
    'gas_detected',
    'co_detected',
    'intrusion_detected',
    'motion_detected',
    'vibration_detected',
    'reed_switch_opened',
  ];
  REQUIRED.forEach((type) => assert(isNotifiable(type), type + ' must be notifiable'));
  console.log('[OK] isNotifiable — all required event types return true');

  // isNotifiable — access logs, override logs, device status, heartbeat are NOT notifiable.
  assert(!isNotifiable('heartbeat'), 'heartbeat must not be notifiable');
  assert(!isNotifiable('telemetry'), 'telemetry must not be notifiable');
  assert(!isNotifiable('door_access_granted'), 'door_access_granted must not be notifiable');
  assert(!isNotifiable('door_access_denied'), 'door_access_denied must not be notifiable');
  assert(!isNotifiable('door_unlocked'), 'door_unlocked must not be notifiable');
  assert(!isNotifiable('device_online'), 'device_online must not be notifiable');
  assert(!isNotifiable('device_offline'), 'device_offline must not be notifiable');
  assert(!isNotifiable('heartbeat_missed'), 'heartbeat_missed must not be notifiable');
  assert(!isNotifiable('manual_override_requested'), 'manual_override_requested must not be notifiable');
  assert(!isNotifiable('manual_override_executed'), 'manual_override_executed must not be notifiable');
  assert(!isNotifiable('not_a_real_event'), 'unknown event_type must not be notifiable');
  assert(!isNotifiable(''), 'empty string must not be notifiable');
  assert(!isNotifiable(undefined), 'undefined must not be notifiable');
  console.log('[OK] isNotifiable — access/override/status/unknown types return false');

  // NOTIFIABLE_EVENT_TYPES contains exactly the required 7 types (no extras).
  REQUIRED.forEach((type) =>
    assert(NOTIFIABLE_EVENT_TYPES.includes(type), type + ' must be in NOTIFIABLE_EVENT_TYPES'));
  assert(NOTIFIABLE_EVENT_TYPES.length === REQUIRED.length,
    'NOTIFIABLE_EVENT_TYPES must contain exactly the 7 required types');
  console.log('[OK] NOTIFIABLE_EVENT_TYPES contains exactly the 7 required types');

  // buildEventMessage — friendly titles for every required type; body mentions the room.
  const EXPECTED_TITLES = {
    fire_detected: 'Fire Detected',
    gas_detected: 'Gas Detected',
    co_detected: 'Carbon Monoxide Detected',
    intrusion_detected: 'Intrusion Detected',
    motion_detected: 'Motion Detected',
    vibration_detected: 'Impact / Vibration Detected',
    reed_switch_opened: 'Window/Door Opened',
  };
  REQUIRED.forEach((type) => {
    const msg = buildEventMessage({ event_type: type, room_id: 'kitchen', device_id: 'esp32_home_01' });
    assert(msg.title === EXPECTED_TITLES[type], type + ' title must be friendly label "' + EXPECTED_TITLES[type] + '" (got "' + msg.title + '")');
    assert(typeof msg.body === 'string' && msg.body.length > 0, type + ' must have a non-empty body');
    assert(msg.body.includes('kitchen'), type + ' body must mention the room');
  });
  console.log('[OK] buildEventMessage — friendly labels for all required types');

  // buildOfflineMessage
  const offlineMsg = buildOfflineMessage('esp32_home_01');
  assert(typeof offlineMsg.title === 'string' && offlineMsg.title.length > 0, 'offline message must have title');
  assert(offlineMsg.body.includes('esp32_home_01'), 'offline body must mention device_id');
  console.log('[OK] buildOfflineMessage');

  // Deduplication — two active users share one FCM token; the duplicate is logged as
  // skipped with reason "duplicate_token", and severity is preserved on every log.
  stubbedUsers = [
    { user_id: 'usr_a', fcm_token: 'TOKEN_SHARED', is_active: true },
    { user_id: 'usr_b', fcm_token: 'TOKEN_SHARED', is_active: true },
    { user_id: 'usr_c', fcm_token: 'TOKEN_UNIQUE', is_active: true },
  ];
  createdLogs.length = 0;
  const result = await sendEventNotification({
    event_id: 'evt_dedup_1',
    device_id: 'esp32_home_01',
    room_id: 'kitchen',
    event_type: 'reed_switch_opened',
    severity: 'warning',
  });
  assert(result.dispatched === true, 'dedup: dispatch should run with registered tokens');
  assert(result.count === 3, 'dedup: a log/result is produced per user');
  const dupLogs = createdLogs.filter((l) => l.error_message === 'duplicate_token');
  assert(dupLogs.length === 1, 'dedup: exactly one duplicate-token log expected (got ' + dupLogs.length + ')');
  assert(dupLogs[0].status === 'skipped', 'dedup: duplicate-token log must be status skipped');
  const uniqueTokensProcessed = new Set(
    createdLogs.filter((l) => l.error_message !== 'duplicate_token').map((l) => l.recipient_user_id)
  );
  assert(uniqueTokensProcessed.size === 2, 'dedup: only the 2 unique tokens are dispatched');
  assert(createdLogs.every((l) => l.severity === 'warning'), 'dedup: severity must be preserved on every log');
  assert(createdLogs.every((l) => l.event_id === 'evt_dedup_1'), 'dedup: event_id must be recorded on every log');
  console.log('[OK] dispatchToUsers deduplicates by FCM token and preserves severity');

  // SMS service — disabled state (no SMS logic added by this feature).
  const smsStatus = getSmsStatus();
  assert(smsStatus.enabled === false, 'SMS must be disabled when SMS_ENABLED=false');
  assert(smsStatus.initialized === false, 'Twilio must not initialize when SMS_ENABLED=false');
  console.log('[OK] SMS service — disabled when SMS_ENABLED=false');

  console.log('Notification service logic tests passed.');
}

main().catch((error) => {
  console.error('[FAIL] notification service test failed');
  console.error(error.message);
  process.exit(1);
});
