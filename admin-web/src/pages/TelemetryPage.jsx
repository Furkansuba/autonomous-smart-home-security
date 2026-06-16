import { useState, useEffect } from 'react'
import { getTelemetry, getLatestTelemetry, getActiveHazards } from '../services/telemetryService.js'
import { formatDateTime } from '../utils/formatters.js'
import { exportRowsToCsv } from '../utils/csvExport.js'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'

const HAZARD_LABELS = {
  fire_detected: 'Fire',
  gas_detected: 'Gas',
  co_detected: 'CO',
  intrusion_detected: 'Intrusion',
  vibration_detected: 'Impact',
  reed_switch_opened: 'Reed / Window',
  motion_detected: 'Motion',
}
const hazardLabel = (type) => HAZARD_LABELS[type] ?? type

const IconThermometer = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="8" y1="2" x2="8" y2="9" />
    <circle cx="8" cy="11.5" r="2.5" />
    <line x1="10" y1="4.5" x2="11.5" y2="4.5" />
    <line x1="10" y1="6.5" x2="11.5" y2="6.5" />
  </svg>
)

const IconDrop = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2L4 9.5a4 4 0 008 0L8 2z" />
  </svg>
)

const IconRadar = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="8" cy="9" r="1.5" />
    <path d="M5.5 9a2.5 2.5 0 005 0" />
    <path d="M3 9a5 5 0 0010 0" />
  </svg>
)

const IconFlame = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 14c-2.5 0-4.5-2-4.5-4.5 0-2 1.5-3.5 2.5-5 0 1.5.5 2.5 1.5 3 0-1.5.5-3 2-4.5-.5 2 .5 3.5 1.5 4.5.5-.5.5-1.5.5-2 1 1.5 1.5 2.5 1.5 4C13 12 11 14 8 14z" />
  </svg>
)

const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3L2.5 13h11L8 3z" />
    <line x1="8" y1="7.5" x2="8" y2="10" />
    <circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
  </svg>
)

