import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import LoginPage from './components/LoginPage.jsx'
import * as authService from './services/authService.js'
import { getDashboardSummary } from './services/dashboardService.js'
import { getDevices, refreshDeviceStatuses } from './services/deviceService.js'
import { getEvents } from './services/eventService.js'
import { getAccessLogs } from './services/accessLogService.js'
import { getTelemetry, getLatestTelemetry } from './services/telemetryService.js'
import { getOverrides, createOverride } from './services/overrideService.js'

const NAV_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard'   },
  { key: 'devices',     label: 'Devices'     },
  { key: 'events',      label: 'Events'      },
  { key: 'access-logs', label: 'Access Logs' },
  { key: 'telemetry',   label: 'Telemetry'   },
  { key: 'overrides',   label: 'Overrides'   },
]

const SECTION_META = {}

function Sidebar({ active, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <svg className="brand-icon" width="18" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6L12 2z" fill="#e53e3e"/>
        </svg>
        <span className="brand-name">Smart Home Security</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`nav-item${active === item.key ? ' nav-item--active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

function parseTelemetry(latest) {
  if (!Array.isArray(latest) || latest.length === 0) return { primary: 'No data', secondary: '' }
  const t = latest[0]
  if (t == null) return { primary: 'No data', secondary: '' }
  const primary = t.temperature_c != null ? `${t.temperature_c.toFixed(1)}°C` : '—'
  const parts = []
  if (t.humidity_percent != null) parts.push(`${t.humidity_percent.toFixed(0)}% humidity`)
  if (t.room_id) parts.push(t.room_id)
  return { primary, secondary: parts.join(' · ') }
}

function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getDashboardSummary()
      .then((data) => {
        if (!cancelled) {
          setSummary(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load dashboard data.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const activeDevices    = summary?.devices?.total_active             ?? '—'
  const criticalEvents   = summary?.events?.recent_critical_24h_count ?? '—'
  const pendingOverrides = summary?.overrides?.pending_count           ?? '—'
  const telData          = summary ? parseTelemetry(summary?.telemetry?.latest) : { primary: '—', secondary: '' }

  const devCount  = typeof activeDevices    === 'number' ? activeDevices    : 0
  const critCount = typeof criticalEvents   === 'number' ? criticalEvents   : 0
  const pendCount = typeof pendingOverrides === 'number' ? pendingOverrides : 0

  const healthStatus = summary === null ? '—' : devCount > 0 ? 'Operational' : 'No devices'
  const healthDesc   = summary === null ? 'Awaiting data' : `${devCount} device${devCount !== 1 ? 's' : ''} online`
  const secStatus    = summary === null ? '—' : critCount === 0 ? 'Low Risk' : critCount < 3 ? 'Elevated Risk' : 'High Risk'
  const secColor     = critCount === 0 ? 'ok' : critCount < 3 ? 'warn' : 'alert'
  const secDesc      = summary === null ? 'Awaiting data' : `${critCount} critical event${critCount !== 1 ? 's' : ''} in last 24h`
  const actValue     = summary === null ? '—' : String(pendCount)
  const actDesc      = summary === null ? 'Awaiting data' : `override request${pendCount !== 1 ? 's' : ''} pending`

  const kpiCards = [
    {
      label: 'Active Devices',
      value: activeDevices,
      desc: 'Connected to system',
      accent: false,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
    {
      label: 'Critical Events',
      value: criticalEvents,
      desc: 'Last 24 hours',
      accent: true,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      ),
    },
    {
      label: 'Pending Overrides',
      value: pendingOverrides,
      desc: 'Awaiting resolution',
      accent: false,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
          <circle cx="14" cy="6" r="2" fill="currentColor"/>
          <circle cx="8" cy="12" r="2" fill="currentColor"/>
          <circle cx="16" cy="18" r="2" fill="currentColor"/>
        </svg>
      ),
    },
    {
      label: 'Latest Telemetry',
      value: telData.primary,
      sub: telData.secondary,
      desc: 'Most recent reading',
      accent: false,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="dashboard-page">
      {loading && <p className="dashboard-status">Loading dashboard…</p>}
      {!loading && error && <p className="dashboard-error">{error}</p>}
      <div className="kpi-grid">
        {kpiCards.map((card) => (
          <div key={card.label} className={`kpi-card${card.accent ? ' kpi-card--alert' : ''}`}>
            <div className="kpi-card-header">
              <span className="kpi-label">{card.label}</span>
              <span className="kpi-icon">{card.icon}</span>
            </div>
            <span className="kpi-value">{card.value}</span>
            {card.sub && <span className="kpi-sub">{card.sub}</span>}
            <span className="kpi-desc">{card.desc}</span>
          </div>
        ))}
      </div>
      <div className="dashboard-row2">
        <div className="info-panel">
          <span className="info-panel-label">System Health</span>
          <span className={`info-panel-value info-panel-value--${devCount > 0 && summary !== null ? 'ok' : 'neutral'}`}>
            {healthStatus}
          </span>
          <span className="info-panel-desc">{healthDesc}</span>
        </div>
        <div className="info-panel">
          <span className="info-panel-label">Security Overview</span>
          <span className={`info-panel-value info-panel-value--${summary !== null ? secColor : 'neutral'}`}>
            {secStatus}
          </span>
          <span className="info-panel-desc">{secDesc}</span>
        </div>
        <div className="info-panel">
          <span className="info-panel-label">Recent Activity</span>
          <span className="info-panel-value info-panel-value--neutral">{actValue}</span>
          <span className="info-panel-desc">{actDesc}</span>
        </div>
      </div>
    </div>
  )
}

function formatHeartbeat(raw) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d)) return '—'
  return d.toLocaleString()
}

function StatusBadge({ status }) {
  return (
    <span className={`device-status-badge device-status-badge--${status ?? 'offline'}`}>
      {status ?? 'offline'}
    </span>
  )
}

function DevicesPage() {
  const [devices,     setDevices]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const [refreshMsg,  setRefreshMsg]  = useState(null)

  const loadDevices = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getDevices()
      .then((data) => {
        if (!cancelled) {
          setDevices(Array.isArray(data) ? data : (data?.devices ?? []))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load devices.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(loadDevices, [loadDevices])

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      await refreshDeviceStatuses()
      setRefreshMsg({ ok: true, text: 'Statuses refreshed.' })
      loadDevices()
    } catch (err) {
      setRefreshMsg({ ok: false, text: err.message || 'Refresh failed.' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="devices-page">
      <div className="devices-toolbar">
        <button
          className="btn-refresh"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          {refreshing ? 'Refreshing…' : 'Refresh Status'}
        </button>
        {refreshMsg && (
          <span className={`refresh-msg${refreshMsg.ok ? ' refresh-msg--ok' : ' refresh-msg--err'}`}>
            {refreshMsg.text}
          </span>
        )}
      </div>

      {loading && <p className="devices-loading">Loading devices…</p>}

      {!loading && error && (
        <p className="devices-error">{error}</p>
      )}

      {!loading && !error && devices.length === 0 && (
        <p className="devices-empty">No devices found.</p>
      )}

      {!loading && !error && devices.length > 0 && (
        <div className="devices-table-wrap">
          <table className="devices-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Firmware</th>
                <th>Last Heartbeat</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.device_id}>
                  <td className="devices-col-id">{d.device_id}</td>
                  <td>{d.name ?? '—'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>{d.firmware_version ?? '—'}</td>
                  <td className="devices-col-ts">{formatHeartbeat(d.last_heartbeat_at)}</td>
                  <td>{d.is_active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

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
                  <td className="events-col-ts">{formatHeartbeat(e.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

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
                  <td className="access-logs-col-ts">{formatHeartbeat(l.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

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
                  <span><strong>At:</strong> {formatHeartbeat(latest.recorded_at ?? latest.createdAt)}</span>
                )}
              </div>
            ) : (
              <p className="telemetry-latest-empty">No recent telemetry data.</p>
            )}
          </div>

          {telemetry.length === 0 ? (
            <p className="telemetry-empty">No telemetry records found.</p>
          ) : (
            <div className="telemetry-table-wrap">
              <table className="telemetry-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Room</th>
                    <th>Temp (°C)</th>
                    <th>Humidity (%)</th>
                    <th>Motion</th>
                    <th>Flame</th>
                    <th>Gas</th>
                    <th>Recorded At</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry.map((t) => (
                    <tr key={t._id ?? t.telemetry_id ?? `${t.device_id}-${t.recorded_at}`}>
                      <td className="telemetry-col-id">{t.device_id ?? '—'}</td>
                      <td>{t.room_id ?? '—'}</td>
                      <td>{t.temperature_c    != null ? t.temperature_c.toFixed(1)    : '—'}</td>
                      <td>{t.humidity_percent != null ? t.humidity_percent.toFixed(0) : '—'}</td>
                      <td>{t.motion_detected != null ? (t.motion_detected ? 'Yes' : 'No') : '—'}</td>
                      <td>{t.flame_detected  != null ? (t.flame_detected  ? 'Yes' : 'No') : '—'}</td>
                      <td>{t.gas_detected    != null ? (t.gas_detected    ? 'Yes' : 'No') : '—'}</td>
                      <td className="telemetry-col-ts">{formatHeartbeat(t.recorded_at ?? t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const OVERRIDE_STATUS_FILTERS = ['all', 'requested', 'executed', 'failed', 'blocked']
const OVERRIDE_ACTIONS_LIST = [
  'pump_on', 'pump_off',
  'valve_open', 'valve_close',
  'buzzer_on', 'buzzer_off',
  'door_unlock', 'system_reset',
]

function OverrideStatusBadge({ status }) {
  return (
    <span className={`override-status-badge override-status-badge--${status ?? 'requested'}`}>
      {status ?? '—'}
    </span>
  )
}

function OverridesPage() {
  const [overrides,    setOverrides]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const [formDevice,   setFormDevice]   = useState('esp32_home_01')
  const [formActuator, setFormActuator] = useState('buzzer_01')
  const [formAction,   setFormAction]   = useState('buzzer_off')
  const [formReason,   setFormReason]   = useState('Manual admin web override.')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitMsg,    setSubmitMsg]    = useState(null)

  const loadOverrides = useCallback((status) => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = {}
    if (status !== 'all') params.status = status
    getOverrides(params)
      .then((data) => {
        if (!cancelled) {
          setOverrides(Array.isArray(data?.overrides) ? data.overrides : [])
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load overrides.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => loadOverrides(statusFilter), [loadOverrides, statusFilter])

  function handleFilterChange(f) {
    setStatusFilter(f)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMsg(null)
    const storedUser = authService.getStoredUser()
    const requestedBy = storedUser?.user_id ?? 'usr_admin_001'
    try {
      await createOverride({
        device_id:    formDevice.trim(),
        actuator_id:  formActuator.trim(),
        action:       formAction,
        reason:       formReason.trim(),
        requested_by: requestedBy,
      })
      setSubmitMsg({ ok: true, text: 'Override created successfully.' })
      loadOverrides(statusFilter)
    } catch (err) {
      setSubmitMsg({ ok: false, text: err.message || 'Failed to create override.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overrides-page">
      <div className="overrides-toolbar">
        {OVERRIDE_STATUS_FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-btn${statusFilter === f ? ' filter-btn--active' : ''}`}
            onClick={() => handleFilterChange(f)}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {loading && <p className="overrides-loading">Loading overrides…</p>}

      {!loading && error && (
        <p className="overrides-error">{error}</p>
      )}

      {!loading && !error && overrides.length === 0 && (
        <p className="overrides-empty">No overrides found.</p>
      )}

      {!loading && !error && overrides.length > 0 && (
        <div className="overrides-table-wrap">
          <table className="overrides-table">
            <thead>
              <tr>
                <th>Override ID</th>
                <th>Device</th>
                <th>Requested By</th>
                <th>Actuator</th>
                <th>Action</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Requested At</th>
                <th>Result At</th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={o.override_id ?? o._id}>
                  <td className="overrides-col-id">{o.override_id ?? '—'}</td>
                  <td>{o.device_id ?? '—'}</td>
                  <td>{o.requested_by ?? '—'}</td>
                  <td>{o.actuator_id ?? '—'}</td>
                  <td>{o.action ?? '—'}</td>
                  <td className="overrides-col-reason" title={o.reason ?? '—'}>{o.reason ?? '—'}</td>
                  <td><OverrideStatusBadge status={o.status} /></td>
                  <td className="overrides-col-ts">{formatHeartbeat(o.requested_at)}</td>
                  <td className="overrides-col-ts">{o.result_at ? formatHeartbeat(o.result_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="override-form-card">
        <h3 className="override-form-heading">Create Override</h3>
        <form className="override-form" onSubmit={handleSubmit}>
          <div className="override-form-row">
            <label className="override-form-label">Device ID</label>
            <input
              className="override-form-input"
              type="text"
              value={formDevice}
              onChange={(e) => setFormDevice(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="override-form-row">
            <label className="override-form-label">Actuator ID</label>
            <input
              className="override-form-input"
              type="text"
              value={formActuator}
              onChange={(e) => setFormActuator(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="override-form-row">
            <label className="override-form-label">Action</label>
            <select
              className="override-form-select"
              value={formAction}
              onChange={(e) => setFormAction(e.target.value)}
              disabled={submitting}
            >
              {OVERRIDE_ACTIONS_LIST.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="override-form-row">
            <label className="override-form-label">Reason</label>
            <input
              className="override-form-input"
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              disabled={submitting}
              maxLength={240}
            />
          </div>
          <div className="override-form-footer">
            <button
              className="btn-override-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Override'}
            </button>
            {submitMsg && (
              <span className={`override-submit-msg${submitMsg.ok ? ' override-submit-msg--ok' : ' override-submit-msg--err'}`}>
                {submitMsg.text}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function SectionPlaceholder({ page }) {
  const meta = SECTION_META[page]
  if (!meta) return null
  return (
    <div className="section-placeholder">
      <div className="section-placeholder-icon">&#9632;</div>
      <h2 className="section-placeholder-heading">{meta.heading}</h2>
      <p className="section-placeholder-desc">{meta.description}</p>
      <span className="section-placeholder-badge">Coming in next phase</span>
    </div>
  )
}

function AvatarMenu({ userLabel, onProfile, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const initial = (userLabel?.[0] ?? 'A').toUpperCase()

  return (
    <div className="avatar-menu" ref={ref}>
      <button className="avatar-btn" onClick={() => setOpen((v) => !v)} aria-label="User menu">
        {initial}
      </button>
      {open && (
        <div className="avatar-dropdown">
          <div className="avatar-dropdown-email">{userLabel}</div>
          <button className="avatar-dropdown-item" onClick={() => { setOpen(false); onProfile() }}>
            Profile
          </button>
          <button className="avatar-dropdown-item avatar-dropdown-item--danger" onClick={() => { setOpen(false); onLogout() }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

function ProfilePage() {
  const user = authService.getStoredUser()
  const initial = (user?.email?.[0] ?? 'A').toUpperCase()
  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar-lg">{initial}</div>
        <div className="profile-fields">
          <div className="profile-field">
            <span className="profile-field-label">Email</span>
            <span className="profile-field-value">{user?.email ?? '—'}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">Role</span>
            <span className="profile-field-value">{user?.role ?? '—'}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">User ID</span>
            <span className="profile-field-value profile-field-value--mono">{user?.user_id ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PageContent({ page }) {
  if (page === 'dashboard')   return <DashboardPage />
  if (page === 'devices')     return <DevicesPage />
  if (page === 'events')      return <EventsPage />
  if (page === 'access-logs') return <AccessLogsPage />
  if (page === 'telemetry')   return <TelemetryPage />
  if (page === 'overrides')   return <OverridesPage />
  if (page === 'profile')     return <ProfilePage />
  return <SectionPlaceholder page={page} />
}

function App() {
  const [authed, setAuthed]         = useState(() => authService.isAuthenticated())
  const [activePage, setActivePage] = useState('dashboard')

  function handleLoginSuccess() {
    setAuthed(true)
  }

  function handleLogout() {
    authService.logout()
    setAuthed(false)
  }

  if (!authed) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  const user = authService.getStoredUser()
  const userLabel = user?.email ?? 'Admin'

  return (
    <div className="app-shell">
      <Sidebar active={activePage} onNavigate={setActivePage} />
      <div className="main-wrapper">
        <header className="topbar">
          <span className="topbar-title">
            {NAV_ITEMS.find((i) => i.key === activePage)?.label ?? (activePage === 'profile' ? 'Profile' : '')}
          </span>
          <div className="topbar-right">
            <AvatarMenu
              userLabel={userLabel}
              onProfile={() => setActivePage('profile')}
              onLogout={handleLogout}
            />
          </div>
        </header>
        <main className="main-content">
          <PageContent page={activePage} />
        </main>
      </div>
    </div>
  )
}

export default App
