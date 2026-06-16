// Event bus / SSE summary tests (no DB, no network).
// Verifies pub/sub delivery, unsubscribe, and that summaries are safe (whitelisted
// fields only — no hashes, tokens, or raw payloads).
const {
  buildStreamSummary,
  publishStreamEvent,
  subscribeStream,
  subscriberCount,
} = require('../src/services/eventBus.service');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  // 1. subscribe receives a published message
  const received = [];
  const unsub = subscribeStream((m) => received.push(m));
  assert(subscriberCount() === 1, 'one subscriber expected');
  publishStreamEvent({ type: 'event', event_type: 'fire_detected' });
  assert(received.length === 1 && received[0].event_type === 'fire_detected', 'message should be delivered');
  console.log('[OK] subscribe receives published message');

  // 2. unsubscribe stops delivery and decrements count
  unsub();
  assert(subscriberCount() === 0, 'subscriber should be removed after unsubscribe');
  publishStreamEvent({ type: 'event', event_type: 'gas_detected' });
  assert(received.length === 1, 'no delivery after unsubscribe');
  console.log('[OK] unsubscribe stops delivery');

  // 3. null summary is not emitted (no listener error)
  publishStreamEvent(null);
  console.log('[OK] null publish is a no-op');

  // 4. buildStreamSummary maps each payload type with safe fields only
  const ev = buildStreamSummary({ payload_type: 'event', received_at: 't', data: { event_type: 'fire_detected', severity: 'critical', device_id: 'esp32_home_01', room_id: 'kitchen' } });
  assert(ev.type === 'event' && ev.severity === 'critical' && ev.device_id === 'esp32_home_01', 'event summary fields');

  const acc = buildStreamSummary({ payload_type: 'access', received_at: 't', data: { device_id: 'esp32_home_01', result: 'granted', card_uid_hash: 'sha256:SECRET', user_id: 'u1' } });
  assert(acc.type === 'access' && acc.result === 'granted', 'access summary fields');
  assert(!('card_uid_hash' in acc) && !('user_id' in acc), 'access summary must NOT leak card_uid_hash or user_id');
  console.log('[OK] access summary excludes card_uid_hash / user_id');

  const hb = buildStreamSummary({ payload_type: 'heartbeat', received_at: 't', data: { device_id: 'esp32_home_01', status: 'online', wifi_rssi: -55 } });
  assert(hb.type === 'device_status' && hb.status === 'online', 'heartbeat → device_status');
  assert(!('wifi_rssi' in hb), 'device_status summary stays minimal');

  const ovr = buildStreamSummary({ payload_type: 'override_result', received_at: 't', data: { device_id: 'esp32_home_01', action: 'arm', result: 'executed', blocked_reason: null } });
  assert(ovr.type === 'override_result' && ovr.action === 'arm' && ovr.result === 'executed', 'override_result summary');

  const tel = buildStreamSummary({ payload_type: 'telemetry', received_at: 't', data: { device_id: 'esp32_home_01', room_id: 'kitchen', gas_raw: 1234 } });
  assert(tel.type === 'telemetry' && tel.device_id === 'esp32_home_01', 'telemetry summary');

  const unknown = buildStreamSummary({ payload_type: 'something_else', data: {} });
  assert(unknown === null, 'unknown payload type → null (not streamed)');
  console.log('[OK] buildStreamSummary maps known types and ignores unknown');

  console.log('Event bus tests passed.');
}

try {
  main();
} catch (error) {
  console.error('[FAIL] event bus test failed');
  console.error(error);
  process.exit(1);
}
