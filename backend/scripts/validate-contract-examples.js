const fs = require('fs');
const path = require('path');
const {
  heartbeatSchema,
  telemetrySchema,
  eventSchema,
  accessSchema,
  overrideRequestSchema,
  overrideResultSchema,
  validatePayload,
} = require('../src/validators/payload.schemas');
const examplesDir = path.join(__dirname, '..', '..', 'contracts', 'examples');
const checks = [
  ['heartbeat.json', heartbeatSchema],
  ['telemetry.json', telemetrySchema],
  ['event_fire_detected.json', eventSchema],
  ['access_granted.json', accessSchema],
  ['override_request.json', overrideRequestSchema],
  ['override_result.json', overrideResultSchema],
];
let hasFailure = false;
for (const [fileName, schema] of checks) {
  const filePath = path.join(examplesDir, fileName);
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const result = validatePayload(schema, payload);
  if (!result.valid) {
    hasFailure = true;
    console.error(`[FAIL] ${fileName}`);
    console.error(result.errors);
  } else {
    console.log(`[OK] ${fileName}`);
  }
}
if (hasFailure) {
  process.exit(1);
}
console.log('All contract payload examples are valid.');
