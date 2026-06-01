const { ingestMqttMessage } = require('../services/ingestion.service');
function ingestMockMqttMessage(req, res) {
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
  return res.status(200).json(result);
}
module.exports = {
  ingestMockMqttMessage,
};
