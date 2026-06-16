// In-memory event bus for Server-Sent Events (SSE).
//
// Single-process only (one EC2 PM2 instance). It carries SMALL, non-sensitive
// summaries of activity that has already been validated and persisted, so the
// admin-web can refresh affected views in real time instead of polling.
// Nothing here is durable: if the process restarts, clients simply reconnect.
const { EventEmitter } = require('events');

const CHANNEL = 'sse';
const bus = new EventEmitter();
// One listener per connected SSE client; allow many without the Node warning.
bus.setMaxListeners(0);

// Build a safe, minimal summary from an accepted ingestion result. Only whitelisted
// fields are included — never tokens, hashes, raw payloads, or reasons.
function buildStreamSummary(ingestion) {
  const d = ingestion.data || {};
  const base = { at: ingestion.received_at || new Date().toISOString() };
  switch (ingestion.payload_type) {
    case 'event':
      return { ...base, type: 'event', event_type: d.event_type, severity: d.severity, device_id: d.device_id, room_id: d.room_id || null };
    case 'telemetry':
      return { ...base, type: 'telemetry', device_id: d.device_id, room_id: d.room_id || null };
    case 'access':
      return { ...base, type: 'access', device_id: d.device_id, result: d.result };
    case 'override_result':
      return { ...base, type: 'override_result', device_id: d.device_id, action: d.action, result: d.result };
    case 'heartbeat':
      return { ...base, type: 'device_status', device_id: d.device_id, status: d.status };
    default:
      return null;
  }
}

function publishStreamEvent(message) {
  if (!message) return;
  bus.emit(CHANNEL, message);
}

// Register an SSE client listener. Returns an unsubscribe function.
function subscribeStream(listener) {
  bus.on(CHANNEL, listener);
  return () => bus.off(CHANNEL, listener);
}

function subscriberCount() {
  return bus.listenerCount(CHANNEL);
}

module.exports = {
  buildStreamSummary,
  publishStreamEvent,
  subscribeStream,
  subscriberCount,
};
