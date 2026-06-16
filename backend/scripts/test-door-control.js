// Door Lock / Door Unlock tests — verifies the physical door control pipeline:
//  - admin override route accepts door_unlock and door_lock
//  - door_lock is BLOCKED during active fire/gas/CO (evacuation safety); door_unlock is allowed
//  - door_lock/door_unlock are never demo-auto-acked (stay "requested")
//  - a confirmed (executed) door_lock/door_unlock ACK flips Device.door_locked
//  - failed/blocked ACKs do NOT change Device.door_locked
//  - a heartbeat carrying door_locked updates Device.door_locked
//  - valve actions remain rejected
//  - door control and ARM/DISARM are independent (neither affects the other's state)
//
// RBAC note: door controls are admin-only because they go through the same
// POST /api/overrides route guarded by requireRole('admin') (see overrides.routes.js
// and test-rbac-middleware.js). The controller below does not re-check role.
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { OverrideRequest, Event, Device } = require('../src/models');
const { createOverride } = require('../src/controllers/overrides.controller');
const { handleMqttMessage } = require('../src/mqtt/mqttMessageHandler.service');
const { env } = require('../src/config/env');
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
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function submit(body) {
  const res = createMockRes();
  await createOverride({ body }, res);
  return res;
}
async function feedOverrideResult(device, overrideId, action, result) {
  const payload = {
    override_id: overrideId,
    device_id: device,
    actuator_id: 'door_controller_01',
    action,
    result,
    blocked_reason: null,
    timestamp: new Date().toISOString(),
  };
  return handleMqttMessage(
    'home/' + device + '/override/result',
    Buffer.from(JSON.stringify(payload), 'utf8'),
    { received_at: new Date().toISOString() }
  );
}
async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for this test.');
    console.error(dbResult);
    process.exit(1);
  }
  const runId = String(Date.now());
  const device = 'esp32_doortest_01';
  const fireDevice = 'esp32_doorfire_01';
  const gasDevice = 'esp32_doorgas_01';
  const prefix = 'ovr_door_test_' + runId;
  const fireEventId = 'evt_door_fire_' + runId;
  const gasEventId = 'evt_door_gas_' + runId;
  const origAutoAck = env.overrideDemoAutoAck;
  const origDelay = env.overrideDemoAutoAckDelayMs;
  const allDevices = [device, fireDevice, gasDevice];
  async function cleanup() {
    await OverrideRequest.deleteMany({ override_id: { $regex: '^' + prefix } });
    await Event.deleteMany({ event_id: { $in: [fireEventId, gasEventId] } });
    await Device.deleteMany({ device_id: { $in: allDevices } });
  }
  try {
    await cleanup();
    await Device.create({ device_id: device, name: 'Door Test', status: 'online' });
    await Device.create({ device_id: fireDevice, name: 'Door Fire', status: 'online' });
    await Device.create({ device_id: gasDevice, name: 'Door Gas', status: 'online' });

    // Auto-ack ON to prove door actions are still NOT auto-acked.
    env.overrideDemoAutoAck = true;
    env.overrideDemoAutoAckDelayMs = 50;

    // 1. door_unlock accepted by admin override route
    const unlockId = prefix + '_unlock_01';
    const unlockRes = await submit({
      override_id: unlockId, device_id: device, requested_by: 'usr_admin_001',
      actuator_id: 'door_controller_01', action: 'door_unlock', reason: 'Unlock test.',
    });
    assert(unlockRes.statusCode === 201, 'door_unlock: should return 201');
    assert(unlockRes.body.blocked !== true, 'door_unlock: must not be blocked');
    assert(unlockRes.body.override.status === 'requested', 'door_unlock: status requested');
    console.log('[OK] door_unlock accepted by override route');

    // 2. door_lock accepted when no hazard is active
    const lockId = prefix + '_lock_01';
    const lockRes = await submit({
      override_id: lockId, device_id: device, requested_by: 'usr_admin_001',
      actuator_id: 'door_controller_01', action: 'door_lock', reason: 'Lock test.',
    });
    assert(lockRes.statusCode === 201, 'door_lock no hazard: should return 201');
    assert(lockRes.body.blocked !== true, 'door_lock no hazard: must not be blocked');
    assert(lockRes.body.override.status === 'requested', 'door_lock no hazard: status requested');
    console.log('[OK] door_lock accepted when no hazard active');

    // 7. door_lock/door_unlock are NOT demo-auto-acked
    await sleep(300);
    const unlockRec = await OverrideRequest.findOne({ override_id: unlockId }).lean();
    const lockRec = await OverrideRequest.findOne({ override_id: lockId }).lean();
    assert(unlockRec.status === 'requested', 'door_unlock: must NOT be auto-acked');
    assert(lockRec.status === 'requested', 'door_lock: must NOT be auto-acked');
    console.log('[OK] door_lock/door_unlock are not demo-auto-acked');

    // 3. door_lock blocked during active fire
    await Event.create({
      event_id: fireEventId, device_id: fireDevice, room_id: 'kitchen',
      event_type: 'fire_detected', severity: 'critical', message: 'Door test fire.',
      confirmed: true, occurred_at: new Date(), received_at: new Date(),
    });
    const lockFireRes = await submit({
      override_id: prefix + '_lock_fire_01', device_id: fireDevice, requested_by: 'usr_admin_001',
      actuator_id: 'door_controller_01', action: 'door_lock', reason: 'Lock during fire.',
    });
    assert(lockFireRes.statusCode === 201, 'door_lock fire: should return 201');
    assert(lockFireRes.body.blocked === true, 'door_lock fire: must be blocked');
    assert(lockFireRes.body.override.status === 'blocked', 'door_lock fire: status blocked');
    assert(lockFireRes.body.mqtt_publish.published === false, 'door_lock fire: must not publish');
    console.log('[OK] door_lock blocked during active fire');

    // 5. door_unlock allowed during active fire
    const unlockFireRes = await submit({
      override_id: prefix + '_unlock_fire_01', device_id: fireDevice, requested_by: 'usr_admin_001',
      actuator_id: 'door_controller_01', action: 'door_unlock', reason: 'Unlock during fire.',
    });
    assert(unlockFireRes.statusCode === 201, 'door_unlock fire: should return 201');
    assert(unlockFireRes.body.blocked !== true, 'door_unlock fire: must NOT be blocked');
    console.log('[OK] door_unlock allowed during active fire');

    // 4. door_lock blocked during gas/CO
    await Event.create({
      event_id: gasEventId, device_id: gasDevice, room_id: 'kitchen',
      event_type: 'gas_detected', severity: 'critical', message: 'Door test gas.',
      confirmed: true, occurred_at: new Date(), received_at: new Date(),
    });
    const lockGasRes = await submit({
      override_id: prefix + '_lock_gas_01', device_id: gasDevice, requested_by: 'usr_admin_001',
      actuator_id: 'door_controller_01', action: 'door_lock', reason: 'Lock during gas.',
    });
    assert(lockGasRes.statusCode === 201, 'door_lock gas: should return 201');
    assert(lockGasRes.body.blocked === true, 'door_lock gas: must be blocked');
    console.log('[OK] door_lock blocked during gas/CO');

    // 12. valve actions remain rejected
    const valveRes = await submit({
      override_id: prefix + '_valve_01', device_id: device, requested_by: 'usr_admin_001',
      actuator_id: 'door_controller_01', action: 'valve_close', reason: 'Valve should reject.',
    });
    assert(valveRes.statusCode === 400, 'valve_close: must return 400');
    console.log('[OK] valve actions remain rejected');

    // 8. executed door_lock ACK sets Device.door_locked = true
    await Device.updateOne({ device_id: device }, { $set: { door_locked: false } });
    const lockAck = await feedOverrideResult(device, lockId, 'door_lock', 'executed');
    assert(lockAck.door_state && lockAck.door_state.applied === true, 'door_lock ACK: applied');
    let dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.door_locked === true, 'door_lock ACK: door_locked must be true');
    console.log('[OK] executed door_lock ACK sets door_locked = true');

    // 9. executed door_unlock ACK sets Device.door_locked = false
    const unlockAck = await feedOverrideResult(device, unlockId, 'door_unlock', 'executed');
    assert(unlockAck.door_state && unlockAck.door_state.applied === true, 'door_unlock ACK: applied');
    dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.door_locked === false, 'door_unlock ACK: door_locked must be false');
    console.log('[OK] executed door_unlock ACK sets door_locked = false');

    // 10. failed door_lock ACK does NOT change door_locked (stays false)
    const failId = prefix + '_lock_fail_01';
    await OverrideRequest.create({
      override_id: failId, device_id: device, requested_by: 'usr_admin_001',
      actuator_id: 'door_controller_01', action: 'door_lock', reason: 'Will fail.',
      status: 'requested', requested_at: new Date(),
    });
    const failAck = await feedOverrideResult(device, failId, 'door_lock', 'failed');
    assert(!failAck.door_state || failAck.door_state.applied === false, 'failed door_lock ACK: must NOT apply');
    dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.door_locked === false, 'failed door_lock ACK: door_locked must stay false');
    console.log('[OK] failed door_lock ACK does not change door_locked');

    // 11. heartbeat carrying door_locked updates Device.door_locked
    const hbPayload = {
      device_id: device, status: 'online', firmware_version: 'mch-integrated-v3',
      uptime_seconds: 120, wifi_rssi: -55, door_locked: true, timestamp: new Date().toISOString(),
    };
    const hbResult = await handleMqttMessage(
      'home/' + device + '/heartbeat',
      Buffer.from(JSON.stringify(hbPayload), 'utf8'),
      { received_at: new Date().toISOString() }
    );
    assert(hbResult.persistence.saved === true, 'heartbeat: persisted');
    dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.door_locked === true, 'heartbeat door_locked: must update device to true');
    console.log('[OK] heartbeat door_locked updates Device.door_locked');

    // 13. door control and ARM/DISARM are independent
    await Device.updateOne({ device_id: device }, { $set: { security_armed: true, door_locked: true } });
    // a door_unlock ACK must not change security_armed
    const indepUnlockId = prefix + '_indep_unlock_01';
    await OverrideRequest.create({
      override_id: indepUnlockId, device_id: device, requested_by: 'usr_admin_001',
      actuator_id: 'door_controller_01', action: 'door_unlock', reason: 'Independence test.',
      status: 'requested', requested_at: new Date(),
    });
    await feedOverrideResult(device, indepUnlockId, 'door_unlock', 'executed');
    dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.security_armed === true, 'independence: door_unlock ACK must not change security_armed');
    assert(dev.door_locked === false, 'independence: door_unlock ACK set door_locked false');
    // an arm ACK must not change door_locked
    const indepArmId = prefix + '_indep_arm_01';
    await OverrideRequest.create({
      override_id: indepArmId, device_id: device, requested_by: 'usr_admin_001',
      actuator_id: device, action: 'disarm', reason: 'Independence test.',
      status: 'requested', requested_at: new Date(),
    });
    await feedOverrideResult(device, indepArmId, 'disarm', 'executed');
    dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.door_locked === false, 'independence: disarm ACK must not change door_locked');
    assert(dev.security_armed === false, 'independence: disarm ACK set security_armed false');
    console.log('[OK] door control and ARM/DISARM are independent');

    console.log('Door control tests passed.');
  } finally {
    env.overrideDemoAutoAck = origAutoAck;
    env.overrideDemoAutoAckDelayMs = origDelay;
    await cleanup();
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] door control test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
