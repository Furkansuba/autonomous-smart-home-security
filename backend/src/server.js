require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { env } = require('./config/env');
const { connectDatabase, getDatabaseStatus } = require('./config/database');
const contractsRoutes = require('./routes/contracts.routes');
const mockRoutes = require('./routes/mock.routes');
const devicesRoutes = require('./routes/devices.routes');
const eventsRoutes = require('./routes/events.routes');
const accessLogsRoutes = require('./routes/accessLogs.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const overridesRoutes = require('./routes/overrides.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
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
  });
});
app.use('/api/contracts', contractsRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/access-logs', accessLogsRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/overrides', overridesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});
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
});
