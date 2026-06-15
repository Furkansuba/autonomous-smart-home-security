const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { OverrideRequest, Event } = require('../src/models');
const {
  listOverrides,
  getOverrideById,
  createOverride,
} = require('../src/controllers/overrides.controller');
const { env } = require('../src/config/env');
const { persistMappedOperation } = require('../src/services/persistence.service');
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
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function cleanup(prefix) {
  await OverrideRequest.deleteMany({
    override_id: {
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
  const prefix = 'ovr_api_test_' + runId;
  const overrideId = prefix + '_buzzer_off_01';
  const lockoutPrefix = 'ovr_lockout_test_' + runId;
  const lockoutEventId = 'evt_lockout_test_' + runId;
  const autoAckPrefix = 'ovr_autoack_test_' + runId;
  const autoAckHazardEventId = 'evt_autoack_hazard_' + runId;
  const pumpFirePrefix = 'ovr_pumpfire_test_' + runId;
  const pumpFireEventId = 'evt_pumpfire_test_' + runId;
  const pumpDevice = 'esp32_pumpsafety_01';
  const mrPrefix = 'ovr_mreset_test_' + runId;
  const mrFireEventId = 'evt_mreset_fire_' + runId;
  const mrFireEventId2 = 'evt_mreset_fire2_' + runId;
  const mrDevice = 'esp32_mreset_01';
  const origAutoAck = env.overrideDemoAutoAck;
  const origDelay = env.overrideDemoAutoAckDelayMs;
  try {
    await cleanup(prefix);
    const createReq = {
      body: {
        override_id: overrideId,
        device_id: 'esp32_home_01',
        requested_by: 'usr_admin_001',
        actuator_id: 'buzzer_01',
        action: 'buzzer_off',
        reason: 'API controller test override.',
      },
    };
    const createRes = createMockRes();
    await createOverride(createReq, createRes);
    assert(createRes.statusCode === 201, 'createOverride should return 201');
    assert(createRes.body.created === true, 'createOverride should return created true');
    assert(
      createRes.body.override.override_id === overrideId,
      'createOverride should return created override'
    );
    console.log('[OK] createOverride controller');
    const listReq = {
      query: {
        device_id: 'esp32_home_01',
        status: 'requested',
        limit: '20',
      },
    };
    const listRes = createMockRes();
    await listOverrides(listReq, listRes);
    assert(listRes.statusCode === 200, 'listOverrides should return 200');
    assert(Array.isArray(listRes.body.overrides), 'listOverrides should return overrides array');
    assert(
      listRes.body.overrides.some((item) => item.override_id === overrideId),
      'listOverrides should include created override'
    );
    console.log('[OK] listOverrides controller');
    const getReq = {
      params: {
        overrideId,
      },
    };
    const getRes = createMockRes();
    await getOverrideById(getReq, getRes);
    assert(getRes.statusCode === 200, 'getOverrideById should return 200');
    assert(
      getRes.body.override.override_id === overrideId,
      'getOverrideById should return requested override'
    );
    console.log('[OK] getOverrideById controller');
    await Event.create({
      event_id: lockoutEventId,
      device_id: 'esp32_home_01',
      room_id: 'kitchen',
      event_type: 'gas_detected',
      severity: 'critical',
      message: 'Lockout test: gas detected.',
      confirmed: true,
      occurred_at: new Date(),
      received_at: new Date(),
    });
    const lockoutReq = {
      body: {
        override_id: lockoutPrefix + '_pump_on_01',
        device_id: 'esp32_home_01',
        requested_by: 'usr_admin_001',
        actuator_id: 'pump_01',
        action: 'pump_on',
        reason: 'Lockout test pump_on attempt.',
      },
    };
    const lockoutRes = createMockRes();
    await createOverride(lockoutReq, lockoutRes);
    assert(lockoutRes.statusCode === 201, 'blocked pump_on should return 201');
    assert(lockoutRes.body.created === true, 'blocked pump_on should have created: true');
    assert(lockoutRes.body.blocked === true, 'pump_on lockout should return blocked: true');
    assert(
      lockoutRes.body.override.status === 'blocked',
      'blocked override status should be blocked'
    );
    assert(
      typeof lockoutRes.body.override.blocked_reason === 'string' &&
        lockoutRes.body.override.blocked_reason.length > 0,
      'blocked override should have a non-empty blocked_reason'
    );
    assert(
      lockoutRes.body.mqtt_publish.published === false,
      'blocked pump_on should not publish MQTT command'
    );
    console.log('[OK] pump_on blocked by gas/CO lockout');

    // Test: auto-ack disabled — buzzer_off stays requested
    env.overrideDemoAutoAck = false;
    env.overrideDemoAutoAckDelayMs = 50;
    const noAckId = autoAckPrefix + '_disabled_01';
    const noAckReq = {
      body: {
        override_id: noAckId,
        device_id: 'esp32_home_01',
        requested_by: 'usr_admin_001',
        actuator_id: 'buzzer_01',
        action: 'buzzer_off',
        reason: 'Auto-ack disabled test.',
      },
    };
    const noAckRes = createMockRes();
    await createOverride(noAckReq, noAckRes);
    assert(noAckRes.statusCode === 201, 'auto-ack disabled: should return 201');
    assert(noAckRes.body.override.status === 'requested', 'auto-ack disabled: initial status must be requested');
    await sleep(200);
    const noAckRecord = await OverrideRequest.findOne({ override_id: noAckId }).lean();
    assert(noAckRecord !== null, 'auto-ack disabled: override record must exist');
    assert(noAckRecord.status === 'requested', 'auto-ack disabled: status must remain requested');
    console.log('[OK] auto-ack disabled: buzzer_off stays requested');

    // Test: auto-ack enabled — buzzer_off becomes executed after delay
    env.overrideDemoAutoAck = true;
    env.overrideDemoAutoAckDelayMs = 50;
    const ackId = autoAckPrefix + '_enabled_01';
    const ackReq = {
      body: {
        override_id: ackId,
        device_id: 'esp32_home_01',
        requested_by: 'usr_admin_001',
        actuator_id: 'buzzer_01',
        action: 'buzzer_off',
        reason: 'Auto-ack enabled test.',
      },
    };
    const ackRes = createMockRes();
    await createOverride(ackReq, ackRes);
    assert(ackRes.statusCode === 201, 'auto-ack enabled: should return 201');
    assert(ackRes.body.override.status === 'requested', 'auto-ack enabled: initial response must be requested');
    await sleep(300);
    const ackRecord = await OverrideRequest.findOne({ override_id: ackId }).lean();
    assert(ackRecord !== null, 'auto-ack enabled: override record must exist');
    assert(ackRecord.status === 'executed', 'auto-ack enabled: status must be executed after delay');
    assert(ackRecord.result === 'executed', 'auto-ack enabled: result must be executed');
    assert(ackRecord.result_at instanceof Date, 'auto-ack enabled: result_at must be set');
    console.log('[OK] auto-ack enabled: buzzer_off becomes executed after delay');

    // Test: active hazard + buzzer_off — override executes as alarm ack; hazard event unchanged
    env.overrideDemoAutoAck = true;
    env.overrideDemoAutoAckDelayMs = 50;
    await Event.create({
      event_id: autoAckHazardEventId,
      device_id: 'esp32_home_01',
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Auto-ack hazard test: fire detected.',
      confirmed: true,
      occurred_at: new Date(),
      received_at: new Date(),
    });
    const hazardAckId = autoAckPrefix + '_hazard_01';
    const hazardAckReq = {
      body: {
        override_id: hazardAckId,
        device_id: 'esp32_home_01',
        requested_by: 'usr_admin_001',
        actuator_id: 'buzzer_01',
        action: 'buzzer_off',
        reason: 'Hazard active alarm silence test.',
      },
    };
    const hazardAckRes = createMockRes();
    await createOverride(hazardAckReq, hazardAckRes);
    await sleep(300);
    const hazardAckRecord = await OverrideRequest.findOne({ override_id: hazardAckId }).lean();
    assert(hazardAckRecord !== null, 'hazard auto-ack: override record must exist');
    assert(hazardAckRecord.status === 'executed', 'hazard auto-ack: buzzer_off must execute as alarm ack');
    const hazardEventStillExists = await Event.findOne({ event_id: autoAckHazardEventId }).lean();
    assert(hazardEventStillExists !== null, 'hazard auto-ack: fire_detected event must remain in Events collection');
    console.log('[OK] auto-ack hazard: buzzer_off executes as alarm ack; fire_detected event unchanged');

    // Test: excluded action door_unlock stays requested regardless of auto-ack
    env.overrideDemoAutoAck = true;
    env.overrideDemoAutoAckDelayMs = 50;
    const excludedId = autoAckPrefix + '_excluded_01';
    const excludedReq = {
      body: {
        override_id: excludedId,
        device_id: 'esp32_home_01',
        requested_by: 'usr_admin_001',
        actuator_id: 'door_01',
        action: 'door_unlock',
        reason: 'Excluded action test.',
      },
    };
    const excludedRes = createMockRes();
    await createOverride(excludedReq, excludedRes);
    assert(excludedRes.statusCode === 201, 'excluded action: should return 201');
    await sleep(200);
    const excludedRecord = await OverrideRequest.findOne({ override_id: excludedId }).lean();
    assert(excludedRecord !== null, 'excluded action: override record must exist');
    assert(excludedRecord.status === 'requested', 'excluded action: door_unlock must stay requested');
    console.log('[OK] auto-ack excluded: door_unlock stays requested');

    // ── Phase 2: fire-aware pump_off safety ──────────────────────────────
    env.overrideDemoAutoAck = true;
    env.overrideDemoAutoAckDelayMs = 50;

    // pump_off auto-acks to executed when there is NO recent fire for the device
    const pumpOkId = pumpFirePrefix + '_no_fire_01';
    const pumpOkReq = {
      body: {
        override_id: pumpOkId,
        device_id: pumpDevice,
        requested_by: 'usr_admin_001',
        actuator_id: 'pump_01',
        action: 'pump_off',
        reason: 'pump_off with no active fire.',
      },
    };
    const pumpOkRes = createMockRes();
    await createOverride(pumpOkReq, pumpOkRes);
    assert(pumpOkRes.statusCode === 201, 'pump_off no fire: should return 201');
    assert(pumpOkRes.body.blocked !== true, 'pump_off no fire: must not be blocked');
    assert(pumpOkRes.body.override.status === 'requested', 'pump_off no fire: initial status requested');
    await sleep(300);
    const pumpOkRecord = await OverrideRequest.findOne({ override_id: pumpOkId }).lean();
    assert(pumpOkRecord !== null, 'pump_off no fire: record must exist');
    assert(pumpOkRecord.status === 'executed', 'pump_off no fire: must auto-ack to executed');
    console.log('[OK] pump_off auto-acks executed when no recent fire');

    // pump_off is blocked (not auto-acked) when a recent fire_detected is active
    await Event.create({
      event_id: pumpFireEventId,
      device_id: pumpDevice,
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Pump safety test: fire detected.',
      confirmed: true,
      occurred_at: new Date(),
      received_at: new Date(),
    });
    const pumpFireId = pumpFirePrefix + '_fire_active_01';
    const pumpFireReq = {
      body: {
        override_id: pumpFireId,
        device_id: pumpDevice,
        requested_by: 'usr_admin_001',
        actuator_id: 'pump_01',
        action: 'pump_off',
        reason: 'pump_off attempt during active fire.',
      },
    };
    const pumpFireRes = createMockRes();
    await createOverride(pumpFireReq, pumpFireRes);
    assert(pumpFireRes.statusCode === 201, 'pump_off fire: should return 201');
    assert(pumpFireRes.body.blocked === true, 'pump_off fire: must be blocked');
    assert(pumpFireRes.body.override.status === 'blocked', 'pump_off fire: status must be blocked');
    assert(
      typeof pumpFireRes.body.override.blocked_reason === 'string' &&
        pumpFireRes.body.override.blocked_reason.length > 0,
      'pump_off fire: blocked_reason must be non-empty'
    );
    assert(pumpFireRes.body.mqtt_publish.published === false, 'pump_off fire: must not publish MQTT command');
    await sleep(200);
    const pumpFireRecord = await OverrideRequest.findOne({ override_id: pumpFireId }).lean();
    assert(pumpFireRecord.status === 'blocked', 'pump_off fire: must stay blocked, never auto-acked to executed');
    const fireStillExists = await Event.findOne({ event_id: pumpFireEventId }).lean();
    assert(fireStillExists !== null, 'pump_off fire: fire_detected event must not be cleared');
    console.log('[OK] pump_off blocked while fire active; hazard event preserved');

    // valve actions remain rejected (removed from the contract in Phase 1)
    const valveRejectId = pumpFirePrefix + '_valve_reject_01';
    const valveRejectReq = {
      body: {
        override_id: valveRejectId,
        device_id: pumpDevice,
        requested_by: 'usr_admin_001',
        actuator_id: 'pump_01',
        action: 'valve_close',
        reason: 'valve_close should be rejected.',
      },
    };
    const valveRejectRes = createMockRes();
    await createOverride(valveRejectReq, valveRejectRes);
    assert(valveRejectRes.statusCode === 400, 'valve_close: must be rejected with 400');
    const valveRejectRecord = await OverrideRequest.findOne({ override_id: valveRejectId }).lean();
    assert(valveRejectRecord === null, 'valve_close: rejected action must not be persisted');
    console.log('[OK] valve_close rejected as invalid action');

    // ── Phase 3: maintenance_reset (Confirm Threat Cleared) ──────────────
    env.overrideDemoAutoAck = true;
    env.overrideDemoAutoAckDelayMs = 50;

    // maintenance_reset without a reason is rejected
    const mrNoReasonId = mrPrefix + '_no_reason_01';
    const mrNoReasonRes = createMockRes();
    await createOverride(
      {
        body: {
          override_id: mrNoReasonId,
          device_id: mrDevice,
          requested_by: 'usr_admin_001',
          actuator_id: 'pump_01',
          action: 'maintenance_reset',
          reason: '   ',
        },
      },
      mrNoReasonRes
    );
    assert(mrNoReasonRes.statusCode === 400, 'maintenance_reset no reason: must return 400');
    const mrNoReasonRecord = await OverrideRequest.findOne({ override_id: mrNoReasonId }).lean();
    assert(mrNoReasonRecord === null, 'maintenance_reset no reason: must not be persisted');
    console.log('[OK] maintenance_reset without reason rejected');

    // maintenance_reset with a reason is created as requested and NOT auto-acked
    const mrId = mrPrefix + '_with_reason_01';
    const mrRes = createMockRes();
    await createOverride(
      {
        body: {
          override_id: mrId,
          device_id: mrDevice,
          requested_by: 'usr_admin_001',
          actuator_id: 'pump_01',
          action: 'maintenance_reset',
          reason: 'Verified false alarm — kitchen smoke cleared.',
        },
      },
      mrRes
    );
    assert(mrRes.statusCode === 201, 'maintenance_reset: should return 201');
    assert(mrRes.body.override.status === 'requested', 'maintenance_reset: initial status requested');
    await sleep(300);
    const mrRecord = await OverrideRequest.findOne({ override_id: mrId }).lean();
    assert(mrRecord !== null, 'maintenance_reset: record must exist');
    assert(mrRecord.status === 'requested', 'maintenance_reset: must NOT be auto-acked (stays requested)');
    console.log('[OK] maintenance_reset with reason created as requested, not auto-acked');

    // pump_off is allowed when a successful maintenance_reset is newer than the fire
    const baseTime = Date.now();
    await Event.create({
      event_id: mrFireEventId,
      device_id: mrDevice,
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Maintenance reset test: fire detected.',
      confirmed: true,
      occurred_at: new Date(baseTime - 60000),
      received_at: new Date(baseTime - 60000),
    });
    // Simulate a firmware-confirmed (executed) maintenance_reset AFTER the fire
    await OverrideRequest.create({
      override_id: mrPrefix + '_executed_01',
      device_id: mrDevice,
      requested_by: 'usr_admin_001',
      actuator_id: 'pump_01',
      action: 'maintenance_reset',
      reason: 'Threat cleared confirmation.',
      status: 'executed',
      result: 'executed',
      requested_at: new Date(baseTime - 30000),
      result_at: new Date(baseTime - 20000),
    });
    const pumpAfterResetId = mrPrefix + '_pumpoff_allowed_01';
    const pumpAfterResetRes = createMockRes();
    await createOverride(
      {
        body: {
          override_id: pumpAfterResetId,
          device_id: mrDevice,
          requested_by: 'usr_admin_001',
          actuator_id: 'pump_01',
          action: 'pump_off',
          reason: 'pump_off after confirmed reset.',
        },
      },
      pumpAfterResetRes
    );
    assert(pumpAfterResetRes.statusCode === 201, 'pump_off after reset: should return 201');
    assert(pumpAfterResetRes.body.blocked !== true, 'pump_off after reset: must NOT be blocked');
    assert(pumpAfterResetRes.body.override.status === 'requested', 'pump_off after reset: initial requested');
    console.log('[OK] pump_off allowed when successful maintenance_reset is newer than fire');

    // pump_off is blocked again when a NEW fire occurs after the maintenance_reset
    await Event.create({
      event_id: mrFireEventId2,
      device_id: mrDevice,
      room_id: 'kitchen',
      event_type: 'fire_detected',
      severity: 'critical',
      message: 'Maintenance reset test: NEW fire after reset.',
      confirmed: true,
      occurred_at: new Date(baseTime),
      received_at: new Date(baseTime),
    });
    const pumpReblockId = mrPrefix + '_pumpoff_reblocked_01';
    const pumpReblockRes = createMockRes();
    await createOverride(
      {
        body: {
          override_id: pumpReblockId,
          device_id: mrDevice,
          requested_by: 'usr_admin_001',
          actuator_id: 'pump_01',
          action: 'pump_off',
          reason: 'pump_off after new fire.',
        },
      },
      pumpReblockRes
    );
    assert(pumpReblockRes.statusCode === 201, 'pump_off reblock: should return 201');
    assert(pumpReblockRes.body.blocked === true, 'pump_off reblock: must be blocked by new fire');
    assert(pumpReblockRes.body.override.status === 'blocked', 'pump_off reblock: status must be blocked');
    console.log('[OK] pump_off blocked again after a new fire post-reset');

    // Test: already-resolved override — auto-ack is a no-op (status guard prevents double-update)
    const resolvedId = autoAckPrefix + '_resolved_01';
    await OverrideRequest.create({
      override_id: resolvedId,
      device_id: 'esp32_home_01',
      requested_by: 'usr_admin_001',
      actuator_id: 'buzzer_01',
      action: 'buzzer_off',
      reason: 'Already-resolved no-op test.',
      status: 'executed',
      result: 'executed',
      result_at: new Date(),
      requested_at: new Date(),
    });
    const noOpResult = await persistMappedOperation({
      kind: 'update',
      model: 'OverrideRequest',
      filter: { override_id: resolvedId, status: 'requested' },
      update: {
        $set: { status: 'executed', result: 'executed', result_at: new Date() },
      },
      options: { returnDocument: 'after' },
    });
    assert(noOpResult.saved === false, 'no-op: persistMappedOperation must return saved=false for already-resolved');
    assert(noOpResult.reason === 'target_not_found', 'no-op: reason must be target_not_found');
    const resolvedRecord = await OverrideRequest.findOne({ override_id: resolvedId }).lean();
    assert(resolvedRecord.status === 'executed', 'no-op: already-executed record must remain executed');
    console.log('[OK] auto-ack no-op: already-resolved override unchanged');

    env.overrideDemoAutoAck = origAutoAck;
    env.overrideDemoAutoAckDelayMs = origDelay;
    console.log('Override API controller tests passed.');
  } finally {
    env.overrideDemoAutoAck = origAutoAck;
    env.overrideDemoAutoAckDelayMs = origDelay;
    await cleanup(prefix);
    await Event.deleteMany({ event_id: lockoutEventId });
    await OverrideRequest.deleteMany({
      override_id: { $regex: '^' + lockoutPrefix },
    });
    await OverrideRequest.deleteMany({
      override_id: { $regex: '^' + autoAckPrefix },
    });
    await Event.deleteMany({ event_id: autoAckHazardEventId });
    await OverrideRequest.deleteMany({
      override_id: { $regex: '^' + pumpFirePrefix },
    });
    await Event.deleteMany({ event_id: pumpFireEventId });
    await OverrideRequest.deleteMany({
      override_id: { $regex: '^' + mrPrefix },
    });
    await Event.deleteMany({ event_id: { $in: [mrFireEventId, mrFireEventId2] } });
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] override API controller test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
