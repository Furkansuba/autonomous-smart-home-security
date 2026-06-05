require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { env } = require('./config/env');
const { connectDatabase, getDatabaseStatus } = require('./config/database');
const { startMqttClient, getMqttStatus } = require('./mqtt/mqttClient.service');
const { handleMqttMessage } = require('./mqtt/mqttMessageHandler.service');
const authRoutes = require('./routes/auth.routes');
const contractsRoutes = require('./routes/contracts.routes');
const mockRoutes = require('./routes/mock.routes');
const devicesRoutes = require('./routes/devices.routes');
const eventsRoutes = require('./routes/events.routes');
const accessLogsRoutes = require('./routes/accessLogs.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const overridesRoutes = require('./routes/overrides.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const usersRoutes = require('./routes/users.routes');
const {
  notFoundHandler,
  errorHandler,
} = require('./middleware/errorHandlers');
const app = express();
app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use(morgan('dev'));
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'autonomous-smart-home-backend',
    timestamp: new Date().toISOString(),
    database: getDatabaseStatus(),
    mqtt: getMqttStatus(),
    fcm: require('./services/fcm.service').getFcmStatus(),
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/access-logs', accessLogsRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/overrides', overridesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', usersRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
async function handleIncomingMqttMessage(topic, messageBuffer) {
  try {
    const result = await handleMqttMessage(topic, messageBuffer);
    if (result.handled) {
      console.log(
        '[MQTT] handled ' +
          topic +
          ' as ' +
          result.payload_type +
          ' for ' +
          result.device_id
      );
      return;
    }
    console.warn('[MQTT] rejected ' + topic + ': ' + result.reason);
  } catch (error) {
    console.error('[MQTT] unexpected handler error: ' + error.message);
  }
}
app.listen(env.port, async () => {
  console.log('Backend server running on port ' + env.port);
  const databaseResult = await connectDatabase();
  if (databaseResult.connected) {
    console.log('MongoDB connected: ' + databaseResult.database);
  } else if (databaseResult.skipped) {
    console.log('MongoDB connection skipped: ' + databaseResult.reason);
  } else {
    console.error('MongoDB connection failed: ' + databaseResult.error);
  }
  const mqttResult = await startMqttClient(handleIncomingMqttMessage);
  if (mqttResult.started) {
    console.log('MQTT client started.');
  } else if (mqttResult.skipped) {
    console.log('MQTT client skipped: ' + mqttResult.reason);
  } else {
    console.error('MQTT client failed: ' + mqttResult.reason);
  }
});
