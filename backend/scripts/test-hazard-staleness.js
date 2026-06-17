// Hazard staleness / override-blocking tests (requires MongoDB).
//
// Proves stale historical hazard events do NOT permanently block overrides, while
// genuinely recent hazards still do, and maintenance_reset clears prior hazards.
// Events are never deleted (immutable audit records).
const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const { Event, OverrideRequest, Device } = require('../src/models');
const { createOverride } = require('../src/controllers/overrides.controller');
const { getActiveSafetyHazards } = require('../src/services/hazardState.service');
const { HAZARD_TTL_SECONDS } = require('../src/config/hazard');
const { env } = require('../src/config/env');

function assert(c, m) { if (!c) throw new Error(m); }
function createMockRes() {
  return {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
}
const TTL_MS = HAZARD_TTL_SECONDS.gas_detected * 1000; // 120s
const STALE_MS = TTL_MS + 80 * 1000; // safely past TTL

async function submit(body) {
  const res = createMockRes();
  await createOverride({ body }, res);
  return res;
}

async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for this test.');
    console.error(dbResult);
    process.exit(1);
  }
  const runId = String(Date.now());
  const ids = [];
  const ev = (p) => { const id = `evt_haz_${p}_${runId}`; ids.push(id); return id; };
  const ovr = (p) => `ovr_haz_${p}_${runId}`;
  // Run-unique device IDs so previous/concurrent runs and live production data can
  // never interfere, and so device-scoped cleanup only removes this run's records.
  const dev = (p) => `esp32_haz${p}_${runId}`;
  const recentDev = dev('recent');
  const staleDev = dev('stale');
  const fireDev = dev('fire');
  const unlockDev = dev('unlock');
  const devices = [recentDev, staleDev, fireDev, unlockDev];
  const origAutoAck = env.overrideDemoAutoAck;

  async function cleanup() {
    // Every record this test creates targets the run-unique devices above, so scoping
    // cleanup by device_id removes only this run's data — events from other runs and
    // any live data are left untouched (events are immutable across the wider system).
    await Event.deleteMany({ device_id: { $in: devices } });
    await OverrideRequest.deleteMany({ device_id: { $in: devices } });
    await Device.deleteMany({ device_id: { $in: devices } });
  }
  function mkEvent(id, device, type, occurredAt) {
    return Event.create({
      event_id: id, device_id: device, room_id: 'kitchen', event_type: type,
      severity: 'critical', message: 'hazard staleness test', confirmed: true,
      occurred_at: occurredAt, received_at: occurredAt,
    });
  }
  function base(device, action, extra) {
    return { device_id: device, requested_by: 'usr_admin_001', actuator_id: extra || 'door_controller_01', action, reason: 'test' };
  }

  try {
    env.overrideDemoAutoAck = false; // deterministic statuses
    await cleanup();
    for (const d of devices) await Device.create({ device_id: d, name: d, status: 'online' });
    const now = Date.now();

    // 1. RECENT gas → door_lock blocked
    // The controller stores the long human-readable text in override.blocked_reason and
    // the stable machine code in mqtt_publish.reason; assert against the latter.
    await mkEvent(ev('recent_gas'), recentDev, 'gas_detected', new Date(now - 5000));
    let r = await submit(base(recentDev, 'door_lock'));
    assert(r.body.blocked === true && r.body.mqtt_publish.reason === 'door_lock_blocked_hazard',
      '1) recent gas should block door_lock');
    console.log('[OK] 1 door_lock blocked by recent gas');

    // 2. STALE gas (older than TTL) → door_lock allowed
    await mkEvent(ev('stale_gas'), staleDev, 'gas_detected', new Date(now - STALE_MS));
    r = await submit(base(staleDev, 'door_lock'));
    assert(r.body.blocked !== true && r.body.override.status === 'requested',
      '2) stale gas should NOT block door_lock');
    console.log('[OK] 2 door_lock allowed when gas is stale');

    // 3. door_unlock always allowed, even with recent gas
    r = await submit(base(recentDev, 'door_unlock'));
    assert(r.body.blocked !== true, '3) door_unlock must be allowed during active hazard');
    console.log('[OK] 3 door_unlock allowed during active hazard');

    // 4. pump_off allowed when only OLD gas exists and no active fire
    r = await submit(base(staleDev, 'pump_off', 'pump_01'));
    assert(r.body.blocked !== true, '4) pump_off should not be blocked by old gas (no active fire)');
    console.log('[OK] 4 pump_off allowed with only stale gas');

    // 5a. pump_on blocked with recent gas
    r = await submit(base(recentDev, 'pump_on', 'pump_kit_01'));
    assert(r.body.blocked === true && r.body.mqtt_publish.reason === 'pump_lockout_gas_co',
      '5a) recent gas should block pump_on');
    // 5b. pump_on allowed when gas is stale
    r = await submit(base(staleDev, 'pump_on', 'pump_kit_01'));
    assert(r.body.blocked !== true, '5b) stale gas should NOT block pump_on');
    console.log('[OK] 5 pump_on blocked on recent gas, allowed on stale gas');

    // 6. RECENT fire → door_lock + pump_off blocked
    await mkEvent(ev('fire1'), fireDev, 'fire_detected', new Date(now - 5000));
    r = await submit(base(fireDev, 'door_lock'));
    assert(r.body.blocked === true, '6a) recent fire should block door_lock');
    r = await submit(base(fireDev, 'pump_off', 'pump_01'));
    assert(r.body.blocked === true && r.body.mqtt_publish.reason === 'pump_off_blocked_fire_active',
      '6b) recent fire should block pump_off');
    console.log('[OK] 6 recent fire blocks door_lock + pump_off');

    // 7. successful maintenance_reset AFTER the fire → clears blocking
    await OverrideRequest.create({
      override_id: ovr('reset'), device_id: fireDev, requested_by: 'usr_admin_001',
      actuator_id: 'pump_01', action: 'maintenance_reset', reason: 'threat cleared',
      status: 'executed', result: 'executed',
      requested_at: new Date(now - 2000), result_at: new Date(now - 1000),
    });
    let hz = await getActiveSafetyHazards(fireDev);
    assert(hz.fire === false, '7a) fire must be cleared after reset newer than fire');
    r = await submit(base(fireDev, 'door_lock'));
    assert(r.body.blocked !== true, '7b) door_lock allowed after maintenance_reset');
    r = await submit(base(fireDev, 'pump_off', 'pump_01'));
    assert(r.body.blocked !== true, '7c) pump_off allowed after maintenance_reset');
    console.log('[OK] 7 maintenance_reset clears prior fire blocking');

    // 8. NEW fire AFTER reset → blocks again
    await mkEvent(ev('fire2'), fireDev, 'fire_detected', new Date(now));
    hz = await getActiveSafetyHazards(fireDev);
    assert(hz.fire === true, '8a) new fire after reset must be active again');
    r = await submit(base(fireDev, 'pump_off', 'pump_01'));
    assert(r.body.blocked === true, '8b) new fire after reset should block pump_off again');
    console.log('[OK] 8 future fire after reset blocks again');

    // 9. events were never deleted (immutability)
    const evCount = await Event.countDocuments({ event_id: { $in: ids } });
    assert(evCount === ids.length, '9) all hazard events must still exist (immutable audit)');
    console.log('[OK] 9 hazard events preserved (not deleted)');

    console.log('Hazard staleness tests passed.');
  } finally {
    env.overrideDemoAutoAck = origAutoAck;
    await cleanup();
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] hazard staleness test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
