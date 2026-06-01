const {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  NotificationLog,
} = require('../src/models');
function assertValidModel(name, document) {
  const error = document.validateSync();
  if (error) {
    console.error('[FAIL] ' + name);
    console.error(error.message);
    process.exit(1);
  }
  console.log('[OK] ' + name);
}
const now = new Date('2026-06-01T19:30:00Z');
assertValidModel(
  'Device',
  new Device({
    device_id: 'esp32_home_01',
    name: 'Main ESP32 Controller',
    status: 'online',
    firmware_version: '0.1.0',
    last_seen_at: now,
    last_heartbeat_at: now,
    wifi_rssi: -55,
    location_label: 'Prototype Home',
  })
);
assertValidModel(
  'Event',
  new Event({
    event_id: 'evt_20260601_0001',
    device_id: 'esp32_home_01',
    room_id: 'kitchen',
    event_type: 'fire_detected',
    severity: 'critical',
    message: 'Fire detected in kitchen.',
    sensor_id: 'flame_kitchen_01',
    raw_value: 1,
    confirmed: true,
    occurred_at: now,
    received_at: now,
  })
);
assertValidModel(
  'AccessLog',
  new AccessLog({
    access_id: 'acc_20260601_0001',
    device_id: 'esp32_home_01',
    gate_id: 'main_door',
    user_id: 'usr_resident_001',
    access_method: 'nfc',
    result: 'granted',
    card_uid_hash: 'sha256:example_hash_value',
    occurred_at: now,
    received_at: now,
  })
);
assertValidModel(
  'OverrideRequest',
  new OverrideRequest({
    override_id: 'ovr_20260601_0001',
    device_id: 'esp32_home_01',
    requested_by: 'usr_admin_001',
    actuator_id: 'buzzer_01',
    action: 'buzzer_off',
    reason: 'Manual silence after verified test alarm.',
    status: 'executed',
    result: 'executed',
    requested_at: now,
    result_at: now,
  })
);
assertValidModel(
  'NotificationLog',
  new NotificationLog({
    notification_id: 'ntf_20260601_0001',
    device_id: 'esp32_home_01',
    event_id: 'evt_20260601_0001',
    recipient_user_id: 'usr_resident_001',
    channel: 'fcm',
    title: 'Critical Alert',
    body: 'Fire detected in kitchen.',
    severity: 'critical',
    status: 'queued',
  })
);
console.log('All Mongoose model skeletons are valid.');
