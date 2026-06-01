const fs = require('fs');
const path = require('path');
const { ingestMqttMessage } = require('../src/services/ingestion.service');
const {
  mapAcceptedIngestionToPersistence,
} = require('../src/services/ingestionPersistence.mapper');
const examplesDir = path.join(__dirname, '..', '..', 'contracts', 'examples');
function readExample(fileName) {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, fileName), 'utf8'));
}
function assert(condition, message) {
  if (!condition) {
    console.error('[FAIL] ' + message);
    process.exit(1);
  }
}
function ingest(topic, fileName) {
  return ingestMqttMessage(topic, readExample(fileName), {
    received_at: '2026-06-01T19:45:00Z',
  });
}
const checks = [
  {
    name: 'heartbeat',
    ingestion: ingest('home/esp32_home_01/heartbeat', 'heartbeat.json'),
    expectedModel: 'Device',
    expectedKind: 'update',
  },
  {
    name: 'telemetry',
    ingestion: ingest('home/esp32_home_01/telemetry', 'telemetry.json'),
    expectedModel: 'TelemetrySummary',
    expectedKind: 'document',
  },
  {
    name: 'event',
    ingestion: ingest('home/esp32_home_01/event', 'event_fire_detected.json'),
    expectedModel: 'Event',
    expectedKind: 'document',
  },
  {
    name: 'access',
    ingestion: ingest('home/esp32_home_01/access', 'access_granted.json'),
    expectedModel: 'AccessLog',
    expectedKind: 'document',
  },
  {
    name: 'override_result',
    ingestion: ingest('home/esp32_home_01/override/result', 'override_result.json'),
    expectedModel: 'OverrideRequest',
    expectedKind: 'update',
  },
];
for (const check of checks) {
  assert(check.ingestion.accepted, check.name + ' ingestion should be accepted');
  const persistence = mapAcceptedIngestionToPersistence(check.ingestion);
  assert(
    persistence.model === check.expectedModel,
    check.name + ' should map to ' + check.expectedModel
  );
  assert(
    persistence.kind === check.expectedKind,
    check.name + ' should map to kind ' + check.expectedKind
  );
  if (persistence.kind === 'document') {
    const validationError = persistence.document.validateSync();
    assert(!validationError, check.name + ' mapped document should be valid');
  }
  if (persistence.kind === 'update') {
    assert(Boolean(persistence.filter), check.name + ' update should include filter');
    assert(Boolean(persistence.update), check.name + ' update should include update');
  }
  console.log('[OK] ' + check.name + ' -> ' + persistence.model + ' / ' + persistence.kind);
}
const rejected = ingestMqttMessage(
  'home/esp32_other_01/heartbeat',
  readExample('heartbeat.json'),
  { received_at: '2026-06-01T19:45:00Z' }
);
let rejectedWasBlocked = false;
try {
  mapAcceptedIngestionToPersistence(rejected);
} catch (error) {
  rejectedWasBlocked = true;
}
assert(rejectedWasBlocked, 'rejected ingestion should not be mapped');
console.log('Ingestion persistence mapper tests passed.');
