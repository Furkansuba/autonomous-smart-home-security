import { useState, useEffect } from 'react'
import { getEvents } from '../services/eventService.js'
import { formatDateTime } from '../utils/formatters.js'
import Badge from '../components/ui/Badge.jsx'
import FilterBar from '../components/ui/FilterBar.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'

const SEVERITY_FILTERS = ['all', 'info', 'warning', 'critical']
const SEV_RANK = { critical: 0, warning: 1, info: 2 }

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

  const total    = events.length
  const critical = events.filter(e => e.severity === 'critical').length
  const warning  = events.filter(e => e.severity === 'warning').length
  const info     = events.filter(e => e.severity === 'info').length
  const pct      = (n) => total > 0 ? Math.round((n / total) * 100) : 0

  const topEvent = total > 0
    ? [...events].sort((a, b) => {
        const ra = SEV_RANK[a.severity] ?? 3
        const rb = SEV_RANK[b.severity] ?? 3
        if (ra !== rb) return ra - rb
        return new Date(b.occurred_at ?? 0) - new Date(a.occurred_at ?? 0)
      })[0]
    : null

  const viewLabel = severity === 'all' ? 'All events' : `${severity} filter`

  return (
    <div className="events-page">

      <div className="events-page-hdr">
        <div className="events-page-hdr-body">
          <h1 className="events-page-title">Security Events</h1>
          <p className="events-page-subtitle">Review detected activity, alerts, and system incidents</p>
        </div>
      </div>

      {!loading && !error && (
        <div className="events-summary-grid">
          <div className="events-summary-card">
            <div className="events-summary-card-label">Total Events</div>
            <div className="events-summary-card-value">{total}</div>
            <div className="events-summary-card-desc">Current view</div>
          </div>
          <div className="events-summary-card events-summary-card--critical">
            <div className="events-summary-card-label">Critical</div>
            <div className="events-summary-card-value events-summary-val--critical">{critical}</div>
            <div className="events-summary-card-desc">{pct(critical)}% of view</div>
          </div>
          <div className="events-summary-card events-summary-card--warning">
            <div className="events-summary-card-label">Warning</div>
            <div className="events-summary-card-value events-summary-val--warning">{warning}</div>
            <div className="events-summary-card-desc">{pct(warning)}% of view</div>
          </div>
          <div className="events-summary-card events-summary-card--info">
            <div className="events-summary-card-label">Info</div>
            <div className="events-summary-card-value events-summary-val--info">{info}</div>
            <div className="events-summary-card-desc">{pct(info)}% of view</div>
          </div>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <div className="events-analysis-row">

          <div className="events-dist-panel">
            <div className="events-dist-panel-label">Severity Distribution</div>
            <div className="events-dist-rows">
              {[
                { key: 'critical', label: 'Critical', count: critical },
                { key: 'warning',  label: 'Warning',  count: warning  },
                { key: 'info',     label: 'Info',     count: info     },
              ].map(({ key, label, count }) => (
                <div key={key} className="events-dist-row">
                  <span className="events-dist-label">{label}</span>
                  <div className="events-dist-bar-track">
                    <div
                      className={`events-dist-bar-fill events-dist-bar--${key}`}
                      style={{ width: `${pct(count)}%` }}
                    />
                  </div>
                  <span className="events-dist-count">{count}</span>
                </div>
              ))}
            </div>
            <div className="events-dist-footer">{viewLabel} &middot; {total} event{total !== 1 ? 's' : ''}</div>
          </div>

          {topEvent && (
            <div className={`events-incident-panel events-incident-panel--${topEvent.severity ?? 'info'}`}>
              <div className="events-incident-panel-hdr">
                <span className="events-incident-panel-label">Top Incident</span>
                <Badge baseClass="severity-badge" variant={topEvent.severity ?? 'info'}>{topEvent.severity ?? '—'}</Badge>
              </div>
              <div className="events-incident-fields">
                <div className="events-incident-field">
                  <span className="events-incident-field-label">Type</span>
                  <span className="events-incident-field-value">{topEvent.event_type ?? '—'}</span>
                </div>
                <div className="events-incident-field">
                  <span className="events-incident-field-label">Room</span>
                  <span className="events-incident-field-value">{topEvent.room_id ?? '—'}</span>
                </div>
                <div className="events-incident-field">
                  <span className="events-incident-field-label">Device</span>
                  <span className="events-incident-field-value events-incident-field-value--mono">{topEvent.device_id ?? '—'}</span>
                </div>
                <div className="events-incident-field">
                  <span className="events-incident-field-label">Occurred</span>
                  <span className="events-incident-field-value events-incident-field-value--mono">{formatDateTime(topEvent.occurred_at)}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

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
