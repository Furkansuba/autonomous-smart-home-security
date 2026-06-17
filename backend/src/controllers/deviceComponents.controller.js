const { Device, TelemetrySummary, Event, AccessLog, OverrideRequest } = require('../models');
const { getDatabaseStatus } = require('../config/database');

// Attached-component visibility for a single physical controller (e.g. esp32_home_01).
//
// These rows are DERIVED, read-only, from existing telemetry/events/access/override
// records. They are NOT documents in the devices collection — listing components here
// never affects total/active/online/offline device counts, and never creates fake
// controller devices.

function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
}

// A reading/event is "fresh" (observed/alert) if within this window; older → no_recent_data.
const FRESH_MS = 10 * 60 * 1000;

async function getDeviceComponents(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const { deviceId } = req.params;
  try {
    const device = await Device.findOne({ device_id: deviceId })
      .select('device_id name status door_locked security_armed last_heartbeat_at')
      .lean();
    if (!device) {
      return res.status(404).json({ error: 'Device not found.', device_id: deviceId });
    }

    const now = Date.now();
    const freshCutoff = new Date(now - FRESH_MS);

    const [telemetry, events, latestAccess, overrides] = await Promise.all([
      TelemetrySummary.find({ device_id: deviceId }).sort({ occurred_at: -1 }).limit(60).lean(),
      Event.find({ device_id: deviceId }).sort({ occurred_at: -1 }).limit(120).lean(),
      AccessLog.find({ device_id: deviceId }).sort({ occurred_at: -1 }).limit(1).lean(),
      OverrideRequest.find({ device_id: deviceId }).sort({ requested_at: -1 }).limit(80).lean(),
    ]);

    // --- derivation helpers -------------------------------------------------
    const isFresh = (d) => d && new Date(d) >= freshCutoff;

    // Latest telemetry doc whose given field is present (non-null/undefined).
    function latestTelemetryWith(field) {
      for (const t of telemetry) {
        if (t[field] !== null && t[field] !== undefined) return t;
      }
      return null;
    }
    // Latest event whose type is in the set.
    function latestEventOf(types) {
      const set = new Set(types);
      for (const e of events) {
        if (set.has(e.event_type)) return e;
      }
      return null;
    }
    // Latest override whose action is in the set.
    function latestOverrideOf(actions) {
      const set = new Set(actions);
      for (const o of overrides) {
        if (set.has(o.action)) return o;
      }
      return null;
    }

    // Sensor with a telemetry field + optional alerting event types.
    function sensorRow(component_id, label, field, formatValue, alertTypes, notes) {
      const t = latestTelemetryWith(field);
      const alertEvent = alertTypes ? latestEventOf(alertTypes) : null;
      const lastSeen = t ? t.occurred_at : (alertEvent ? alertEvent.occurred_at : null);
      let status;
      if (alertEvent && isFresh(alertEvent.occurred_at)) status = 'alert';
      else if (t && isFresh(t.occurred_at)) status = 'observed';
      else if (t || alertEvent) status = 'no_recent_data';
      else status = 'unknown';
      return {
        component_id,
        label,
        category: 'sensor',
        status,
        last_seen_at: lastSeen || null,
        latest_value: t ? formatValue(t) : null,
        notes: notes || null,
      };
    }

    // Event-only sensor (no telemetry field), e.g. impact/vibration.
    function eventSensorRow(component_id, label, alertTypes, notes) {
      const e = latestEventOf(alertTypes);
      let status;
      if (e && isFresh(e.occurred_at)) status = 'alert';
      else if (e) status = 'no_recent_data';
      else status = 'unknown';
      return {
        component_id,
        label,
        category: 'sensor',
        status,
        last_seen_at: e ? e.occurred_at : null,
        latest_value: e ? e.event_type : null,
        notes: notes || null,
      };
    }

    // Actuator (commandable) summarized from its last override command.
    function actuatorRow(component_id, label, actions, notes, fallbackValue) {
      const o = latestOverrideOf(actions);
      return {
        component_id,
        label,
        category: 'actuator',
        status: 'commandable',
        last_seen_at: o ? (o.result_at || o.requested_at || null) : null,
        latest_value: o ? `${o.action} (${o.status})` : (fallbackValue || null),
        notes: notes || null,
      };
    }

    const fmt = (v) => (v === null || v === undefined ? '—' : v);
    const climate = (t) => {
      const parts = [];
      if (t.temperature_c !== null && t.temperature_c !== undefined) parts.push(`${t.temperature_c}°C`);
      if (t.humidity_percent !== null && t.humidity_percent !== undefined) parts.push(`${t.humidity_percent}%`);
      return parts.length ? parts.join(' / ') : '—';
    };
    const boolVal = (label) => (t, field) => (t[field] ? `${label} detected` : `${label} clear`);

    // --- component catalog (attached to this single controller) -------------
    const components = [
      sensorRow('dht_sensor_01', 'DHT11 Climate Sensor', 'temperature_c', climate, null,
        'Temperature/humidity. Climate room only.'),
      sensorRow('mq2_sensor_01', 'MQ-2 Gas Sensor', 'gas_raw', (t) => `gas_raw ${fmt(t.gas_raw)}`,
        ['gas_detected'], 'Kitchen. Alert on gas_detected.'),
      sensorRow('mq7_sensor_01', 'MQ-7 CO Sensor', 'co_raw', (t) => `co_raw ${fmt(t.co_raw)}`,
        ['co_detected'], 'Garage. Alert on co_detected.'),
      sensorRow('flame_sensor_01', 'Flame Sensor Array', 'flame_detected', (t) => boolVal('Flame')(t, 'flame_detected'),
        ['fire_detected'], 'Multi-room flame zones via PCF8574.'),
      sensorRow('pir_sensor_01', 'PIR Motion Sensors', 'motion_detected', (t) => boolVal('Motion')(t, 'motion_detected'),
        ['motion_detected', 'intrusion_detected'], 'Hallway / garage / living room.'),
      sensorRow('reed_sensor_01', 'Reed / Window Sensors', 'reed_open', (t) => (t.reed_open ? 'Open' : 'Closed'),
        ['reed_switch_opened'], 'Window/door reed switches via PCF8574.'),
      eventSensorRow('impact_sensor_01', 'Impact / Vibration Sensors', ['vibration_detected'],
        'Event-only (no telemetry field). Alert on vibration_detected.'),
      {
        component_id: 'rfid_reader_01',
        label: 'RC522 RFID Reader',
        category: 'access',
        status: latestAccess[0]
          ? (isFresh(latestAccess[0].occurred_at) ? 'observed' : 'no_recent_data')
          : 'unknown',
        last_seen_at: latestAccess[0] ? latestAccess[0].occurred_at : null,
        latest_value: latestAccess[0] ? `${latestAccess[0].result} (${latestAccess[0].access_method})` : null,
        notes: 'Main door access. Derived from access logs.',
      },
      actuatorRow('buzzer_01', 'Alarm Buzzer', ['buzzer_on', 'buzzer_off'], 'Hallway siren.'),
      actuatorRow('pump_relay_01', 'Zone Pumps (4-channel relay)', ['pump_on', 'pump_off'],
        'pump_rm1_01 / pump_rm2_01 / pump_kit_01 / pump_liv_01.'),
      {
        component_id: 'door_controller_01',
        label: 'Door Servo Lock',
        category: 'actuator',
        status: 'commandable',
        last_seen_at: device.last_heartbeat_at || null,
        latest_value: device.door_locked === true ? 'Locked (device-reported)'
          : device.door_locked === false ? 'Unlocked (device-reported)'
          : 'Unknown',
        notes: 'Device-reported / last-commanded lock state — not sensor-verified.',
      },
      {
        component_id: 'pcf8574_01',
        label: 'PCF8574 I2C Expander',
        category: 'bus',
        // The expander is healthy if flame/reed telemetry is flowing through it.
        status: (latestTelemetryWith('flame_detected') && isFresh(latestTelemetryWith('flame_detected').occurred_at)) ||
                (latestTelemetryWith('reed_open') && isFresh(latestTelemetryWith('reed_open').occurred_at))
          ? 'observed' : 'unknown',
        last_seen_at: (latestTelemetryWith('flame_detected') || {}).occurred_at || null,
        latest_value: null,
        notes: 'I2C digital bus behind flame and reed sensors.',
      },
    ];

    return res.status(200).json({
      device_id: device.device_id,
      controller: {
        name: device.name,
        status: device.status,
        last_heartbeat_at: device.last_heartbeat_at || null,
        security_armed: typeof device.security_armed === 'boolean' ? device.security_armed : null,
        door_locked: typeof device.door_locked === 'boolean' ? device.door_locked : null,
      },
      generated_at: new Date().toISOString(),
      fresh_window_seconds: Math.round(FRESH_MS / 1000),
      count: components.length,
      components,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to derive device components.', message: error.message });
  }
}

module.exports = { getDeviceComponents };
