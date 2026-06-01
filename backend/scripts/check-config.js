const { getSafeEnvSummary } = require('../src/config/env');
const { getDatabaseStatus } = require('../src/config/database');
console.log('Environment summary:');
console.log(getSafeEnvSummary());
console.log('Database status:');
console.log(getDatabaseStatus());
