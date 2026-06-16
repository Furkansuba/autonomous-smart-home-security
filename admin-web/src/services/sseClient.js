import { API_BASE_URL } from '../config/api.js'

// Event types the backend emits on the SSE stream.
export const STREAM_EVENT_TYPES = [
  'event',
  'telemetry',
  'access',
  'override_result',
  'device_status',
]

// Open an SSE connection to the backend stream. The JWT is passed as a query
// param because the browser EventSource API cannot set an Authorization header.
// Returns the EventSource (call .close() to disconnect) or null if not logged in.
// EventSource auto-reconnects on transient errors; the backend sends a `retry` hint.
export function openEventStream({ onEvent, onOpen, onError } = {}) {
  const token = localStorage.getItem('auth_token')
  if (!token) return null

  const url = `${API_BASE_URL}/api/stream?token=${encodeURIComponent(token)}`
  const es = new EventSource(url)

  es.onopen = () => { onOpen && onOpen() }
  es.onerror = (e) => { onError && onError(e) }

  STREAM_EVENT_TYPES.forEach((type) => {
    es.addEventListener(type, (ev) => {
      let data = null
      try { data = JSON.parse(ev.data) } catch { data = null }
      onEvent && onEvent(type, data)
    })
  })

  return es
}
