const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { Event } = require('../src/models');
const {
  listEvents,
  getEventById,
} = require('../src/controllers/events.controller');
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
  await Event.deleteMany({
    event_id: {
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
  const prefix = 'evt_api_test_' + runId;
  const eventId = prefix + '_fire_01';
  try {
    await cleanup(prefix);
    await Event.create([
      {
        event_id: eventId,
        device_id: 'esp32_home_01',
        room_id: 'kitchen',
        event_type: 'fire_detected',
        severity: 'critical',
        message: 'API test fire event.',
        sensor_id: 'flame_kitchen_01',
        raw_value: 1,
        confirmed: true,
        occurred_at: new Date('2026-06-01T21:00:00Z'),
        received_at: new Date('2026-06-01T21:00:01Z'),
      },
      {
        event_id: prefix + '_motion_01',
        device_id: 'esp32_home_01',
        room_id: 'living_room',
        event_type: 'motion_detected',
        severity: 'warning',
        message: 'API test motion event.',
        sensor_id: 'pir_living_01',
        raw_value: true,
        confirmed: true,
        occurred_at: new Date('2026-06-01T21:01:00Z'),
        received_at: new Date('2026-06-01T21:01:01Z'),
      },
    ]);
    const listReq = {
      query: {
        device_id: 'esp32_home_01',
        severity: 'critical',
        limit: '20',
      },
    };
    const listRes = createMockRes();
    await listEvents(listReq, listRes);
    assert(listRes.statusCode === 200, 'listEvents should return 200');
    assert(Array.isArray(listRes.body.events), 'listEvents should return events array');
    assert(
      listRes.body.events.some((event) => event.event_id === eventId),
      'listEvents should include critical test event'
    );
    console.log('[OK] listEvents controller');
    const getReq = {
      params: {
        eventId,
      },
    };
    const getRes = createMockRes();
    await getEventById(getReq, getRes);
    assert(getRes.statusCode === 200, 'getEventById should return 200');
    assert(
      getRes.body.event.event_id === eventId,
      'getEventById should return requested event'
    );
    console.log('[OK] getEventById controller');
    console.log('Event API controller tests passed.');
  } finally {
    await cleanup(prefix);
    await disconnectDatabase();
  }
}
main().catch(async (error) => {
  console.error('[FAIL] event API controller test failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
