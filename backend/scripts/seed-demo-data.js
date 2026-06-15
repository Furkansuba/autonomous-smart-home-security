const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  TelemetrySummary,
} = require('../src/models');
const DEMO_DEVICE_IDS = [
  'esp32_demo_home_01',
  'esp32_demo_garage_01',
  'esp32_demo_entry_01',
];
async function cleanDemoData() {
  await Device.deleteMany({
    device_id: {
      $in: DEMO_DEVICE_IDS,
    },
  });
  await TelemetrySummary.deleteMany({
    device_id: {
      $in: DEMO_DEVICE_IDS,
    },
  });
  await Event.deleteMany({
    event_id: {
      $regex: '^evt_demo_',
    },
  });
  await AccessLog.deleteMany({
    access_id: {
      $regex: '^acc_demo_',
    },
  });
  await OverrideRequest.deleteMany({
    override_id: {
      $regex: '^ovr_demo_',
    },
  });
}
function minutesBefore(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}
async function seedDevices() {
  await Device.create([
    {
      device_id: 'esp32_demo_home_01',
      name: 'Demo Home Main Controller',
      status: 'online',
      firmware_version: '0.1.0',
      last_heartbeat_at: minutesBefore(1),
      last_seen_at: minutesBefore(1),
      is_active: true,
    },
    {
      device_id: 'esp32_demo_garage_01',
      name: 'Demo Garage Controller',
      status: 'degraded',
      firmware_version: '0.1.0',
      last_heartbeat_at: minutesBefore(2),
      last_seen_at: minutesBefore(2),
      is_active: true,
    },
    {
      device_id: 'esp32_demo_entry_01',
      name: 'Demo Entry Door Controller',
      status: 'offline',
      firmware_version: '0.1.0',
      last_heartbeat_at: minutesBefore(4),
      last_seen_at: minutesBefore(4),
      is_active: true,
    },
  ]);
  console.log('[OK] demo devices seeded');
}
async function seedTelemetry() {
  await TelemetrySummary.create([
    {
      device_id: 'esp32_demo_home_01',
      room_id: 'kitchen',
      temperature_c: 24.8,
      humidity_percent: 46,
      gas_raw: 220,
      co_raw: 75,
      flame_detected: true,
      motion_detected: true,
      reed_open: false,
      occurred_at: minutesBefore(1),
      received_at: minutesBefore(1),
    },
    {
      device_id: 'esp32_demo_garage_01',
      room_id: 'garage',
      temperature_c: 21.2,
      humidity_percent: 52,
      gas_raw: 410,
      co_raw: 130,
      flame_detected: false,
      motion_detected: false,
      reed_open: true,
      occurred_at: minutesBefore(4),
      received_at: minutesBefore(4),
    },
    {
      device_id: 'esp32_demo_entry_01',
      room_id: 'living_room',
      temperature_c: 22.1,
      humidity_percent: 44,
      gas_raw: 190,
      co_raw: 60,
      flame_detected: false,
      motion_detected: true,
      reed_open: true,
      occurred_at: minutesBefore(9),
      received_at: minutesBefore(9),
    },
    {
      device_id: 'esp32_demo_home_01',
      room_id: 'bedroom_1',
      temperature_c: 20.5,
      humidity_percent: 48,
      gas_raw: 180,
      co_raw: 55,
      flame_detected: false,
      motion_detected: false,
      reed_open: false,
      occurred_at: minutesBefore(2),
      received_at: minutesBefore(2),
    },
  ]);
  console.log('[OK] demo telemetry seeded');
}
async function seedEvents() {
  await Event.create([
    {
      event_id: 'evt_demo_fire_001',
      device_id: 'esp32_demo_home_01',
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Demo critical fire event in kitchen.',
      sensor_id: 'flame_kitchen_01',
      raw_value: 1,
      confirmed: true,
      occurred_at: minutesBefore(3),
      received_at: minutesBefore(3),
    },
    {
      event_id: 'evt_demo_gas_001',
      device_id: 'esp32_demo_garage_01',
      room_id: 'garage',
      event_type: 'gas_detected',
      severity: 'critical',
      message: 'Demo critical gas level detected in garage. Pump lockout active.',
      sensor_id: 'gas_garage_01',
      raw_value: 410,
      confirmed: true,
      occurred_at: minutesBefore(5),
      received_at: minutesBefore(5),
    },
    {
      event_id: 'evt_demo_intrusion_001',
      device_id: 'esp32_demo_entry_01',
      room_id: 'living_room',
      event_type: 'intrusion_detected',
      severity: 'critical',
      message: 'Demo intrusion detected at living room entry point.',
      sensor_id: 'reed_entry_01',
      raw_value: 1,
      confirmed: true,
      occurred_at: minutesBefore(10),
      received_at: minutesBefore(10),
    },
    {
      event_id: 'evt_demo_motion_001',
      device_id: 'esp32_demo_garage_01',
      room_id: 'garage',
      event_type: 'motion_detected',
      severity: 'warning',
      message: 'Demo motion detected in garage.',
      sensor_id: 'pir_garage_01',
      raw_value: true,
      confirmed: true,
      occurred_at: minutesBefore(8),
      received_at: minutesBefore(8),
    },
    {
      event_id: 'evt_demo_door_001',
      device_id: 'esp32_demo_entry_01',
      room_id: 'living_room',
      event_type: 'motion_detected',
      severity: 'info',
      message: 'Demo motion detected near entry area.',
      sensor_id: 'pir_entry_01',
      raw_value: true,
      confirmed: true,
      occurred_at: minutesBefore(18),
      received_at: minutesBefore(18),
    },
  ]);
  console.log('[OK] demo events seeded');
}
async function seedAccessLogs() {
  await AccessLog.create([
    {
      access_id: 'acc_demo_granted_002',
      device_id: 'esp32_demo_entry_01',
      gate_id: 'main_door',
      user_id: 'usr_resident_001',
      access_method: 'nfc',
      result: 'granted',
      card_uid_hash: 'sha256:demo_granted_hash',
      occurred_at: minutesBefore(45),
      received_at: minutesBefore(45),
    },
    {
      access_id: 'acc_demo_granted_003',
      device_id: 'esp32_demo_entry_01',
      gate_id: 'main_door',
      user_id: 'usr_resident_002',
      access_method: 'nfc',
      result: 'granted',
      card_uid_hash: 'sha256:demo_granted_hash_2',
      occurred_at: minutesBefore(35),
      received_at: minutesBefore(35),
    },
    {
      access_id: 'acc_demo_granted_004',
      device_id: 'esp32_demo_entry_01',
      gate_id: 'main_door',
      user_id: 'usr_resident_001',
      access_method: 'nfc',
      result: 'granted',
      card_uid_hash: 'sha256:demo_granted_hash',
      occurred_at: minutesBefore(22),
      received_at: minutesBefore(22),
    },
    {
      access_id: 'acc_demo_granted_001',
      device_id: 'esp32_demo_entry_01',
      gate_id: 'main_door',
      user_id: 'usr_resident_001',
      access_method: 'nfc',
      result: 'granted',
      card_uid_hash: 'sha256:demo_granted_hash',
      occurred_at: minutesBefore(12),
      received_at: minutesBefore(12),
    },
    {
      access_id: 'acc_demo_denied_001',
      device_id: 'esp32_demo_entry_01',
      gate_id: 'main_door',
      user_id: 'usr_unknown_001',
      access_method: 'nfc',
      result: 'denied',
      card_uid_hash: 'sha256:demo_denied_hash',
      occurred_at: minutesBefore(6),
      received_at: minutesBefore(6),
    },
  ]);
  console.log('[OK] demo access logs seeded');
}
async function seedOverrides() {
  await OverrideRequest.create([
    {
      override_id: 'ovr_demo_buzzer_off_001',
      device_id: 'esp32_demo_home_01',
      requested_by: 'usr_admin_001',
      actuator_id: 'buzzer_01',
      action: 'buzzer_off',
      reason: 'Demo admin override request.',
      status: 'requested',
      requested_at: minutesBefore(2),
    },
    {
      override_id: 'ovr_demo_door_unlock_001',
      device_id: 'esp32_demo_entry_01',
      requested_by: 'usr_admin_001',
      actuator_id: 'door_lock_01',
      action: 'door_unlock',
      reason: 'Demo emergency unlock request.',
      status: 'executed',
      requested_at: minutesBefore(30),
      result_at: minutesBefore(29),
    },
    {
      override_id: 'ovr_demo_buzzer_on_failed_001',
      device_id: 'esp32_demo_garage_01',
      requested_by: 'usr_admin_001',
      actuator_id: 'buzzer_01',
      action: 'buzzer_on',
      reason: 'Demo buzzer test request on degraded device.',
      status: 'failed',
      requested_at: minutesBefore(25),
      result_at: minutesBefore(25),
    },
    {
      override_id: 'ovr_demo_pump_on_blocked_001',
      device_id: 'esp32_demo_home_01',
      requested_by: 'usr_admin_001',
      actuator_id: 'pump_01',
      action: 'pump_on',
      reason: 'Demo pump activation attempt during gas/CO alert.',
      status: 'blocked',
      requested_at: minutesBefore(3),
      result_at: minutesBefore(3),
    },
  ]);
  console.log('[OK] demo overrides seeded');
}
async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for demo seed.');
    console.error(dbResult);
    process.exit(1);
  }
  await cleanDemoData();
  await seedDevices();
  await seedTelemetry();
  await seedEvents();
  await seedAccessLogs();
  await seedOverrides();
  console.log('Demo data seed completed.');
  await disconnectDatabase();
}
main().catch(async (error) => {
  console.error('[FAIL] demo data seed failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
