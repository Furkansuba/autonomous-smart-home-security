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
  const passwordHash = await hashPassword('Admin123!');
  await User.findOneAndUpdate(
    {
      email: 'admin@smarthome.local',
    },
    {
      user_id: 'usr_admin_001',
      email: 'admin@smarthome.local',
      password_hash: passwordHash,
      full_name: 'Demo Admin',
      role: 'admin',
      is_active: true,
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    }
  );
  console.log('Demo admin user seeded.');
  console.log({
    email: 'admin@smarthome.local',
    password: 'Admin123!',
    role: 'admin',
  });
  await disconnectDatabase();
}
main().catch(async (error) => {
  console.error('[FAIL] demo auth seed failed');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
