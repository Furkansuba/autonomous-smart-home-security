const { publishMqttMessage } = require('./mqttClient.service');
function normalizeOverride(override) {
  if (override && typeof override.toObject === 'function') {
    return override.toObject();
  }
  return override;
}
function buildOverrideCommandTopic(deviceId) {
  return 'home/' + deviceId + '/command/override';
}
function buildOverrideCommandPayload(overrideInput) {
  const override = normalizeOverride(overrideInput);
  return {
    override_id: override.override_id,
    device_id: override.device_id,
    actuator_id: override.actuator_id,
    action: override.action,
    requested_by: override.requested_by,
    reason: override.reason || null,
    timestamp: new Date().toISOString(),
  };
}
async function publishOverrideCommand(overrideInput) {
  const override = normalizeOverride(overrideInput);
  if (!override || !override.device_id) {
    return {
      published: false,
      skipped: false,
      reason: 'invalid_override_request',
    };
  }
  const topic = buildOverrideCommandTopic(override.device_id);
  const payload = buildOverrideCommandPayload(override);
  const result = await publishMqttMessage(topic, payload, {
    qos: 0,
    retain: false,
  });
  return {
    ...result,
    command_topic: topic,
    command_payload: payload,
  };
}
module.exports = {
  buildOverrideCommandTopic,
  buildOverrideCommandPayload,
  publishOverrideCommand,
};
