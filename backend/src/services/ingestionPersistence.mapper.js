const {
  Device,
  Event,
  AccessLog,
  OverrideRequest,
  TelemetrySummary,
} = require('../models');
function toDate(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date for field: ' + fieldName);
  }
  return date;
}
function validateDocument(name, document) {
  const error = document.validateSync();
  if (error) {
    throw new Error(name + ' validation failed: ' + error.message);
  }
  return document;
}
function ensureAcceptedIngestion(ingestionResult) {
  if (!ingestionResult || ingestionResult.accepted !== true) {
    throw new Error('Cannot map rejected or empty ingestion result.');
  }
}
function mapHeartbeatToDeviceUpdate(ingestionResult) {
  const data = ingestionResult.data;
  const receivedAt = toDate(ingestionResult.received_at, 'received_at');
  return {
    kind: 'update',
    model: 'Device',
    filter: {
      device_id: data.device_id,
    },
    update: {
      $set: {
        status: data.status,
        firmware_version: data.firmware_version,
        last_seen_at: receivedAt,
        last_heartbeat_at: toDate(data.timestamp, 'timestamp'),
        wifi_rssi: data.wifi_rssi,
      },
      $setOnInsert: {
        device_id: data.device_id,
        name: data.device_id,
        location_label: 'Prototype Home',
        is_active: true,
      },
    },
    options: {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    },
  };
}
function mapTelemetryToDocument(ingestionResult) {
  const data = ingestionResult.data;
  const document = new TelemetrySummary({
    device_id: data.device_id,
    room_id: data.room_id,
    temperature_c: data.temperature_c,
    humidity_percent: data.humidity_percent,
    gas_raw: data.gas_raw,
    co_raw: data.co_raw,
    flame_detected: data.flame_detected,
    motion_detected: data.motion_detected,
    reed_open: data.reed_open,
    occurred_at: toDate(data.timestamp, 'timestamp'),
    received_at: toDate(ingestionResult.received_at, 'received_at'),
  });
  return {
    kind: 'document',
    model: 'TelemetrySummary',
    document: validateDocument('TelemetrySummary', document),
  };
}
function mapEventToDocument(ingestionResult) {
  const data = ingestionResult.data;
  const document = new Event({
    event_id: data.event_id,
    device_id: data.device_id,
    room_id: data.room_id,
    event_type: data.event_type,
    severity: data.severity,
    message: data.message,
    sensor_id: data.sensor_id,
    raw_value: data.raw_value,
    confirmed: data.confirmed,
    occurred_at: toDate(data.timestamp, 'timestamp'),
    received_at: toDate(ingestionResult.received_at, 'received_at'),
  });
  return {
    kind: 'document',
    model: 'Event',
    document: validateDocument('Event', document),
  };
}
function mapAccessToDocument(ingestionResult) {
  const data = ingestionResult.data;
  const document = new AccessLog({
    access_id: data.access_id,
    device_id: data.device_id,
    gate_id: data.gate_id,
    user_id: data.user_id,
    access_method: data.access_method,
    result: data.result,
    card_uid_hash: data.card_uid_hash,
    occurred_at: toDate(data.timestamp, 'timestamp'),
    received_at: toDate(ingestionResult.received_at, 'received_at'),
  });
  return {
    kind: 'document',
    model: 'AccessLog',
    document: validateDocument('AccessLog', document),
  };
}
function mapOverrideResultToUpdate(ingestionResult) {
  const data = ingestionResult.data;
  return {
    kind: 'update',
    model: 'OverrideRequest',
    filter: {
      override_id: data.override_id,
    },
    update: {
      $set: {
        device_id: data.device_id,
        actuator_id: data.actuator_id,
        action: data.action,
        status: data.result,
        result: data.result,
        blocked_reason: data.blocked_reason || null,
        result_at: toDate(data.timestamp, 'timestamp'),
      },
    },
    options: {
      returnDocument: 'after',
    },
  };
}
function mapAcceptedIngestionToPersistence(ingestionResult) {
  ensureAcceptedIngestion(ingestionResult);
  switch (ingestionResult.payload_type) {
    case 'heartbeat':
      return mapHeartbeatToDeviceUpdate(ingestionResult);
    case 'telemetry':
      return mapTelemetryToDocument(ingestionResult);
    case 'event':
      return mapEventToDocument(ingestionResult);
    case 'access':
      return mapAccessToDocument(ingestionResult);
    case 'override_result':
      return mapOverrideResultToUpdate(ingestionResult);
    default:
      throw new Error('Unsupported ingestion payload type: ' + ingestionResult.payload_type);
  }
}
module.exports = {
  mapAcceptedIngestionToPersistence,
};