function TelemetryPage() {
  const [telemetry, setTelemetry] = useState([])
  const [latest,    setLatest]    = useState(null)
  const [hazards,   setHazards]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getTelemetry(), getLatestTelemetry(), getActiveHazards()])
      .then(([list, lat, hz]) => {
        if (!cancelled) {
          setTelemetry(Array.isArray(list) ? list : [])
          setLatest(lat)
          setHazards(Array.isArray(hz) ? hz : [])
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

  const boolLabel    = (val) => val == null ? '—' : (val ? 'Detected' : 'Clear')
  const boolValClass = (val) => val == null ? '' : (val ? 'telemetry-val--alert' : 'telemetry-val--ok')
  const boolTile     = (val) => val ? 'sensor-tile--alert' : 'sensor-tile--ok'

  const gasLabel     = (val) => val == null ? '—' : String(val)
  const gasValClass  = (val) => val == null ? '' : (val > 1000 ? 'telemetry-val--alert' : 'telemetry-val--ok')
  const gasTileClass = (val) => val == null ? '' : (val > 1000 ? 'sensor-tile--alert' : 'sensor-tile--ok')

  const yesNoBlank = (v) => (v == null ? '' : (v ? 'Yes' : 'No'))

  function handleExportCsv() {
    exportRowsToCsv('telemetry', [
      { header: 'Device',       value: (t) => t.device_id },
      { header: 'Room',         value: (t) => t.room_id },
      { header: 'Temp (C)',     value: (t) => (t.temperature_c != null ? t.temperature_c : '') },
      { header: 'Humidity (%)', value: (t) => (t.humidity_percent != null ? t.humidity_percent : '') },
      { header: 'Gas raw',      value: (t) => (t.gas_raw != null ? t.gas_raw : '') },
      { header: 'CO raw',       value: (t) => (t.co_raw != null ? t.co_raw : '') },
      { header: 'Flame',        value: (t) => yesNoBlank(t.flame_detected) },
      { header: 'Motion',       value: (t) => yesNoBlank(t.motion_detected) },
      { header: 'Reed open',    value: (t) => yesNoBlank(t.reed_open) },
      { header: 'Recorded At',  value: (t) => formatDateTime(t.recorded_at ?? t.createdAt) },
    ], telemetry)
  }

  return (
    <div className="telemetry-page">

      {/* ── Page header ── */}
      <div className="telemetry-page-hdr">
        <div className="telemetry-page-hdr-body">
          <h2 className="telemetry-page-title">Sensor Monitoring</h2>
          <p className="telemetry-page-subtitle">Latest environmental and security sensor readings</p>
        </div>

        {latest && (
          <div className="telemetry-summary-chips">
            <span className="telemetry-chip">
              <span className="telemetry-chip-label">Room</span>
              <span className="telemetry-chip-value">{latest.room_id ?? '—'}</span>
            </span>
            <span className="telemetry-chip">
              <span className="telemetry-chip-label">Temp</span>
              <span className="telemetry-chip-value">
                {latest.temperature_c != null ? `${latest.temperature_c.toFixed(1)} °C` : '—'}
              </span>
            </span>
            <span className="telemetry-chip">
              <span className="telemetry-chip-label">Humidity</span>
              <span className="telemetry-chip-value">
                {latest.humidity_percent != null ? `${latest.humidity_percent.toFixed(0)}%` : '—'}
              </span>
            </span>
            <span className={`telemetry-chip${latest.motion_detected ? ' telemetry-chip--alert' : ''}`}>
              <span className="telemetry-chip-label">Motion</span>
              <span className="telemetry-chip-value">{boolLabel(latest.motion_detected)}</span>
            </span>
            <span className={`telemetry-chip${latest.flame_detected ? ' telemetry-chip--alert' : ''}`}>
              <span className="telemetry-chip-label">Flame</span>
              <span className="telemetry-chip-value">{boolLabel(latest.flame_detected)}</span>
            </span>
            <span className={`telemetry-chip${latest.gas_raw > 1000 ? ' telemetry-chip--alert' : ''}`}>
              <span className="telemetry-chip-label">Gas raw</span>
              <span className="telemetry-chip-value">{gasLabel(latest.gas_raw)}</span>
            </span>
          </div>
        )}
      </div>

      {loading && <StateMessage className="telemetry-loading">Loading telemetry…</StateMessage>}

      {!loading && error && (
        <StateMessage className="telemetry-error">{error}</StateMessage>
      )}

      {!loading && !error && (
        <>
          {/* ── Recent hazards (derived from alert events, not raw sensor values) ── */}
          {hazards.length > 0 && (
            <div className="dash-panel" style={{ borderTop: '3px solid #dc2626' }}>
              <div className="dash-panel-hdr">
                <span className="dash-panel-title">Recent Hazards</span>
                <span className="dash-panel-badge" style={{ background: '#dc2626', color: '#fff' }}>
                  Derived from alerts
                </span>
              </div>
              <p className="telemetry-page-subtitle" style={{ margin: '0 0 10px' }}>
                Active alert events still within their visibility window. Derived from recent
                events — not the live sensor snapshot below.
              </p>
              <div className="telemetry-summary-chips">
                {hazards.map((h) => (
                  <span key={h.event_id} className="telemetry-chip telemetry-chip--alert">
                    <span className="telemetry-chip-label">
                      {hazardLabel(h.event_type)} · {h.room_id}
                    </span>
                    <span className="telemetry-chip-value">Recent event</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Featured latest reading panel ── */}
          <div className="telemetry-reading-panel">
            <div className="telemetry-reading-hdr">
              <span className="telemetry-reading-label">Latest Sensor Reading</span>
              {latest && (latest.recorded_at || latest.createdAt) && (
                <span className="telemetry-reading-ts">
                  {formatDateTime(latest.recorded_at ?? latest.createdAt)}
                </span>
              )}
            </div>

            {latest ? (
              <div className="telemetry-reading-grid">
                <div className="telemetry-reading-field">
                  <span className="telemetry-reading-field-label">Device ID</span>
                  <span className="telemetry-reading-field-value telemetry-reading-field-value--mono">
                    {latest.device_id ?? '—'}
                  </span>
                </div>
                <div className="telemetry-reading-field">
                  <span className="telemetry-reading-field-label">Room</span>
                  <span className="telemetry-reading-field-value">{latest.room_id ?? '—'}</span>
                </div>
                <div className="telemetry-reading-field">
                  <span className="telemetry-reading-field-label">Temperature</span>
                  <span className="telemetry-reading-field-value">
                    {latest.temperature_c != null ? `${latest.temperature_c.toFixed(1)} °C` : '—'}
                  </span>
                </div>
                <div className="telemetry-reading-field">
                  <span className="telemetry-reading-field-label">Humidity</span>
                  <span className="telemetry-reading-field-value">
                    {latest.humidity_percent != null ? `${latest.humidity_percent.toFixed(0)}%` : '—'}
                  </span>
                </div>
                <div className="telemetry-reading-field">
                  <span className="telemetry-reading-field-label">Motion</span>
                  <span className={`telemetry-reading-field-value ${boolValClass(latest.motion_detected)}`}>
                    {boolLabel(latest.motion_detected)}
                  </span>
                </div>
                <div className="telemetry-reading-field">
                  <span className="telemetry-reading-field-label">Flame</span>
                  <span className={`telemetry-reading-field-value ${boolValClass(latest.flame_detected)}`}>
                    {boolLabel(latest.flame_detected)}
                  </span>
                </div>
                <div className="telemetry-reading-field">
                  <span className="telemetry-reading-field-label">Gas raw</span>
                  <span className={`telemetry-reading-field-value ${gasValClass(latest.gas_raw)}`}>
                    {gasLabel(latest.gas_raw)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="telemetry-latest-empty">No recent telemetry data.</p>
            )}
          </div>

          {/* ── Sensor tiles ── */}
          {latest && (
            <div className="dash-panel">
              <div className="dash-panel-hdr">
                <span className="dash-panel-title">Environmental Sensors</span>
                <span className="dash-panel-badge">Latest reading</span>
              </div>
              <div className="sensor-tile-grid">
                <div className="sensor-tile">
                  <div className="sensor-tile-icon"><IconThermometer /></div>
                  <span className="sensor-tile-value">
                    {latest.temperature_c != null ? `${latest.temperature_c.toFixed(1)}°` : '—'}
                  </span>
                  <span className="sensor-tile-label">Temperature</span>
                </div>
                <div className="sensor-tile">
                  <div className="sensor-tile-icon"><IconDrop /></div>
                  <span className="sensor-tile-value">
                    {latest.humidity_percent != null ? `${latest.humidity_percent.toFixed(0)}%` : '—'}
                  </span>
                  <span className="sensor-tile-label">Humidity</span>
                </div>
                <div className={`sensor-tile ${boolTile(latest.motion_detected)}`}>
                  <div className="sensor-tile-icon"><IconRadar /></div>
                  <span className="sensor-tile-value">{boolLabel(latest.motion_detected)}</span>
                  <span className="sensor-tile-label">Motion</span>
                </div>
                <div className={`sensor-tile ${boolTile(latest.flame_detected)}`}>
                  <div className="sensor-tile-icon"><IconFlame /></div>
                  <span className="sensor-tile-value">{boolLabel(latest.flame_detected)}</span>
                  <span className="sensor-tile-label">Flame</span>
                </div>
                <div className={`sensor-tile ${gasTileClass(latest.gas_raw)}`}>
                  <div className="sensor-tile-icon"><IconWarning /></div>
                  <span className="sensor-tile-value">{gasLabel(latest.gas_raw)}</span>
                  <span className="sensor-tile-label">Gas raw</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Records table ── */}
          {telemetry.length === 0 ? (
            <StateMessage className="telemetry-empty">No telemetry records found.</StateMessage>
          ) : (
            <>
              <div className="telemetry-records-hdr">
                <span className="telemetry-records-title">All Records</span>
                <span className="telemetry-records-count">{telemetry.length}</span>
                <button
                  type="button"
                  className="btn-export-csv"
                  onClick={handleExportCsv}
                  disabled={telemetry.length === 0}
                >
                  Export CSV
                </button>
              </div>
              <DataTable
                wrapClassName="telemetry-table-wrap"
                tableClassName="telemetry-table"
                columns={['Device', 'Room', 'Temp (°C)', 'Humidity (%)', 'Motion', 'Flame', 'Gas raw', 'Recorded At']}
              >
                {telemetry.map((t) => (
                  <tr key={t._id ?? t.telemetry_id ?? `${t.device_id}-${t.recorded_at}`}>
                    <td className="telemetry-col-id">{t.device_id ?? '—'}</td>
                    <td>{t.room_id ?? '—'}</td>
                    <td>{t.temperature_c    != null ? t.temperature_c.toFixed(1)    : '—'}</td>
                    <td>{t.humidity_percent != null ? t.humidity_percent.toFixed(0) : '—'}</td>
                    <td>{t.motion_detected != null ? (t.motion_detected ? 'Yes' : 'No') : '—'}</td>
                    <td>{t.flame_detected  != null ? (t.flame_detected  ? 'Yes' : 'No') : '—'}</td>
                    <td>{t.gas_raw != null ? t.gas_raw : '—'}</td>
                    <td className="telemetry-col-ts">{formatDateTime(t.recorded_at ?? t.createdAt)}</td>
                  </tr>
                ))}
              </DataTable>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default TelemetryPage
