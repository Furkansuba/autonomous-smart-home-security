// Pure-logic tests for notification.service — no DB, Firebase, or Twilio required
process.env.FCM_ENABLED = 'false';
process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = '';
process.env.SMS_ENABLED = 'false';
process.env.TWILIO_ACCOUNT_SID = '';
process.env.TWILIO_AUTH_TOKEN = '';
process.env.TWILIO_FROM_NUMBER = '';
process.env.SMS_ALERT_TO = '';

const {
  NOTIFIABLE_EVENT_TYPES,
  isNotifiable,
  buildEventMessage,
  buildOfflineMessage,
} = require('../src/services/notification.service');

const { getSmsStatus } = require('../src/services/sms.service');

function assert(condition, message) {
  if (!condition) throw new Error('ASSERT FAILED: ' + message);
}

function main() {
  // isNotifiable — required types
  assert(isNotifiable('fire_detected'), 'fire_detected must be notifiable');
  assert(isNotifiable('gas_detected'), 'gas_detected must be notifiable');
  assert(isNotifiable('co_detected'), 'co_detected must be notifiable');
  assert(isNotifiable('intrusion_detected'), 'intrusion_detected must be notifiable');
  console.log('[OK] isNotifiable — required event types return true');

  // isNotifiable — non-notifiable types
  assert(!isNotifiable('heartbeat'), 'heartbeat must not be notifiable');
  assert(!isNotifiable('telemetry'), 'telemetry must not be notifiable');
  assert(!isNotifiable('door_access_granted'), 'door_access_granted must not be notifiable');
  assert(!isNotifiable('door_access_denied'), 'door_access_denied must not be notifiable');
  assert(!isNotifiable('manual_override_requested'), 'manual_override_requested must not be notifiable');
  assert(!isNotifiable('motion_detected'), 'motion_detected must not be notifiable');
  assert(!isNotifiable(''), 'empty string must not be notifiable');
  assert(!isNotifiable(undefined), 'undefined must not be notifiable');
  console.log('[OK] isNotifiable — non-notifiable types return false');

  // NOTIFIABLE_EVENT_TYPES contains exactly the required 4 types
  const required = ['fire_detected', 'gas_detected', 'co_detected', 'intrusion_detected'];
  required.forEach((type) => {
    assert(NOTIFIABLE_EVENT_TYPES.includes(type), type + ' must be in NOTIFIABLE_EVENT_TYPES');
  });
  console.log('[OK] NOTIFIABLE_EVENT_TYPES includes all 4 required types');

  // buildEventMessage — fire
  const fireMsg = buildEventMessage({ event_type: 'fire_detected', room_id: 'kitchen', device_id: 'esp32_home_01' });
  assert(typeof fireMsg.title === 'string' && fireMsg.title.length > 0, 'fire_detected must have title');
  assert(typeof fireMsg.body === 'string' && fireMsg.body.length > 0, 'fire_detected must have body');
  assert(fireMsg.body.includes('kitchen'), 'fire_detected body must mention room');
  console.log('[OK] buildEventMessage — fire_detected');

  // buildEventMessage — gas
  const gasMsg = buildEventMessage({ event_type: 'gas_detected', room_id: 'garage', device_id: 'esp32_home_01' });
  assert(gasMsg.body.includes('garage'), 'gas_detected body must mention room');
  console.log('[OK] buildEventMessage — gas_detected');

  // buildEventMessage — co
  const coMsg = buildEventMessage({ event_type: 'co_detected', room_id: 'bedroom_1', device_id: 'esp32_home_01' });
  assert(coMsg.body.includes('bedroom_1'), 'co_detected body must mention room');
  console.log('[OK] buildEventMessage — co_detected');

  // buildEventMessage — intrusion
  const intrusionMsg = buildEventMessage({ event_type: 'intrusion_detected', room_id: 'living_room', device_id: 'esp32_home_01' });
  assert(intrusionMsg.body.includes('living_room'), 'intrusion_detected body must mention room');
  console.log('[OK] buildEventMessage — intrusion_detected');

  // buildOfflineMessage
  const offlineMsg = buildOfflineMessage('esp32_home_01');
  assert(typeof offlineMsg.title === 'string' && offlineMsg.title.length > 0, 'offline message must have title');
  assert(offlineMsg.body.includes('esp32_home_01'), 'offline body must mention device_id');
  console.log('[OK] buildOfflineMessage');

  // SMS service — disabled state
  const smsStatus = getSmsStatus();
  assert(smsStatus.enabled === false, 'SMS must be disabled when SMS_ENABLED=false');
  assert(smsStatus.initialized === false, 'Twilio must not initialize when SMS_ENABLED=false');
  console.log('[OK] SMS service — disabled when SMS_ENABLED=false');

  console.log('Notification service logic tests passed.');
}

main();
