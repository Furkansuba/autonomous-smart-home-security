require('dotenv').config();
function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value).toLowerCase() === 'true';
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
  mqttEnabled: toBoolean(process.env.MQTT_ENABLED, false),
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  mqttClientId: process.env.MQTT_CLIENT_ID || 'smart_home_backend',
  mqttUsername: process.env.MQTT_USERNAME || '',
  mqttPassword: process.env.MQTT_PASSWORD || '',
  mqttSubscribeTopics: toList(
    process.env.MQTT_SUBSCRIBE_TOPICS ||
      'home/+/heartbeat,home/+/telemetry,home/+/event,home/+/access,home/+/override/result'
  ),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  fcmEnabled: toBoolean(process.env.FCM_ENABLED, false),
  firebaseServiceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
  smsEnabled: toBoolean(process.env.SMS_ENABLED, false),
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  smsAlertTo: process.env.SMS_ALERT_TO || '',
  overrideDemoAutoAck: toBoolean(process.env.OVERRIDE_DEMO_AUTO_ACK, false),
  overrideDemoAutoAckDelayMs: toNumber(process.env.OVERRIDE_DEMO_AUTO_ACK_DELAY_MS, 500),
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
    mqttEnabled: env.mqttEnabled,
    mqttBrokerUrl: env.mqttBrokerUrl,
    mqttClientId: env.mqttClientId,
    mqttSubscribeTopics: env.mqttSubscribeTopics,
    corsOrigin: env.corsOrigin,
    fcmEnabled: env.fcmEnabled,
    fcmConfigured: Boolean(env.firebaseServiceAccountBase64),
    smsEnabled: env.smsEnabled,
    smsConfigured: Boolean(
      env.twilioAccountSid && env.twilioAuthToken && env.twilioFromNumber && env.smsAlertTo
    ),
    overrideDemoAutoAck: env.overrideDemoAutoAck,
  };
}
module.exports = {
  env,
  isMongoConfigured,
  getSafeEnvSummary,
};
