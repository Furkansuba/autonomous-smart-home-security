const mongoose = require('mongoose');
const { env, isMongoConfigured } = require('./env');
const MONGOOSE_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};
async function connectDatabase() {
  if (!isMongoConfigured()) {
    return {
      connected: false,
      skipped: true,
      reason: 'MONGODB_URI is not configured.',
    };
  }
  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    return {
      connected: true,
      skipped: false,
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    };
  } catch (error) {
    return {
      connected: false,
      skipped: false,
      error: error.message,
    };
  }
}
function getDatabaseStatus() {
  const readyState = mongoose.connection.readyState;
  return {
    readyState,
    status: MONGOOSE_STATES[readyState] || 'unknown',
    host: mongoose.connection.host || null,
    database: mongoose.connection.name || null,
  };
}
async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
module.exports = {
  connectDatabase,
  getDatabaseStatus,
  disconnectDatabase,
};
