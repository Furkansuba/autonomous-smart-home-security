import { useState, useEffect } from 'react'
import { getEvents } from '../services/eventService.js'
import { formatDateTime } from '../utils/formatters.js'

const SEVERITY_FILTERS = ['all', 'info', 'warning', 'critical']

function SeverityBadge({ severity }) {
  return (
    <span className={`severity-badge severity-badge--${severity ?? 'info'}`}>
      {severity ?? '—'}
    </span>
  )
}

function EventsPage() {
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [severity, setSeverity] = useState('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = {}
    if (severity !== 'all') params.severity = severity
    getEvents(params)
      .then((data) => {
        if (!cancelled) {
          setEvents(Array.isArray(data) ? data : (data?.events ?? []))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load events.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [severity])

  return (
    <div className="events-page">
      <div className="events-toolbar">
        {SEVERITY_FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-btn${severity === f ? ' filter-btn--active' : ''}`}
            onClick={() => setSeverity(f)}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {loading && <p className="events-loading">Loading events…</p>}

      {!loading && error && (
        <p className="events-error">{error}</p>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="events-empty">No events found.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="events-table-wrap">
          <table className="events-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Device</th>
                <th>Room</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Confirmed</th>
                <th>Occurred At</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.event_id ?? e._id}>
                  <td className="events-col-id">{e.event_id ?? '—'}</td>
                  <td>{e.device_id ?? '—'}</td>
                  <td>{e.room_id ?? '—'}</td>
                  <td>{e.event_type ?? '—'}</td>
                  <td><SeverityBadge severity={e.severity} /></td>
                  <td className="events-col-msg" title={e.message ?? '—'}>{e.message ?? '—'}</td>
                  <td>{e.confirmed ? 'Yes' : 'No'}</td>
                  <td className="events-col-ts">{formatDateTime(e.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default EventsPage
