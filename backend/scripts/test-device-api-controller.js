const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { Device } = require('../src/models');
const {
  listDevices,
  getDeviceById,
  refreshDeviceStatuses,
} = require('../src/controllers/devices.controller');
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function secondsBefore(date, seconds) {
  return new Date(date.getTime() - seconds * 1000);
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
}
async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for this test.');
    console.error(dbResult);
    process.exit(1);
  }
  const now = new Date();
  const runId = makeRunId();
  const prefix = 'esp32_api_test_' + runId;
  const onlineDeviceId = prefix + '_online_01';
  const offlineDeviceId = prefix + '_offline_01';
  try {
    await cleanup(prefix);
    await Device.create([
      {
        device_id: onlineDeviceId,
        name: 'API Online Test Device',
        status: 'offline',
        last_heartbeat_at: secondsBefore(now, 30),
        last_seen_at: secondsBefore(now, 30),
        is_active: true,
      },
      {
        device_id: offlineDeviceId,
        name: 'API Offline Test Device',
        status: 'online',
        last_heartbeat_at: secondsBefore(now, 120),
        last_seen_at: secondsBefore(now, 120),
        is_active: true,
      },
    ]);
    const listReq = {
      query: {
        limit: '20',
      },
    };
    const listRes = createMockRes();
    await listDevices(listReq, listRes);
    assert(listRes.statusCode === 200, 'listDevices should return 200');
    assert(Array.isArray(listRes.body.devices), 'listDevices should return devices array');
    assert(
      listRes.body.devices.some((device) => device.device_id === onlineDeviceId),
      'listDevices should include online test device'
    );
    console.log('[OK] listDevices controller');
    const getReq = {
      params: {
        deviceId: offlineDeviceId,
      },
    };
    const getRes = createMockRes();
    await getDeviceById(getReq, getRes);
    assert(getRes.statusCode === 200, 'getDeviceById should return 200');
    assert(
      getRes.body.device.device_id === offlineDeviceId,
      'getDeviceById should return requested device'
    );
    console.log('[OK] getDeviceById controller');
    const refreshReq = {};
    const refreshRes = createMockRes();
    await refreshDeviceStatuses(refreshReq, refreshRes);
    assert(refreshRes.statusCode === 200, 'refreshDeviceStatuses should return 200');
    assert(refreshRes.body.refreshed === true, 'refresh result should be refreshed');
    const refreshedOnline = await Device.findOne({ device_id: onlineDeviceId });
    const refreshedOffline = await Device.findOne({ device_id: offlineDeviceId });
    assert(refreshedOnline.status === 'online', 'online test device should become online');
    assert(refreshedOffline.status === 'offline', 'offline test device should become offline');
    console.log('[OK] refreshDeviceStatuses controller');
    console.log('Device API controller tests passed.');
  } finally {
    await cleanup(prefix);
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] device API controller test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
