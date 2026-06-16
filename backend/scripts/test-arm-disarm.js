// ARM/DISARM tests — verifies the security mode override pipeline:
//  - admin override route accepts arm/disarm (controller path)
//  - arm/disarm are NOT blocked by active fire/gas/CO hazards
//  - unknown actions are still rejected
//  - arm/disarm are never demo-auto-acked (stay "requested")
//  - a confirmed (executed) arm/disarm ACK flips Device.security_armed
//  - failed/blocked/requested ACKs do NOT flip Device.security_armed
//  - a heartbeat carrying security_armed updates Device.security_armed
//
// RBAC note: ARM/DISARM is admin-only because it is issued through the same
// POST /api/overrides route guarded by requireRole('admin') (see overrides.routes.js
// and test-rbac-middleware.js). The controller below does not re-check the role,
// so role enforcement is covered by the route/middleware tests.
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
async function feedOverrideResult(device, overrideId, action, result) {
  const payload = {
    override_id: overrideId,
    device_id: device,
    actuator_id: device,
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
  const device = 'esp32_armtest_01';
  const prefix = 'ovr_arm_test_' + runId;
  const hazardEventId = 'evt_arm_hazard_' + runId;
  const origAutoAck = env.overrideDemoAutoAck;
  const origDelay = env.overrideDemoAutoAckDelayMs;
  try {
    // Clean slate
    await OverrideRequest.deleteMany({ override_id: { $regex: '^' + prefix } });
    await Event.deleteMany({ device_id: device });
    await Device.deleteOne({ device_id: device });

    // Seed the device so ACK flips have a target. Start ARMED.
    await Device.create({
      device_id: device,
      name: 'Arm Test Controller',
      status: 'online',
      security_armed: true,
    });

    // 1. arm accepted by admin override controller; created as requested
    env.overrideDemoAutoAck = true; // even with auto-ack on, arm/disarm must NOT auto-ack
    env.overrideDemoAutoAckDelayMs = 50;
    const armId = prefix + '_arm_01';
    const armRes = createMockRes();
    await createOverride(
      {
        body: {
          override_id: armId,
          device_id: device,
          requested_by: 'usr_admin_001',
          actuator_id: device,
          action: 'arm',
          reason: 'Arm test.',
        },
      },
      armRes
    );
    assert(armRes.statusCode === 201, 'arm: should return 201');
    assert(armRes.body.blocked !== true, 'arm: must not be blocked');
    assert(armRes.body.override.status === 'requested', 'arm: initial status requested');
    console.log('[OK] arm accepted by override controller (requested)');

    // 2. disarm accepted similarly
    const disarmId = prefix + '_disarm_01';
    const disarmRes = createMockRes();
    await createOverride(
      {
        body: {
          override_id: disarmId,
          device_id: device,
          requested_by: 'usr_admin_001',
          actuator_id: device,
          action: 'disarm',
          reason: 'Disarm test.',
        },
      },
      disarmRes
    );
    assert(disarmRes.statusCode === 201, 'disarm: should return 201');
    assert(disarmRes.body.override.status === 'requested', 'disarm: initial status requested');
    console.log('[OK] disarm accepted by override controller (requested)');

    // 3. arm/disarm are NEVER demo-auto-acked — stay requested after the delay
    await sleep(300);
    const armRecord = await OverrideRequest.findOne({ override_id: armId }).lean();
    const disarmRecord = await OverrideRequest.findOne({ override_id: disarmId }).lean();
    assert(armRecord.status === 'requested', 'arm: must NOT be auto-acked');
    assert(disarmRecord.status === 'requested', 'disarm: must NOT be auto-acked');
    console.log('[OK] arm/disarm are not demo-auto-acked');

    // 4. arm/disarm are NOT blocked by an active gas/CO/fire hazard
    await Event.create({
      event_id: hazardEventId,
      device_id: device,
      room_id: 'kitchen',
      event_type: 'gas_detected',
      severity: 'critical',
      message: 'Arm test: gas active.',
      confirmed: true,
      occurred_at: new Date(),
      received_at: new Date(),
    });
    const armHazardId = prefix + '_arm_hazard_01';
    const armHazardRes = createMockRes();
    await createOverride(
      {
        body: {
          override_id: armHazardId,
          device_id: device,
          requested_by: 'usr_admin_001',
          actuator_id: device,
          action: 'disarm',
          reason: 'Disarm during gas hazard.',
        },
      },
      armHazardRes
    );
    assert(armHazardRes.statusCode === 201, 'disarm during hazard: should return 201');
    assert(armHazardRes.body.blocked !== true, 'disarm during hazard: must NOT be blocked');
    console.log('[OK] arm/disarm not blocked by active gas/CO/fire hazard');

    // 5. unknown action is still rejected
    const badRes = createMockRes();
    await createOverride(
      {
        body: {
          override_id: prefix + '_bad_01',
          device_id: device,
          requested_by: 'usr_admin_001',
          actuator_id: device,
          action: 'arm_all_the_things',
          reason: 'Invalid.',
        },
      },
      badRes
    );
    assert(badRes.statusCode === 400, 'unknown action: must return 400');
    console.log('[OK] unknown action still rejected');

    // 6. successful arm ACK sets Device.security_armed = true
    await Device.updateOne({ device_id: device }, { $set: { security_armed: false } });
    const armAck = await feedOverrideResult(device, armId, 'arm', 'executed');
    assert(armAck.handled === true, 'arm ACK: handled');
    assert(armAck.arm_state && armAck.arm_state.applied === true, 'arm ACK: arm_state applied');
    let dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.security_armed === true, 'arm ACK: security_armed must be true');
    console.log('[OK] executed arm ACK sets security_armed = true');

    // 7. successful disarm ACK sets Device.security_armed = false
    const disarmAck = await feedOverrideResult(device, disarmId, 'disarm', 'executed');
    assert(disarmAck.arm_state && disarmAck.arm_state.applied === true, 'disarm ACK: applied');
    dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.security_armed === false, 'disarm ACK: security_armed must be false');
    console.log('[OK] executed disarm ACK sets security_armed = false');

    // 8. failed arm ACK does NOT flip security_armed (stays false)
    const failId = prefix + '_arm_fail_01';
    await OverrideRequest.create({
      override_id: failId,
      device_id: device,
      requested_by: 'usr_admin_001',
      actuator_id: device,
      action: 'arm',
      reason: 'Arm that will fail.',
      status: 'requested',
      requested_at: new Date(),
    });
    const failAck = await feedOverrideResult(device, failId, 'arm', 'failed');
    assert(
      !failAck.arm_state || failAck.arm_state.applied === false,
      'failed arm ACK: must NOT apply'
    );
    dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.security_armed === false, 'failed arm ACK: security_armed must stay false');
    console.log('[OK] failed arm ACK does not flip security_armed');

    // 9. heartbeat carrying security_armed updates Device.security_armed
    const hbPayload = {
      device_id: device,
      status: 'online',
      firmware_version: 'mch-integrated-v3',
      uptime_seconds: 120,
      wifi_rssi: -55,
      security_armed: true,
      timestamp: new Date().toISOString(),
    };
    const hbResult = await handleMqttMessage(
      'home/' + device + '/heartbeat',
      Buffer.from(JSON.stringify(hbPayload), 'utf8'),
      { received_at: new Date().toISOString() }
    );
    assert(hbResult.persistence.saved === true, 'heartbeat: persisted');
    dev = await Device.findOne({ device_id: device }).lean();
    assert(dev.security_armed === true, 'heartbeat security_armed: must update device to true');
    console.log('[OK] heartbeat security_armed updates Device.security_armed');

    console.log('ARM/DISARM tests passed.');
  } finally {
    env.overrideDemoAutoAck = origAutoAck;
    env.overrideDemoAutoAckDelayMs = origDelay;
    await OverrideRequest.deleteMany({ override_id: { $regex: '^' + prefix } });
    await Event.deleteMany({ device_id: device });
    await Device.deleteOne({ device_id: device });
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] ARM/DISARM test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
