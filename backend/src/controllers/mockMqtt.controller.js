const { ingestMqttMessage } = require('../services/ingestion.service');
const { persistAcceptedIngestion } = require('../services/persistence.service');
const { sendEventNotification } = require('../services/notification.service');
async function ingestMockMqttMessage(req, res) {
  const { topic, payload } = req.body;
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({
      accepted: false,
      error: 'Missing or invalid topic.',
    });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({
      accepted: false,
      error: 'Missing or invalid payload object.',
    });
  }
  const result = ingestMqttMessage(topic, payload, {
    received_at: new Date().toISOString(),
  });
  if (!result.accepted) {
    return res.status(422).json(result);
  }
  const persistence = await persistAcceptedIngestion(result);
  if (result.payload_type === 'event' && persistence.saved) {
    sendEventNotification(result.data).catch((notifError) => {
      console.error('[MOCK] notification dispatch failed: ' + notifError.message);
    });
  }
  return res.status(200).json({
    ...result,
    persistence,
  });
}
module.exports = {
  ingestMockMqttMessage,
};
