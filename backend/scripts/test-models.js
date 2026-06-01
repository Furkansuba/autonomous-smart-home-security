const {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  NotificationLog,
  TelemetrySummary,
  User,
} = require('../src/models');
function assertModel(model, name) {
  if (!model || !model.modelName) {
    throw new Error(name + ' model is invalid.');
  }
  console.log('[OK] ' + name);
}
try {
  assertModel(Device, 'Device');
  assertModel(Event, 'Event');
  assertModel(AccessLog, 'AccessLog');
  assertModel(OverrideRequest, 'OverrideRequest');
  assertModel(NotificationLog, 'NotificationLog');
  assertModel(TelemetrySummary, 'TelemetrySummary');
  assertModel(User, 'User');
  console.log('All Mongoose model skeletons are valid.');
} catch (error) {
  console.error('[FAIL] Mongoose model test failed');
  console.error(error);
  process.exit(1);
}
