const { routeMqttPayload } = require('../mqtt/mqttPayloadRouter');
const INGESTION_ACTIONS = {
  heartbeat: 'update_device_heartbeat',
  telemetry: 'record_telemetry_summary',
  event: 'record_event_and_evaluate_alert',
  access: 'record_access_log',
  override_result: 'record_override_result',
};
function buildRejectedResult(topic, routingResult) {
  return {
    accepted: false,
    source: 'mqtt',
    topic,
    stage: 'routing',
    reason: routingResult.reason,
    error: routingResult.error,
    payload_type: routingResult.payload_type,
    topic_key: routingResult.topic_key,
    topic_device_id: routingResult.topic_device_id,
    payload_device_id: routingResult.payload_device_id,
    errors: routingResult.errors,
  };
}
function buildAcceptedResult(topic, routingResult, receivedAt) {
  const action = INGESTION_ACTIONS[routingResult.payload_type];
  if (!action) {
    return {
      accepted: false,
      source: 'mqtt',
      topic,
      stage: 'ingestion',
      reason: 'missing_ingestion_action',
      payload_type: routingResult.payload_type,
      device_id: routingResult.device_id,
    };
  }
  return {
    accepted: true,
    source: 'mqtt',
    topic,
    payload_type: routingResult.payload_type,
    device_id: routingResult.device_id,
    action,
    received_at: receivedAt,
    data: routingResult.data,
  };
}
function ingestMqttMessage(topic, payload, options = {}) {
  const receivedAt = options.received_at || new Date().toISOString();
  const routingResult = routeMqttPayload(topic, payload);
  if (!routingResult.routed) {
    return buildRejectedResult(topic, routingResult);
  }
  return buildAcceptedResult(topic, routingResult, receivedAt);
}
module.exports = {
  INGESTION_ACTIONS,
  ingestMqttMessage,
};
