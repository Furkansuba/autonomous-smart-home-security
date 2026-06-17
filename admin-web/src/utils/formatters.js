export function formatDateTime(raw) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d)) return '—'
  return d.toLocaleString()
}

// UI-only friendly labels for raw backend `event_type` values. The raw event_type is
// still used everywhere for filtering, sorting, icons, CSV export, and API calls — only
// the visible text is mapped here. Unknown values pass through unchanged.
const EVENT_TYPE_LABELS = {
  reed_switch_opened: 'Window/Door Opened',
  vibration_detected: 'Impact / Vibration Detected',
  gas_detected: 'Gas Detected',
  co_detected: 'Carbon Monoxide Detected',
  fire_detected: 'Fire Detected',
  motion_detected: 'Motion Detected',
  intrusion_detected: 'Intrusion Detected',
}

export function formatEventTypeLabel(eventType) {
  if (eventType == null || eventType === '') return '—'
  return EVENT_TYPE_LABELS[eventType] ?? eventType
}
