const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { TelemetrySummary } = require('../src/models');
const {
  listTelemetry,
  getLatestTelemetry,
} = require('../src/controllers/telemetry.controller');
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
async function cleanup(deviceId) {
  await TelemetrySummary.deleteMany({ device_id: deviceId });
}
async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for this test.');
    console.error(dbResult);
    process.exit(1);
  }
  const runId = makeRunId();
  const deviceId = 'esp32_telemetry_api_test_' + runId + '_01';
  try {
    await cleanup(deviceId);
    await TelemetrySummary.create([
      {
        device_id: deviceId,
        room_id: 'kitchen',
        temperature_c: 23.5,
        humidity_percent: 45.1,
        gas_raw: 210,
        co_raw: 80,
        flame_detected: false,
        motion_detected: false,
        reed_open: false,
        occurred_at: new Date('2026-06-01T21:30:00Z'),
        received_at: new Date('2026-06-01T21:30:01Z'),
      },
      {
        device_id: deviceId,
        room_id: 'kitchen',
        temperature_c: 25.2,
        humidity_percent: 47.3,
        gas_raw: 240,
        co_raw: 90,
        flame_detected: false,
        motion_detected: true,
        reed_open: false,
        occurred_at: new Date('2026-06-01T21:31:00Z'),
        received_at: new Date('2026-06-01T21:31:01Z'),
      },
    ]);
    const listReq = {
      query: {
        device_id: deviceId,
        room_id: 'kitchen',
        limit: '20',
      },
    };
    const listRes = createMockRes();
    await listTelemetry(listReq, listRes);
    assert(listRes.statusCode === 200, 'listTelemetry should return 200');
    assert(Array.isArray(listRes.body.telemetry), 'listTelemetry should return telemetry array');
    assert(listRes.body.telemetry.length === 2, 'listTelemetry should return two telemetry records');
    console.log('[OK] listTelemetry controller');
    const latestReq = {
      query: {
        device_id: deviceId,
        room_id: 'kitchen',
      },
    };
    const latestRes = createMockRes();
    await getLatestTelemetry(latestReq, latestRes);
    assert(latestRes.statusCode === 200, 'getLatestTelemetry should return 200');
    assert(
      latestRes.body.telemetry.temperature_c === 25.2,
      'latest telemetry should return newest temperature'
    );
    assert(
      latestRes.body.telemetry.motion_detected === true,
      'latest telemetry should return newest motion state'
    );
    console.log('[OK] getLatestTelemetry controller');
    console.log('Telemetry API controller tests passed.');
  } finally {
    await cleanup(deviceId);
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] telemetry API controller test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
