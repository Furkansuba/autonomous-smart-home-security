const fs = require('fs');
const path = require('path');
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { ingestMqttMessage } = require('../src/services/ingestion.service');
const { persistAcceptedIngestion } = require('../src/services/persistence.service');
const {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  TelemetrySummary,
} = require('../src/models');
const examplesDir = path.join(__dirname, '..', '..', 'contracts', 'examples');
function readExample(fileName) {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, fileName), 'utf8'));
}
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function makeRunId() {
  return String(Date.now());
}
function makeDeviceId(runId) {
  return 'esp32_test_' + runId + '_01';
}
async function cleanup(deviceId, ids) {
  await Device.deleteMany({ device_id: deviceId });
  await TelemetrySummary.deleteMany({ device_id: deviceId });
  await Event.deleteMany({ device_id: deviceId });
  await AccessLog.deleteMany({ device_id: deviceId });
  await OverrideRequest.deleteMany({
    $or: [
      { device_id: deviceId },
      { override_id: ids.override_id },
    ],
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
  const deviceId = makeDeviceId(runId);
  const ids = {
    event_id: 'evt_test_' + runId,
    access_id: 'acc_test_' + runId,
    override_id: 'ovr_test_' + runId,
  };
  try {
    await cleanup(deviceId, ids);
    const heartbeat = readExample('heartbeat.json');
    heartbeat.device_id = deviceId;
    const heartbeatIngestion = ingestMqttMessage(
      'home/' + deviceId + '/heartbeat',
      heartbeat,
      { received_at: '2026-06-01T20:00:00Z' }
    );
    const heartbeatPersistence = await persistAcceptedIngestion(heartbeatIngestion);
    assert(heartbeatPersistence.saved, 'heartbeat should be persisted as Device update');
    const savedDevice = await Device.findOne({ device_id: deviceId });
    assert(savedDevice, 'Device should exist after heartbeat persistence');
    assert(savedDevice.status === 'online', 'Device status should be online');
    console.log('[OK] heartbeat persisted to Device');
    const telemetry = readExample('telemetry.json');
    telemetry.device_id = deviceId;
    const telemetryIngestion = ingestMqttMessage(
      'home/' + deviceId + '/telemetry',
      telemetry,
      { received_at: '2026-06-01T20:00:01Z' }
    );
    const telemetryPersistence = await persistAcceptedIngestion(telemetryIngestion);
    assert(telemetryPersistence.saved, 'telemetry should be persisted');
    const savedTelemetry = await TelemetrySummary.findOne({ device_id: deviceId });
    assert(savedTelemetry, 'TelemetrySummary should exist');
    console.log('[OK] telemetry persisted to TelemetrySummary');
    const event = readExample('event_fire_detected.json');
    event.device_id = deviceId;
    event.event_id = ids.event_id;
    const eventIngestion = ingestMqttMessage(
      'home/' + deviceId + '/event',
      event,
      { received_at: '2026-06-01T20:00:02Z' }
    );
    const eventPersistence = await persistAcceptedIngestion(eventIngestion);
    assert(eventPersistence.saved, 'event should be persisted');
    const savedEvent = await Event.findOne({ event_id: ids.event_id });
    assert(savedEvent, 'Event should exist');
    assert(savedEvent.severity === 'critical', 'Event severity should be critical');
    console.log('[OK] event persisted to Event');
    const access = readExample('access_granted.json');
    access.device_id = deviceId;
    access.access_id = ids.access_id;
    const accessIngestion = ingestMqttMessage(
      'home/' + deviceId + '/access',
      access,
      { received_at: '2026-06-01T20:00:03Z' }
    );
    const accessPersistence = await persistAcceptedIngestion(accessIngestion);
    assert(accessPersistence.saved, 'access should be persisted');
    const savedAccess = await AccessLog.findOne({ access_id: ids.access_id });
    assert(savedAccess, 'AccessLog should exist');
    assert(savedAccess.result === 'granted', 'Access result should be granted');
    console.log('[OK] access persisted to AccessLog');
    await OverrideRequest.create({
      override_id: ids.override_id,
      device_id: deviceId,
      requested_by: 'usr_admin_001',
      actuator_id: 'buzzer_01',
      action: 'buzzer_off',
      reason: 'Persistence test override.',
      status: 'requested',
      requested_at: new Date('2026-06-01T20:00:04Z'),
    });
    const overrideResult = readExample('override_result.json');
    overrideResult.device_id = deviceId;
    overrideResult.override_id = ids.override_id;
    const overrideIngestion = ingestMqttMessage(
      'home/' + deviceId + '/override/result',
      overrideResult,
      { received_at: '2026-06-01T20:00:05Z' }
    );
    const overridePersistence = await persistAcceptedIngestion(overrideIngestion);
    assert(overridePersistence.saved, 'override result should update OverrideRequest');
    const savedOverride = await OverrideRequest.findOne({
      override_id: ids.override_id,
    });
    assert(savedOverride, 'OverrideRequest should exist');
    assert(savedOverride.status === 'executed', 'Override status should be executed');
    console.log('[OK] override result persisted to OverrideRequest');
    console.log('Persistence service tests passed.');
  } finally {
    await cleanup(deviceId, ids);
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] persistence service test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
