const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { Device } = require('../src/models');
const {
  computeDeviceStatus,
  refreshAllDeviceStatuses,
} = require('../src/services/deviceStatus.service');
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function secondsBefore(date, seconds) {
  return new Date(date.getTime() - seconds * 1000);
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
async function testPureStatusComputation() {
  const now = new Date('2026-06-01T20:30:00Z');
  const online = computeDeviceStatus(secondsBefore(now, 30), now);
  assert(online.status === 'online', '30 seconds old heartbeat should be online');
  const degraded = computeDeviceStatus(secondsBefore(now, 75), now);
  assert(degraded.status === 'degraded', '75 seconds old heartbeat should be degraded');
  const offline = computeDeviceStatus(secondsBefore(now, 120), now);
  assert(offline.status === 'offline', '120 seconds old heartbeat should be offline');
  const missing = computeDeviceStatus(null, now);
  assert(missing.status === 'offline', 'missing heartbeat should be offline');
  console.log('[OK] pure status computation');
}
async function testDatabaseStatusRefresh() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for this test.');
    console.error(dbResult);
    process.exit(1);
  }
  const now = new Date('2026-06-01T20:30:00Z');
  const runId = makeRunId();
  const prefix = 'esp32_status_test_' + runId;
  const onlineDeviceId = prefix + '_online_01';
  const degradedDeviceId = prefix + '_degraded_01';
  const offlineDeviceId = prefix + '_offline_01';
  try {
    await cleanup(prefix);
    await Device.create([
      {
        device_id: onlineDeviceId,
        name: 'Online Test Device',
        status: 'offline',
        last_heartbeat_at: secondsBefore(now, 30),
        last_seen_at: secondsBefore(now, 30),
        is_active: true,
      },
      {
        device_id: degradedDeviceId,
        name: 'Degraded Test Device',
        status: 'online',
        last_heartbeat_at: secondsBefore(now, 75),
        last_seen_at: secondsBefore(now, 75),
        is_active: true,
      },
      {
        device_id: offlineDeviceId,
        name: 'Offline Test Device',
        status: 'online',
        last_heartbeat_at: secondsBefore(now, 120),
        last_seen_at: secondsBefore(now, 120),
        is_active: true,
      },
    ]);
    const refreshResult = await refreshAllDeviceStatuses(now);
    assert(refreshResult.refreshed, 'refresh should run');
    assert(refreshResult.checked_count >= 3, 'at least three devices should be checked');
    const onlineDevice = await Device.findOne({ device_id: onlineDeviceId });
    const degradedDevice = await Device.findOne({ device_id: degradedDeviceId });
    const offlineDevice = await Device.findOne({ device_id: offlineDeviceId });
    assert(onlineDevice.status === 'online', 'online test device should be online');
    assert(degradedDevice.status === 'degraded', 'degraded test device should be degraded');
    assert(offlineDevice.status === 'offline', 'offline test device should be offline');
    console.log('[OK] database device status refresh');
  } finally {
    await cleanup(prefix);
    await disconnectDatabase();
  }
}
async function main() {
  await testPureStatusComputation();
  await testDatabaseStatusRefresh();
  console.log('Device status service tests passed.');
}
main().catch(async (error) => {
  console.error('[FAIL] device status service test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
