require('dotenv').config();
function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function toList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, 5000),
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDnsServers: toList(process.env.MONGODB_DNS_SERVERS || ''),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  mqttUsername: process.env.MQTT_USERNAME || '',
  mqttPassword: process.env.MQTT_PASSWORD || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
function isMongoConfigured() {
  return Boolean(
    env.mongodbUri &&
      env.mongodbUri.trim().length > 0 &&
      !env.mongodbUri.includes('username:password') &&
      !env.mongodbUri.includes('change_this') &&
      !env.mongodbUri.includes('<db_password>') &&
      !env.mongodbUri.includes('...')
  );
}
function getSafeEnvSummary() {
  return {
    nodeEnv: env.nodeEnv,
    port: env.port,
    mongoConfigured: isMongoConfigured(),
    mongoDnsServers: env.mongodbDnsServers,
    jwtConfigured: Boolean(env.jwtSecret),
    mqttBrokerUrl: env.mqttBrokerUrl,
    corsOrigin: env.corsOrigin,
  };
}
module.exports = {
  env,
  isMongoConfigured,
  getSafeEnvSummary,
};
