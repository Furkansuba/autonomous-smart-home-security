const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database');
const { User } = require('../src/models');
const { hashPassword } = require('../src/auth/auth.service');
async function main() {
  const dbResult = await connectDatabase();
  if (!dbResult.connected) {
    console.error('MongoDB connection is required for demo auth seed.');
    console.error(dbResult);
    process.exit(1);
  }
  const passwordHash = await hashPassword('Resident123!');
  await User.findOneAndUpdate(
    {
      email: 'resident@smarthome.local',
    },
    {
      user_id: 'usr_resident_001',
      email: 'resident@smarthome.local',
      password_hash: passwordHash,
      full_name: 'Demo Resident',
      role: 'resident',
      is_active: true,
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    }
  );
  console.log('Demo resident user seeded.');
  console.log({
    email: 'resident@smarthome.local',
    password: 'Resident123!',
    role: 'resident',
  });
  await disconnectDatabase();
}
main().catch(async (error) => {
  console.error('[FAIL] demo resident seed failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
