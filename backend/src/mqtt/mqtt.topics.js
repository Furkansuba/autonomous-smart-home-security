const DEVICE_TO_BACKEND_TOPIC_TYPES = {
  heartbeat: 'heartbeat',
  telemetry: 'telemetry',
  event: 'event',
  access: 'access',
  'override/result': 'override_result',
};
const BACKEND_TO_DEVICE_COMMAND_TYPES = {
  override: 'override',
  arm: 'arm',
  disarm: 'disarm',
  reset: 'reset',
  unlock: 'unlock',
};
function buildDeviceToBackendTopic(deviceId, topicKey) {
  return 'home/' + deviceId + '/' + topicKey;
}
function buildBackendCommandTopic(deviceId, commandKey) {
  return 'home/' + deviceId + '/cmd/' + commandKey;
}
function parseDeviceToBackendTopic(topic) {
  if (!topic || typeof topic !== 'string') {
    return {
      valid: false,
      error: 'Topic must be a non-empty string.',
    };
  }
  const parts = topic.split('/');
  if (parts.length < 3) {
    return {
      valid: false,
      error: 'Topic has too few segments.',
    };
  }
  if (parts[0] !== 'home') {
    return {
      valid: false,
      error: 'Topic must start with home.',
    };
  }
  const deviceId = parts[1];
  const topicKey = parts.slice(2).join('/');
  if (topicKey.startsWith('cmd/')) {
    return {
      valid: false,
      error: 'Command topics are backend-to-device topics, not device-to-backend topics.',
    };
  }
  const payloadType = DEVICE_TO_BACKEND_TOPIC_TYPES[topicKey];
  if (!payloadType) {
    return {
      valid: false,
      error: 'Unsupported device-to-backend topic.',
      topic_key: topicKey,
    };
  }
  return {
    valid: true,
    device_id: deviceId,
    topic_key: topicKey,
    payload_type: payloadType,
  };
}
module.exports = {
  DEVICE_TO_BACKEND_TOPIC_TYPES,
  BACKEND_TO_DEVICE_COMMAND_TYPES,
  buildDeviceToBackendTopic,
  buildBackendCommandTopic,
  parseDeviceToBackendTopic,
};
