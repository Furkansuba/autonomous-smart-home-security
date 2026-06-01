const {
  heartbeatSchema,
  telemetrySchema,
  eventSchema,
  accessSchema,
  overrideRequestSchema,
  overrideResultSchema,
  validatePayload,
} = require('../validators/payload.schemas');
const schemasByType = {
  heartbeat: heartbeatSchema,
  telemetry: telemetrySchema,
  event: eventSchema,
  access: accessSchema,
  override_request: overrideRequestSchema,
  override_result: overrideResultSchema,
};
function getContractTypes(req, res) {
  res.status(200).json({
    supported_types: Object.keys(schemasByType),
  });
}
function validateContractPayload(req, res) {
  const { type, payload } = req.body;
  if (!type) {
    return res.status(400).json({
      valid: false,
      error: 'Missing payload type.',
    });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({
      valid: false,
      error: 'Missing or invalid payload object.',
    });
  }
  const schema = schemasByType[type];
  if (!schema) {
    return res.status(400).json({
      valid: false,
      error: 'Unsupported payload type.',
      supported_types: Object.keys(schemasByType),
    });
  }
  const result = validatePayload(schema, payload);
  if (!result.valid) {
    return res.status(422).json({
      valid: false,
      type,
      errors: result.errors,
    });
  }
  return res.status(200).json({
    valid: true,
    type,
    data: result.data,
  });
}
module.exports = {
  getContractTypes,
  validateContractPayload,
};
