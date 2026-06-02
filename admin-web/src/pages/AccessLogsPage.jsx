import { useState, useEffect } from 'react'
import { getAccessLogs } from '../services/accessLogService.js'
import { formatDateTime } from '../utils/formatters.js'

const RESULT_FILTERS = ['all', 'granted', 'denied']

function ResultBadge({ result }) {
  return (
    <span className={`result-badge result-badge--${result ?? 'unknown'}`}>
      {result ?? '—'}
    </span>
  )
}

function AccessLogsPage() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [result,  setResult]  = useState('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = {}
    if (result !== 'all') params.result = result
    getAccessLogs(params)
      .then((data) => {
        if (!cancelled) {
          setLogs(Array.isArray(data) ? data : (data?.access_logs ?? []))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load access logs.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [result])

  return (
    <div className="access-logs-page">
      <div className="access-logs-toolbar">
        {RESULT_FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-btn${result === f ? ' filter-btn--active' : ''}`}
            onClick={() => setResult(f)}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {loading && <p className="access-logs-loading">Loading access logs…</p>}

      {!loading && error && (
        <p className="access-logs-error">{error}</p>
      )}

      {!loading && !error && logs.length === 0 && (
        <p className="access-logs-empty">No access logs found.</p>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="access-logs-table-wrap">
          <table className="access-logs-table">
            <thead>
              <tr>
                <th>Access ID</th>
                <th>Device</th>
                <th>Gate</th>
                <th>User</th>
                <th>Method</th>
                <th>Result</th>
                <th>Occurred At</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.access_id ?? l._id}>
                  <td className="access-logs-col-id">{l.access_id ?? '—'}</td>
                  <td>{l.device_id ?? '—'}</td>
                  <td>{l.gate_id ?? '—'}</td>
                  <td>{l.user_id ?? '—'}</td>
                  <td>{l.access_method ?? '—'}</td>
                  <td><ResultBadge result={l.result} /></td>
                  <td className="access-logs-col-ts">{formatDateTime(l.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AccessLogsPage
