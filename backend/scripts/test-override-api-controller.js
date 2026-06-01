const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { OverrideRequest } = require('../src/models');
const {
  listOverrides,
  getOverrideById,
  createOverride,
} = require('../src/controllers/overrides.controller');
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
    console.log('Override API controller tests passed.');
  } finally {
    await cleanup(prefix);
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] override API controller test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
