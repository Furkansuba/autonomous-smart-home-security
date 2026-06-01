const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  TelemetrySummary,
} = require('../src/models');
const DEMO_DEVICE_IDS = [
  'esp32_demo_home_01',
  'esp32_demo_garage_01',
  'esp32_demo_entry_01',
];
async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for demo clean.');
    console.error(dbResult);
    process.exit(1);
  }
  const results = await Promise.all([
    Device.deleteMany({
      device_id: {
        $in: DEMO_DEVICE_IDS,
      },
    }),
    TelemetrySummary.deleteMany({
      device_id: {
        $in: DEMO_DEVICE_IDS,
      },
    }),
    Event.deleteMany({
      event_id: {
        $regex: '^evt_demo_',
      },
    }),
    AccessLog.deleteMany({
      access_id: {
        $regex: '^acc_demo_',
      },
    }),
    OverrideRequest.deleteMany({
      override_id: {
        $regex: '^ovr_demo_',
      },
    }),
  ]);
  console.log('Demo data clean completed.');
  console.log({
    devices_deleted: results[0].deletedCount,
    telemetry_deleted: results[1].deletedCount,
    events_deleted: results[2].deletedCount,
    access_logs_deleted: results[3].deletedCount,
    overrides_deleted: results[4].deletedCount,
  });
  await disconnectDatabase();
}
main().catch(async (error) => {
  console.error('[FAIL] demo data clean failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
