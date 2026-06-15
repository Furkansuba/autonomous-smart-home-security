const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { Event, OverrideRequest } = require('../src/models');
const { computeActiveHazards } = require('../src/controllers/telemetry.controller');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function makeRunId() {
  return String(Date.now());
}

async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for this test.');
    console.error(dbResult);
    process.exit(1);
  }
  const runId = makeRunId();
  const device = 'esp32_hztest_01';
  const evPrefix = 'evt_hztest_' + runId;
  const ovPrefix = 'ovr_hztest_' + runId;

  async function cleanup() {
    await Event.deleteMany({ event_id: { $regex: '^' + evPrefix } });
    await OverrideRequest.deleteMany({ override_id: { $regex: '^' + ovPrefix } });
  }

  function hasHazard(hazards, eventType, roomId) {
    return hazards.some((h) => h.event_type === eventType && h.room_id === roomId);
  }

  try {
    await cleanup();

    // 1. Recent fire_detected appears active.
    await Event.create({
      event_id: evPrefix + '_fire_recent',
      device_id: device,
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Recent fire.',
      confirmed: true,
      occurred_at: new Date(Date.now() - 10 * 1000),
      received_at: new Date(),
    });
    let hazards = await computeActiveHazards({ device_id: device });
    assert(hasHazard(hazards, 'fire_detected', 'kitchen'), '1: recent fire must be active');
    const fireHz = hazards.find((h) => h.event_type === 'fire_detected');
    assert(fireHz.source === 'event_latch', '1: hazard source must be event_latch');
    assert(fireHz.ttl_seconds === 120, '1: fire ttl must be 120');
    console.log('[OK] recent fire_detected is active');

    // 2. fire_detected older than TTL is not active.
    await cleanup();
    await Event.create({
      event_id: evPrefix + '_fire_old',
      device_id: device,
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Old fire.',
      confirmed: true,
      occurred_at: new Date(Date.now() - 200 * 1000), // > 120s TTL
      received_at: new Date(Date.now() - 200 * 1000),
    });
    hazards = await computeActiveHazards({ device_id: device });
    assert(!hasHazard(hazards, 'fire_detected', 'kitchen'), '2: fire older than TTL must NOT be active');
    console.log('[OK] fire_detected older than TTL is not active');

    // 3. executed maintenance_reset newer than fire clears active fire.
    await cleanup();
    const baseTime = Date.now();
    await Event.create({
      event_id: evPrefix + '_fire_cleared',
      device_id: device,
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Fire before reset.',
      confirmed: true,
      occurred_at: new Date(baseTime - 60 * 1000),
      received_at: new Date(baseTime - 60 * 1000),
    });
    await OverrideRequest.create({
      override_id: ovPrefix + '_reset',
      device_id: device,
      requested_by: 'usr_admin_001',
      actuator_id: 'pump_01',
      action: 'maintenance_reset',
      reason: 'Threat cleared.',
      status: 'executed',
      result: 'executed',
      requested_at: new Date(baseTime - 40 * 1000),
      result_at: new Date(baseTime - 30 * 1000),
    });
    hazards = await computeActiveHazards({ device_id: device });
    assert(!hasHazard(hazards, 'fire_detected', 'kitchen'), '3: fire cleared by newer maintenance_reset');
    console.log('[OK] executed maintenance_reset newer than fire clears active fire');

    // 4. new fire_detected after maintenance_reset becomes active again.
    await Event.create({
      event_id: evPrefix + '_fire_after_reset',
      device_id: device,
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'New fire after reset.',
      confirmed: true,
      occurred_at: new Date(baseTime), // newer than reset (baseTime - 30s)
      received_at: new Date(baseTime),
    });
    hazards = await computeActiveHazards({ device_id: device });
    assert(hasHazard(hazards, 'fire_detected', 'kitchen'), '4: new fire after reset must be active again');
    console.log('[OK] new fire_detected after maintenance_reset is active again');

    // 5. recent gas/CO events appear active.
    await cleanup();
    await Event.create({
      event_id: evPrefix + '_gas',
      device_id: device,
      room_id: 'kitchen',
      event_type: 'gas_detected',
      severity: 'critical',
      message: 'Recent gas.',
      confirmed: true,
      occurred_at: new Date(Date.now() - 5 * 1000),
      received_at: new Date(),
    });
    await Event.create({
      event_id: evPrefix + '_co',
      device_id: device,
      room_id: 'garage',
      event_type: 'co_detected',
      severity: 'critical',
      message: 'Recent CO.',
      confirmed: true,
      occurred_at: new Date(Date.now() - 5 * 1000),
      received_at: new Date(),
    });
    hazards = await computeActiveHazards({ device_id: device });
    assert(hasHazard(hazards, 'gas_detected', 'kitchen'), '5: recent gas must be active');
    assert(hasHazard(hazards, 'co_detected', 'garage'), '5: recent CO must be active');
    console.log('[OK] recent gas/CO events are active');

    console.log('Telemetry hazard derivation tests passed.');
  } finally {
    await cleanup();
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] telemetry hazard derivation test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
