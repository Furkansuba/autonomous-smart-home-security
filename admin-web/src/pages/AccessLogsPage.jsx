import { useState, useEffect } from 'react'
import { getAccessLogs } from '../services/accessLogService.js'
import { formatDateTime } from '../utils/formatters.js'
import Badge from '../components/ui/Badge.jsx'
import FilterBar from '../components/ui/FilterBar.jsx'
import DataTable from '../components/ui/DataTable.jsx'

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

  return (
    <div className="access-logs-page">
      <div className="access-logs-toolbar">
        <FilterBar options={RESULT_FILTERS} activeValue={result} onChange={setResult} />
      </div>

      {loading && <p className="access-logs-loading">Loading access logs…</p>}

      {!loading && error && (
        <p className="access-logs-error">{error}</p>
      )}

      {!loading && !error && logs.length === 0 && (
        <p className="access-logs-empty">No access logs found.</p>
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
