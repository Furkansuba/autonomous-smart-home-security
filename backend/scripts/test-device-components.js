// Device attached-components endpoint test (requires MongoDB).
// Verifies the derived, read-only component view for a single controller:
//  - 404 for an unknown device
//  - returns the component catalog with safe derived statuses
//  - a recent gas_detected event flips MQ-2 to "alert"
//  - actuators are "commandable"; RFID is category "access"
//  - never creates devices-collection records (purely derived)
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { Device, TelemetrySummary, Event, AccessLog, OverrideRequest } = require('../src/models');
const { getDeviceComponents } = require('../src/controllers/deviceComponents.controller');

function assert(c, m) { if (!c) throw new Error(m); }
function createMockRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
}
function find(components, id) { return components.find((c) => c.component_id === id); }

async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for this test.');
    console.error(dbResult);
    process.exit(1);
  }
  const runId = String(Date.now());
  const device = 'esp32_comptest_01';
  const evtGas = 'evt_comp_gas_' + runId;
  const accId = 'acc_comp_' + runId;
  const ovrId = 'ovr_comp_' + runId;
  async function cleanup() {
    await Device.deleteOne({ device_id: device });
    await TelemetrySummary.deleteMany({ device_id: device });
    await Event.deleteMany({ device_id: device });
    await AccessLog.deleteMany({ device_id: device });
    await OverrideRequest.deleteMany({ override_id: ovrId });
  }
  try {
    await cleanup();

    // 1. unknown device → 404
    const res404 = createMockRes();
    await getDeviceComponents({ params: { deviceId: device } }, res404);
    assert(res404.statusCode === 404, 'unknown device should 404');
    console.log('[OK] unknown device returns 404');

    // Seed a controller + recent activity
    const now = new Date();
    await Device.create({ device_id: device, name: 'Component Test', status: 'online', door_locked: true, security_armed: true, last_heartbeat_at: now });
    await TelemetrySummary.create({
      device_id: device, room_id: 'kitchen', temperature_c: 23.5, humidity_percent: 44,
      gas_raw: 1800, co_raw: 10, flame_detected: false, motion_detected: false, reed_open: false,
      occurred_at: now, received_at: now,
    });
    await Event.create({
      event_id: evtGas, device_id: device, room_id: 'kitchen', event_type: 'gas_detected',
      severity: 'critical', message: 'Component test gas.', confirmed: true, occurred_at: now, received_at: now,
    });
    await AccessLog.create({
      access_id: accId, device_id: device, gate_id: 'main_door', access_method: 'nfc',
      result: 'granted', occurred_at: now, received_at: now,
    });
    await OverrideRequest.create({
      override_id: ovrId, device_id: device, requested_by: 'usr_admin_001', actuator_id: 'buzzer_01',
      action: 'buzzer_off', reason: 'test', status: 'executed', result: 'executed',
      requested_at: now, result_at: now,
    });

    // 2. components returned
    const res = createMockRes();
    await getDeviceComponents({ params: { deviceId: device } }, res);
    assert(res.statusCode === 200, 'should return 200');
    const comps = res.body.components;
    assert(Array.isArray(comps) && comps.length > 0, 'components array present');
    console.log('[OK] components returned: ' + comps.length);

    // 3. MQ-2 alert from recent gas_detected
    const mq2 = find(comps, 'mq2_sensor_01');
    assert(mq2 && mq2.status === 'alert', 'MQ-2 should be alert from recent gas_detected');
    console.log('[OK] MQ-2 alert from recent gas_detected');

    // 4. DHT observed with climate value
    const dht = find(comps, 'dht_sensor_01');
    assert(dht && dht.status === 'observed' && /°C/.test(dht.latest_value), 'DHT observed with climate value');
    console.log('[OK] DHT observed with climate value');

    // 5. actuator commandable + RFID access category
    const buzzer = find(comps, 'buzzer_01');
    assert(buzzer && buzzer.category === 'actuator' && buzzer.status === 'commandable', 'buzzer commandable');
    const rfid = find(comps, 'rfid_reader_01');
    assert(rfid && rfid.category === 'access' && rfid.status === 'observed', 'RFID access observed');
    console.log('[OK] buzzer commandable; RFID access observed');

    // 6. derived only — no component IDs leaked into the devices collection
    const compDeviceDocs = await Device.countDocuments({ device_id: { $in: comps.map((c) => c.component_id) } });
    assert(compDeviceDocs === 0, 'component rows must NOT exist as device documents');
    console.log('[OK] components are derived only (no device docs created)');

    console.log('Device components tests passed.');
  } finally {
    await cleanup();
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] device components test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
