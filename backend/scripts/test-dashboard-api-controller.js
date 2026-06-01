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
const {
  getDashboardSummary,
} = require('../src/controllers/dashboard.controller');
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
function makeRunId() {
  return String(Date.now());
}
async function cleanup(prefix) {
  await Device.deleteMany({
    device_id: {
      $regex: '^' + prefix,
    },
  });
  await Event.deleteMany({
    event_id: {
      $regex: '^' + prefix,
    },
  });
  await AccessLog.deleteMany({
    access_id: {
      $regex: '^' + prefix,
    },
  });
  await OverrideRequest.deleteMany({
    override_id: {
      $regex: '^' + prefix,
    },
  });
  await TelemetrySummary.deleteMany({
    device_id: {
      $regex: '^' + prefix,
    },
  });
}
async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for this test.');
    console.error(dbResult);
    process.exit(1);
  }
  const runId = makeRunId();
  const prefix = 'dash_api_test_' + runId;
  const deviceId = prefix + '_device_01';
  const eventId = prefix + '_event_01';
  const accessId = prefix + '_access_01';
  const overrideId = prefix + '_override_01';
  try {
    await cleanup(prefix);
    await Device.create({
      device_id: deviceId,
      name: 'Dashboard Test Device',
      status: 'online',
      last_heartbeat_at: new Date(),
      last_seen_at: new Date(),
      is_active: true,
    });
    await Event.create({
      event_id: eventId,
      device_id: deviceId,
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Dashboard test critical event.',
      sensor_id: 'flame_kitchen_01',
      raw_value: 1,
      confirmed: true,
      occurred_at: new Date(),
      received_at: new Date(),
    });
    await AccessLog.create({
      access_id: accessId,
      device_id: deviceId,
      gate_id: 'main_door',
      user_id: 'usr_resident_001',
      access_method: 'nfc',
      result: 'granted',
      card_uid_hash: 'sha256:dashboard_test_hash',
      occurred_at: new Date(),
      received_at: new Date(),
    });
    await TelemetrySummary.create({
      device_id: deviceId,
      room_id: 'kitchen',
      temperature_c: 24.5,
      humidity_percent: 45,
      gas_raw: 200,
      co_raw: 70,
      flame_detected: false,
      motion_detected: true,
      reed_open: false,
      occurred_at: new Date(),
      received_at: new Date(),
    });
    await OverrideRequest.create({
      override_id: overrideId,
      device_id: deviceId,
      requested_by: 'usr_admin_001',
      actuator_id: 'buzzer_01',
      action: 'buzzer_off',
      reason: 'Dashboard test override.',
      status: 'requested',
      requested_at: new Date(),
    });
    const req = {};
    const res = createMockRes();
    await getDashboardSummary(req, res);
    assert(res.statusCode === 200, 'dashboard summary should return 200');
    assert(res.body.devices.total_active >= 1, 'dashboard should include active devices');
    assert(res.body.devices.status_counts.online >= 1, 'dashboard should include online device count');
    assert(
      res.body.events.recent_critical_24h_count >= 1,
      'dashboard should include recent critical events count'
    );
    assert(
      res.body.events.latest.some((event) => event.event_id === eventId),
      'dashboard should include latest test event'
    );
    assert(
      res.body.access_logs.latest.some((item) => item.access_id === accessId),
      'dashboard should include latest test access log'
    );
    assert(
      res.body.telemetry.latest.some((item) => item.device_id === deviceId),
      'dashboard should include latest test telemetry'
    );
    assert(
      res.body.overrides.pending_count >= 1,
      'dashboard should include pending override count'
    );
    console.log('[OK] getDashboardSummary controller');
    console.log('Dashboard API controller tests passed.');
  } finally {
    await cleanup(prefix);
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] dashboard API controller test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
