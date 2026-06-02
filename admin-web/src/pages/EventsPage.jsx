import { useState, useEffect } from 'react'
import { getEvents } from '../services/eventService.js'
import { formatDateTime } from '../utils/formatters.js'
import Badge from '../components/ui/Badge.jsx'
import FilterBar from '../components/ui/FilterBar.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'

const SEVERITY_FILTERS = ['all', 'info', 'warning', 'critical']

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
        <FilterBar options={SEVERITY_FILTERS} activeValue={severity} onChange={setSeverity} />
      </div>

      {loading && <StateMessage className="events-loading">Loading events…</StateMessage>}

      {!loading && error && (
        <StateMessage className="events-error">{error}</StateMessage>
      )}

      {!loading && !error && events.length === 0 && (
        <StateMessage className="events-empty">No events found.</StateMessage>
      )}

      {!loading && !error && events.length > 0 && (
        <DataTable
          wrapClassName="events-table-wrap"
          tableClassName="events-table"
          columns={['Event ID', 'Device', 'Room', 'Type', 'Severity', 'Message', 'Confirmed', 'Occurred At']}
        >
          {events.map((e) => (
            <tr key={e.event_id ?? e._id}>
              <td className="events-col-id">{e.event_id ?? '—'}</td>
              <td>{e.device_id ?? '—'}</td>
              <td>{e.room_id ?? '—'}</td>
              <td>{e.event_type ?? '—'}</td>
              <td><Badge baseClass="severity-badge" variant={e.severity ?? 'info'}>{e.severity ?? '—'}</Badge></td>
              <td className="events-col-msg" title={e.message ?? '—'}>{e.message ?? '—'}</td>
              <td>{e.confirmed ? 'Yes' : 'No'}</td>
              <td className="events-col-ts">{formatDateTime(e.occurred_at)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  )
}

export default EventsPage
