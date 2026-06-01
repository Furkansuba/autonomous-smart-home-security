const { ingestMqttMessage } = require('../services/ingestion.service');
const { persistAcceptedIngestion } = require('../services/persistence.service');
function parseMqttMessagePayload(messageBuffer) {
  try {
    const raw =
      Buffer.isBuffer(messageBuffer)
        ? messageBuffer.toString('utf8')
        : String(messageBuffer);
    return {
      parsed: true,
      raw,
      payload: JSON.parse(raw),
    };
  } catch (error) {
    return {
      parsed: false,
      error: error.message,
    };
  }
}
async function handleMqttMessage(topic, messageBuffer, options = {}) {
  const parsedMessage = parseMqttMessagePayload(messageBuffer);
  if (!parsedMessage.parsed) {
    return {
      handled: false,
      accepted: false,
      source: 'mqtt',
      topic,
      stage: 'parse',
      reason: 'invalid_json',
      error: parsedMessage.error,
    };
  }
  const ingestion = ingestMqttMessage(topic, parsedMessage.payload, {
    received_at: options.received_at || new Date().toISOString(),
  });
  if (!ingestion.accepted) {
    return {
      handled: false,
      accepted: false,
      source: 'mqtt',
      topic,
      stage: 'ingestion',
      reason: ingestion.reason,
      ingestion,
    };
  }
  if (options.persist === false) {
    return {
      handled: true,
      accepted: true,
      source: 'mqtt',
      topic,
      payload_type: ingestion.payload_type,
      device_id: ingestion.device_id,
      ingestion,
      persistence: {
        saved: false,
        skipped: true,
        reason: 'persistence_disabled',
      },
    };
  }
  const persistence = await persistAcceptedIngestion(ingestion);
  return {
    handled: true,
    accepted: true,
    source: 'mqtt',
    topic,
    payload_type: ingestion.payload_type,
    device_id: ingestion.device_id,
    ingestion,
    persistence,
  };
}
module.exports = {
  parseMqttMessagePayload,
  handleMqttMessage,
};
