// Central friendly labels for raw `event_type` values, used ONLY for human-readable
// notification titles/bodies. The raw event_type is never altered in the database, the
// API, MQTT payloads, or the FCM `data` payload — this mapping is presentation-only and
// mirrors the admin-web / Android UI label maps so all surfaces stay consistent.
const EVENT_TYPE_LABELS = {
  reed_switch_opened: 'Window/Door Opened',
  vibration_detected: 'Impact / Vibration Detected',
  gas_detected: 'Gas Detected',
  co_detected: 'Carbon Monoxide Detected',
  fire_detected: 'Fire Detected',
  motion_detected: 'Motion Detected',
  intrusion_detected: 'Intrusion Detected',
};

// Returns a friendly label for a raw event_type. Unknown types fall back to a humanized
// form (e.g. "alarm_triggered" -> "Alarm triggered") so a title is never blank.
function formatEventTypeLabel(eventType) {
  if (!eventType) return 'Alert';
  return (
    EVENT_TYPE_LABELS[eventType] ||
    String(eventType).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

module.exports = { EVENT_TYPE_LABELS, formatEventTypeLabel };
