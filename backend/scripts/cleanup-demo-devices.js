// Demo device cleanup — REMOVES the seeded demo controller records from the devices
// collection so they no longer appear in the live Devices table / dashboard.
//
// Scope is deliberately narrow and safe:
//   * Deletes ONLY the three exact seeded demo controller IDs listed below.
//   * NEVER deletes esp32_home_01 (the real controller) or any other device.
//   * Touches ONLY the devices collection — events, telemetry, access logs,
//     override logs, and notification logs are left untouched in this phase.
//   * Idempotent — running it again after deletion is a harmless no-op.
//
// Dry-run by default (prints what WOULD be deleted, deletes nothing):
//     npm run cleanup:demo-devices
// Execute the deletion:
//     npm run cleanup:demo-devices -- --execute
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { Device } = require('../src/models');

// Real controller that must never be deleted.
const PROTECTED_DEVICE_IDS = ['esp32_home_01'];

// The exact seeded demo controller documents to remove (see seed-demo-data.js).
const DEMO_DEVICE_IDS = [
  'esp32_demo_entry_01',
  'esp32_demo_garage_01',
  'esp32_demo_home_01',
];

const EXECUTE = process.argv.includes('--execute');

async function main() {
  // Defensive: never allow a protected ID into the delete target list.
  const targets = DEMO_DEVICE_IDS.filter((id) => !PROTECTED_DEVICE_IDS.includes(id));

  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for demo device cleanup.');
    console.error(dbResult);
    process.exit(1);
  }

  try {
    // Which of the exact demo devices currently exist?
    const found = await Device.find({ device_id: { $in: targets } })
      .select('device_id is_active status')
      .lean();
    const foundIds = found.map((d) => d.device_id);
    const missing = targets.filter((id) => !foundIds.includes(id));

    let deleted = [];
    if (EXECUTE && foundIds.length > 0) {
      // Delete ONLY the demo IDs that exist — scoped strictly to those device_ids.
      await Device.deleteMany({ device_id: { $in: foundIds } });
      deleted = foundIds;
    }

    // Report-only: confirm the real controller is present and active (never modified).
    const mainController = await Device.findOne({ device_id: 'esp32_home_01' })
      .select('device_id is_active status')
      .lean();

    console.log(
      EXECUTE
        ? '[EXECUTE] Demo device cleanup — removing exact demo controller records.'
        : '[DRY-RUN] Demo device cleanup — NOTHING deleted. Re-run with `-- --execute` to delete.'
    );
    console.log({
      mode: EXECUTE ? 'execute' : 'dry-run',
      target_demo_ids: targets,
      found: foundIds,
      deleted: EXECUTE ? deleted : [],
      would_delete: EXECUTE ? [] : foundIds,
      missing,
      protected: PROTECTED_DEVICE_IDS,
      esp32_home_01: mainController
        ? { present: true, is_active: mainController.is_active, status: mainController.status }
        : { present: false },
    });

    if (foundIds.length === 0) {
      console.log('No demo devices present — nothing to remove (idempotent no-op).');
    }
  } catch (error) {
    console.error('[FAIL] demo device cleanup failed');
    console.error(error);
    await disconnectDatabase();
    process.exit(1);
  }

  await disconnectDatabase();
}

main();
