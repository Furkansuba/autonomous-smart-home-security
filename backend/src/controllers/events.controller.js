const { Event } = require('../models');
const { getDatabaseStatus } = require('../config/database');
const {
  getPagination,
  buildPaginatedResponse,
} = require('../utils/pagination');
function isDatabaseConnected() {
  return getDatabaseStatus().readyState === 1;
}
function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    error: 'Database is not connected.',
    database: getDatabaseStatus(),
  });
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
  const pagination = getPagination(req.query);
  try {
    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ occurred_at: -1, received_at: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Event.countDocuments(filter),
    ]);
    return res.status(200).json(
      buildPaginatedResponse('events', events, {
        total,
        page: pagination.page,
        limit: pagination.limit,
      })
    );
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
