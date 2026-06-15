const { TelemetrySummary, Event, OverrideRequest } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const {
  getPagination,
  buildPaginatedResponse,
} = require('../utils/pagination');
// Short TTL (seconds) for which a published hazard event is surfaced as a
// "recent active hazard" on the Sensors/Telemetry UI, independent of the
// periodic telemetry snapshot. This never mutates telemetry raw values and
// never deletes Event documents — it is a read-only derived view.
const HAZARD_TTL_SECONDS = {
  fire_detected: 120,
  gas_detected: 120,
  co_detected: 120,
  intrusion_detected: 90,
  vibration_detected: 90,
  reed_switch_opened: 90,
  motion_detected: 90,
};
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
}
function buildTelemetryFilter(query) {
  const filter = {};
  if (query.device_id) {
    filter.device_id = query.device_id;
  }
  if (query.room_id) {
    filter.room_id = query.room_id;
  }
  return filter;
}
async function listTelemetry(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = buildTelemetryFilter(req.query);
  const pagination = getPagination(req.query);
  try {
    const [telemetry, total] = await Promise.all([
      TelemetrySummary.find(filter)
        .sort({ occurred_at: -1, received_at: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      TelemetrySummary.countDocuments(filter),
    ]);
    return res.status(200).json(
      buildPaginatedResponse('telemetry', telemetry, {
        total,
        page: pagination.page,
        limit: pagination.limit,
      })
    );
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list telemetry.',
      message: error.message,
    });
  }
}
async function getLatestTelemetry(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = buildTelemetryFilter(req.query);
  try {
    const latest = await TelemetrySummary.findOne(filter)
      .sort({ occurred_at: -1, received_at: -1 })
      .lean();
    if (!latest) {
      return res.status(404).json({
        error: 'Telemetry not found.',
        filter,
      });
    }
    return res.status(200).json({
      telemetry: latest,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get latest telemetry.',
      message: error.message,
    });
  }
}
// Derives recent active hazards from Event records (read-only). For each
// (device_id, room_id, event_type) the latest event within that type's TTL is
// surfaced. Fire is additionally suppressed once a newer executed
// maintenance_reset exists for the device (Confirm Threat Cleared), and
// re-appears if a newer fire_detected arrives afterwards.
async function computeActiveHazards({ device_id, room_id } = {}) {
  const now = Date.now();
  const hazardTypes = Object.keys(HAZARD_TTL_SECONDS);
  const maxTtlMs = Math.max(...Object.values(HAZARD_TTL_SECONDS)) * 1000;
  const cutoff = new Date(now - maxTtlMs);

  const eventFilter = {
    event_type: { $in: hazardTypes },
    occurred_at: { $gte: cutoff },
  };
  if (device_id) eventFilter.device_id = device_id;
  if (room_id) eventFilter.room_id = room_id;

  const events = await Event.find(eventFilter)
    .sort({ occurred_at: -1 })
    .lean();

  // Latest executed maintenance_reset per device (clears prior fire).
  const resetFilter = { action: 'maintenance_reset', status: 'executed' };
  if (device_id) resetFilter.device_id = device_id;
  const resets = await OverrideRequest.find(resetFilter)
    .sort({ result_at: -1, requested_at: -1 })
    .lean();
  const latestResetMsByDevice = {};
  for (const r of resets) {
    if (!(r.device_id in latestResetMsByDevice)) {
      latestResetMsByDevice[r.device_id] = new Date(r.result_at || r.requested_at).getTime();
    }
  }

  const seen = new Set();
  const hazards = [];
  for (const ev of events) {
    const key = ev.device_id + '|' + ev.room_id + '|' + ev.event_type;
    if (seen.has(key)) continue; // events are newest-first; keep only the latest
    seen.add(key);

    const ttlSeconds = HAZARD_TTL_SECONDS[ev.event_type];
    const occurredMs = new Date(ev.occurred_at).getTime();
    if (now - occurredMs > ttlSeconds * 1000) continue; // older than this type's TTL

    if (ev.event_type === 'fire_detected') {
      const resetMs = latestResetMsByDevice[ev.device_id];
      if (resetMs != null && resetMs >= occurredMs) continue; // cleared by maintenance_reset
    }

    hazards.push({
      device_id: ev.device_id,
      room_id: ev.room_id,
      event_type: ev.event_type,
      severity: ev.severity,
      message: ev.message,
      event_id: ev.event_id,
      occurred_at: ev.occurred_at,
      ttl_seconds: ttlSeconds,
      expires_at: new Date(occurredMs + ttlSeconds * 1000).toISOString(),
      source: 'event_latch',
    });
  }
  return hazards;
}

async function getActiveHazards(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  try {
    const hazards = await computeActiveHazards({
      device_id: req.query.device_id,
      room_id: req.query.room_id,
    });
    return res.status(200).json({
      hazards,
      count: hazards.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to compute active hazards.',
      message: error.message,
    });
  }
}

module.exports = {
  listTelemetry,
  getLatestTelemetry,
  computeActiveHazards,
  getActiveHazards,
};
