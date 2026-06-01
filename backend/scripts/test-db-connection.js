const {
  connectDatabase,
  getDatabaseStatus,
  disconnectDatabase,
} = require('../src/config/database');
async function main() {
  console.log('Testing MongoDB connection...');
  const result = await connectDatabase();
  console.log('Connection result:');
  console.log(result);
  console.log('Database status:');
  console.log(getDatabaseStatus());
  if (!result.connected) {
    process.exitCode = 1;
  }
  await disconnectDatabase();
}
main().catch(async (error) => {
  console.error('Unexpected database test error:');
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
