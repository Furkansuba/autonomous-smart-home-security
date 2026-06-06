/**
 * Seed admin registration keys.
 *
 * Generates cryptographically random keys at runtime.
 * Plaintext keys are printed ONCE on the console and NEVER stored anywhere —
 * only their SHA-256 hashes are written to the database.
 *
 * Usage:
 *   node scripts/seed-admin-keys.js          # generates 2 keys
 *   node scripts/seed-admin-keys.js 3        # generates 3 keys
 *
 * Save the printed plaintext keys immediately.
 * They cannot be recovered after this script exits.
 */
const crypto = require('crypto');
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { AdminKey } = require('../src/models');

function generatePlainKey() {
  const bytes = crypto.randomBytes(16); // 128 bits of entropy
  const hex = bytes.toString('hex').toUpperCase();
  // Format: ADMIN-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
  return `ADMIN-${hex.slice(0,8)}-${hex.slice(8,16)}-${hex.slice(16,24)}-${hex.slice(24,32)}`;
}

async function main() {
  const count = Math.max(1, Math.min(10, parseInt(process.argv[2], 10) || 2));

  const result = await connectDatabase();
  if (!result.connected) {
    console.error('MongoDB connection required to seed admin keys.');
    process.exit(1);
  }

  const generated = [];

  for (let i = 0; i < count; i++) {
    const plainKey = generatePlainKey();
    const keyHash = AdminKey.hashKey(plainKey);

    // Collision is astronomically unlikely, but skip gracefully if hash exists
    const existing = await AdminKey.findOne({ key_hash: keyHash });
    if (existing) {
      console.log(`[SKIP] Hash collision on attempt ${i + 1} (retry script to generate a replacement)`);
      continue;
    }

    await AdminKey.create({ key_hash: keyHash, device_id: 'esp32_home_01' });
    generated.push({ plainKey, hashPrefix: keyHash.slice(0, 12) });
  }

  if (generated.length === 0) {
    console.error('No keys were seeded.');
    await disconnectDatabase();
    process.exit(1);
  }

  console.log('');
  console.log('=================================================================');
  console.log('  ADMIN REGISTRATION KEYS - SAVE NOW, NOT STORED ELSEWHERE');
  console.log('=================================================================');
  generated.forEach(({ plainKey, hashPrefix }, idx) => {
    console.log(`  [${idx + 1}] ${plainKey}`);
    console.log(`      hash prefix: ${hashPrefix}...`);
  });
  console.log('-----------------------------------------------------------------');
  console.log('  Plaintext will NOT be shown again. DB stores hashes only.');
  console.log('=================================================================');
  console.log('');
  console.log(`Seeded ${generated.length} key(s) to MongoDB.`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
