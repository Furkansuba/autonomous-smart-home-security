const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { AccessLog } = require('../src/models');
const {
  listAccessLogs,
  getAccessLogById,
} = require('../src/controllers/accessLogs.controller');
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
  await AccessLog.deleteMany({
    access_id: {
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
  const prefix = 'acc_api_test_' + runId;
  const accessId = prefix + '_granted_01';
  try {
    await cleanup(prefix);
    await AccessLog.create([
      {
        access_id: accessId,
        device_id: 'esp32_home_01',
        gate_id: 'main_door',
        user_id: 'usr_resident_001',
        access_method: 'nfc',
        result: 'granted',
        card_uid_hash: 'sha256:api_test_hash',
        occurred_at: new Date('2026-06-01T21:20:00Z'),
        received_at: new Date('2026-06-01T21:20:01Z'),
      },
      {
        access_id: prefix + '_denied_01',
        device_id: 'esp32_home_01',
        gate_id: 'main_door',
        user_id: 'usr_unknown_001',
        access_method: 'nfc',
        result: 'denied',
        card_uid_hash: 'sha256:api_test_denied_hash',
        occurred_at: new Date('2026-06-01T21:21:00Z'),
        received_at: new Date('2026-06-01T21:21:01Z'),
      },
    ]);
    const listReq = {
      query: {
        device_id: 'esp32_home_01',
        result: 'granted',
        limit: '20',
      },
    };
    const listRes = createMockRes();
    await listAccessLogs(listReq, listRes);
    assert(listRes.statusCode === 200, 'listAccessLogs should return 200');
    assert(Array.isArray(listRes.body.access_logs), 'listAccessLogs should return access_logs array');
    assert(
      listRes.body.access_logs.some((item) => item.access_id === accessId),
      'listAccessLogs should include granted test access log'
    );
    console.log('[OK] listAccessLogs controller');
    const getReq = {
      params: {
        accessId,
      },
    };
    const getRes = createMockRes();
    await getAccessLogById(getReq, getRes);
    assert(getRes.statusCode === 200, 'getAccessLogById should return 200');
    assert(
      getRes.body.access_log.access_id === accessId,
      'getAccessLogById should return requested access log'
    );
    console.log('[OK] getAccessLogById controller');
    console.log('Access Log API controller tests passed.');
  } finally {
    await cleanup(prefix);
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] access log API controller test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
