import { useState, useEffect } from 'react'
import { getTelemetry, getLatestTelemetry } from '../services/telemetryService.js'
import { formatDateTime } from '../utils/formatters.js'
import DataTable from '../components/ui/DataTable.jsx'

function TelemetryPage() {
  const [telemetry, setTelemetry] = useState([])
  const [latest,    setLatest]    = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getTelemetry(), getLatestTelemetry()])
      .then(([list, lat]) => {
        if (!cancelled) {
          setTelemetry(Array.isArray(list) ? list : [])
          setLatest(lat)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load telemetry.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="telemetry-page">
      {loading && <p className="telemetry-loading">Loading telemetry…</p>}

      {!loading && error && (
        <p className="telemetry-error">{error}</p>
      )}

      {!loading && !error && (
        <>
          <div className="telemetry-latest-card">
            <span className="telemetry-latest-label">Latest Reading</span>
            {latest ? (
              <div className="telemetry-latest-body">
                <span><strong>Device:</strong> {latest.device_id ?? '—'}</span>
                <span><strong>Room:</strong> {latest.room_id ?? '—'}</span>
                {latest.temperature_c    != null && <span><strong>Temp:</strong> {latest.temperature_c.toFixed(1)} °C</span>}
                {latest.humidity_percent != null && <span><strong>Humidity:</strong> {latest.humidity_percent.toFixed(0)}%</span>}
                <span><strong>Motion:</strong> {latest.motion_detected ? 'Yes' : 'No'}</span>
                <span><strong>Flame:</strong> {latest.flame_detected ? 'Yes' : 'No'}</span>
                <span><strong>Gas:</strong> {latest.gas_detected ? 'Yes' : 'No'}</span>
                {(latest.recorded_at || latest.createdAt) && (
                  <span><strong>At:</strong> {formatDateTime(latest.recorded_at ?? latest.createdAt)}</span>
                )}
              </div>
            ) : (
              <p className="telemetry-latest-empty">No recent telemetry data.</p>
            )}
          </div>

          {telemetry.length === 0 ? (
            <p className="telemetry-empty">No telemetry records found.</p>
          ) : (
            <DataTable
              wrapClassName="telemetry-table-wrap"
              tableClassName="telemetry-table"
              columns={['Device', 'Room', 'Temp (°C)', 'Humidity (%)', 'Motion', 'Flame', 'Gas', 'Recorded At']}
            >
              {telemetry.map((t) => (
                <tr key={t._id ?? t.telemetry_id ?? `${t.device_id}-${t.recorded_at}`}>
                  <td className="telemetry-col-id">{t.device_id ?? '—'}</td>
                  <td>{t.room_id ?? '—'}</td>
                  <td>{t.temperature_c    != null ? t.temperature_c.toFixed(1)    : '—'}</td>
                  <td>{t.humidity_percent != null ? t.humidity_percent.toFixed(0) : '—'}</td>
                  <td>{t.motion_detected != null ? (t.motion_detected ? 'Yes' : 'No') : '—'}</td>
                  <td>{t.flame_detected  != null ? (t.flame_detected  ? 'Yes' : 'No') : '—'}</td>
                  <td>{t.gas_detected    != null ? (t.gas_detected    ? 'Yes' : 'No') : '—'}</td>
                  <td className="telemetry-col-ts">{formatDateTime(t.recorded_at ?? t.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </>
      )}
    </div>
  )
}

export default TelemetryPage
