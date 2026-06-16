const { ingestMqttMessage } = require('../services/ingestion.service');
const { persistAcceptedIngestion } = require('../services/persistence.service');
const { sendEventNotification } = require('../services/notification.service');
const { publishStreamEvent, buildStreamSummary } = require('../services/eventBus.service');
const { Device } = require('../models');

// Reflect a confirmed ARM/DISARM acknowledgement onto the device's security mode.
// Only an `executed` result flips Device.security_armed; failed/blocked/requested
// ACKs leave the stored mode untouched. Never touches safety state.
async function applyArmStateFromOverrideResult(data) {
  if (!data || (data.action !== 'arm' && data.action !== 'disarm')) {
    return { applied: false, reason: 'not_arm_disarm' };
  }
  if (data.result !== 'executed') {
    return { applied: false, reason: 'not_executed' };
  }
  const armed = data.action === 'arm';
  try {
    const updated = await Device.findOneAndUpdate(
      { device_id: data.device_id },
      { $set: { security_armed: armed } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      return { applied: false, reason: 'device_not_found' };
    }
    return { applied: true, security_armed: armed };
  } catch (error) {
    return { applied: false, reason: 'update_error', error: error.message };
  }
}

// Reflect a confirmed door_lock/door_unlock acknowledgement onto the device's
// device-reported lock state. Only an `executed` result changes Device.door_locked;
// failed/blocked/requested ACKs leave it untouched. This is last-commanded state,
// not independently sensor-verified.
async function applyDoorStateFromOverrideResult(data) {
  if (!data || (data.action !== 'door_lock' && data.action !== 'door_unlock')) {
    return { applied: false, reason: 'not_door_action' };
  }
  if (data.result !== 'executed') {
    return { applied: false, reason: 'not_executed' };
  }
  const locked = data.action === 'door_lock';
  try {
    const updated = await Device.findOneAndUpdate(
      { device_id: data.device_id },
      { $set: { door_locked: locked } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      return { applied: false, reason: 'device_not_found' };
    }
    return { applied: true, door_locked: locked };
  } catch (error) {
    return { applied: false, reason: 'update_error', error: error.message };
  }
}
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
  if (ingestion.payload_type === 'event' && persistence.saved) {
    sendEventNotification(ingestion.data).catch((notifError) => {
      console.error('[MQTT] notification dispatch failed: ' + notifError.message);
    });
  }
  // Broadcast a safe real-time summary to connected SSE clients (admin-web Live view).
  if (persistence.saved) {
    publishStreamEvent(buildStreamSummary(ingestion));
  }
  let armState;
  let doorState;
  if (ingestion.payload_type === 'override_result' && persistence.saved) {
    armState = await applyArmStateFromOverrideResult(ingestion.data);
    doorState = await applyDoorStateFromOverrideResult(ingestion.data);
  }
  return {
    handled: true,
    accepted: true,
    source: 'mqtt',
    topic,
    payload_type: ingestion.payload_type,
    device_id: ingestion.device_id,
    ingestion,
    persistence,
    ...(armState ? { arm_state: armState } : {}),
    ...(doorState ? { door_state: doorState } : {}),
  };
}
module.exports = {
  parseMqttMessagePayload,
  handleMqttMessage,
  applyArmStateFromOverrideResult,
  applyDoorStateFromOverrideResult,
};
