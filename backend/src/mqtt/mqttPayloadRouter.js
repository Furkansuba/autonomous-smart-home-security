const {
  heartbeatSchema,
  telemetrySchema,
  eventSchema,
  accessSchema,
  overrideResultSchema,
  validatePayload,
} = require('../validators/payload.schemas');
const { parseDeviceToBackendTopic } = require('./mqtt.topics');
const schemasByPayloadType = {
  heartbeat: heartbeatSchema,
  telemetry: telemetrySchema,
  event: eventSchema,
  access: accessSchema,
  override_result: overrideResultSchema,
};
function routeMqttPayload(topic, payload) {
  const topicResult = parseDeviceToBackendTopic(topic);
  if (!topicResult.valid) {
    return {
      routed: false,
      reason: 'invalid_topic',
      error: topicResult.error,
      topic_key: topicResult.topic_key,
    };
  }
  const schema = schemasByPayloadType[topicResult.payload_type];
  if (!schema) {
    return {
      routed: false,
      reason: 'missing_schema',
      payload_type: topicResult.payload_type,
    };
  }
  const validation = validatePayload(schema, payload);
  if (!validation.valid) {
    return {
      routed: false,
      reason: 'invalid_payload',
      payload_type: topicResult.payload_type,
      errors: validation.errors,
    };
  }
  if (validation.data.device_id !== topicResult.device_id) {
    return {
      routed: false,
      reason: 'device_id_mismatch',
      topic_device_id: topicResult.device_id,
      payload_device_id: validation.data.device_id,
    };
  }
  return {
    routed: true,
    payload_type: topicResult.payload_type,
    device_id: topicResult.device_id,
    data: validation.data,
  };
}
module.exports = {
  routeMqttPayload,
};
