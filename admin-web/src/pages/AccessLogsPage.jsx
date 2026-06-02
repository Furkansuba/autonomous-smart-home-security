import { useState, useEffect } from 'react'
import { getAccessLogs } from '../services/accessLogService.js'
import { formatDateTime } from '../utils/formatters.js'
import Badge from '../components/ui/Badge.jsx'
import FilterBar from '../components/ui/FilterBar.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'

const RESULT_FILTERS = ['all', 'granted', 'denied']

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

  const total        = logs.length
  const grantedCount = logs.filter(l => l.result === 'granted').length
  const deniedCount  = logs.filter(l => l.result === 'denied').length
  const denialRate   = total > 0 ? Math.round((deniedCount / total) * 100) : 0

  const latestLog = total > 0
    ? [...logs].sort((a, b) => new Date(b.occurred_at ?? 0) - new Date(a.occurred_at ?? 0))[0]
    : null

  const denialRateClass = denialRate >= 50
    ? 'access-summary-val--denied'
    : denialRate > 0
      ? 'access-summary-val--warn'
      : ''

  const latestPanelMod = latestLog?.result === 'granted'
    ? 'granted'
    : latestLog?.result === 'denied'
      ? 'denied'
      : 'neutral'

  return (
    <div className="access-logs-page">

      <div className="access-page-hdr">
        <div className="access-page-hdr-body">
          <h1 className="access-page-title">Access Control</h1>
          <p className="access-page-subtitle">Review gate activity, entry attempts, and authorization outcomes</p>
        </div>
      </div>

      {!loading && !error && (
        <div className="access-summary-grid">
          <div className="access-summary-card">
            <div className="access-summary-card-label">Total Attempts</div>
            <div className="access-summary-card-value">{total}</div>
            <div className="access-summary-card-desc">Current view</div>
          </div>
          <div className="access-summary-card access-summary-card--granted">
            <div className="access-summary-card-label">Granted</div>
            <div className="access-summary-card-value access-summary-val--granted">{grantedCount}</div>
            <div className="access-summary-card-desc">Authorized entries</div>
          </div>
          <div className="access-summary-card access-summary-card--denied">
            <div className="access-summary-card-label">Denied</div>
            <div className="access-summary-card-value access-summary-val--denied">{deniedCount}</div>
            <div className="access-summary-card-desc">Blocked attempts</div>
          </div>
          <div className="access-summary-card">
            <div className="access-summary-card-label">Denial Rate</div>
            <div className={`access-summary-card-value ${denialRateClass}`}>
              {total > 0 ? `${denialRate}%` : '—'}
            </div>
            <div className="access-summary-card-desc">Of current view</div>
          </div>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <div className="access-analysis-row">
          <div className="access-dist-panel">
            <div className="access-dist-panel-label">Outcome Distribution</div>
            <div className="access-dist-rows">
              <div className="access-dist-row">
                <div className="access-dist-label">Granted</div>
                <div className="access-dist-bar-track">
                  <div
                    className="access-dist-bar-fill access-dist-bar--granted"
                    style={{ width: `${(grantedCount / total) * 100}%` }}
                  />
                </div>
                <div className="access-dist-count">{grantedCount}</div>
              </div>
              <div className="access-dist-row">
                <div className="access-dist-label">Denied</div>
                <div className="access-dist-bar-track">
                  <div
                    className="access-dist-bar-fill access-dist-bar--denied"
                    style={{ width: `${(deniedCount / total) * 100}%` }}
                  />
                </div>
                <div className="access-dist-count">{deniedCount}</div>
              </div>
            </div>
            <div className="access-dist-footer">
              {total} attempt{total !== 1 ? 's' : ''} in current view
            </div>
          </div>

          {latestLog && (
            <div className={`access-latest-panel access-latest-panel--${latestPanelMod}`}>
              <div className="access-latest-panel-hdr">
                <div className="access-latest-panel-label">Latest Attempt</div>
                <Badge baseClass="result-badge" variant={latestLog.result ?? 'unknown'}>
                  {latestLog.result ?? '—'}
                </Badge>
              </div>
              <div className="access-latest-fields">
                <div className="access-latest-field">
                  <div className="access-latest-field-label">Gate</div>
                  <div className="access-latest-field-value">{latestLog.gate_id ?? '—'}</div>
                </div>
                <div className="access-latest-field">
                  <div className="access-latest-field-label">User</div>
                  <div className="access-latest-field-value access-latest-field-value--mono">{latestLog.user_id ?? '—'}</div>
                </div>
                <div className="access-latest-field">
                  <div className="access-latest-field-label">Device</div>
                  <div className="access-latest-field-value access-latest-field-value--mono">{latestLog.device_id ?? '—'}</div>
                </div>
                <div className="access-latest-field">
                  <div className="access-latest-field-label">Method</div>
                  <div className="access-latest-field-value">{latestLog.access_method ?? '—'}</div>
                </div>
                <div className="access-latest-field access-latest-field--wide">
                  <div className="access-latest-field-label">Occurred At</div>
                  <div className="access-latest-field-value access-latest-field-value--mono">{formatDateTime(latestLog.occurred_at) ?? '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="access-logs-toolbar">
        <FilterBar options={RESULT_FILTERS} activeValue={result} onChange={setResult} />
      </div>

      {loading && <StateMessage className="access-logs-loading">Loading access logs…</StateMessage>}

      {!loading && error && (
        <StateMessage className="access-logs-error">{error}</StateMessage>
      )}

      {!loading && !error && logs.length === 0 && (
        <StateMessage className="access-logs-empty">No access logs found.</StateMessage>
      )}

      {!loading && !error && logs.length > 0 && (
        <DataTable
          wrapClassName="access-logs-table-wrap"
          tableClassName="access-logs-table"
          columns={['Access ID', 'Device', 'Gate', 'User', 'Method', 'Result', 'Occurred At']}
        >
          {logs.map((l) => (
            <tr key={l.access_id ?? l._id}>
              <td className="access-logs-col-id">{l.access_id ?? '—'}</td>
              <td>{l.device_id ?? '—'}</td>
              <td>{l.gate_id ?? '—'}</td>
              <td>{l.user_id ?? '—'}</td>
              <td>{l.access_method ?? '—'}</td>
              <td><Badge baseClass="result-badge" variant={l.result ?? 'unknown'}>{l.result ?? '—'}</Badge></td>
              <td className="access-logs-col-ts">{formatDateTime(l.occurred_at)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  )
}

export default AccessLogsPage
