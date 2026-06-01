const { Event } = require('../models');
const { getDatabaseStatus } = require('../config/database');
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
}
function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(Math.floor(parsed), 100);
}
function buildEventFilter(query) {
  const filter = {};
  if (query.device_id) {
    filter.device_id = query.device_id;
  }
  if (query.room_id) {
    filter.room_id = query.room_id;
  }
  if (query.event_type) {
    filter.event_type = query.event_type;
  }
  if (query.severity) {
    filter.severity = query.severity;
  }
  if (query.confirmed === 'true') {
    filter.confirmed = true;
  }
  if (query.confirmed === 'false') {
    filter.confirmed = false;
  }
  return filter;
}
async function listEvents(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const filter = buildEventFilter(req.query);
  const limit = parseLimit(req.query.limit);
  try {
    const events = await Event.find(filter)
      .sort({ occurred_at: -1, received_at: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({
      count: events.length,
      events,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list events.',
      message: error.message,
    });
  }
}
async function getEventById(req, res) {
  if (!isDatabaseConnected()) {
    return sendDatabaseUnavailable(res);
  }
  const { eventId } = req.params;
  try {
    const event = await Event.findOne({ event_id: eventId }).lean();
    if (!event) {
      return res.status(404).json({
        error: 'Event not found.',
        event_id: eventId,
      });
    }
    return res.status(200).json({
      event,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get event.',
      message: error.message,
    });
  }
}
module.exports = {
  listEvents,
  getEventById,
};
