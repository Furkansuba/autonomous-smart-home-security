import { useState, useEffect, useCallback } from 'react'
import './App.css'
import LoginPage from './components/LoginPage.jsx'
import * as authService from './services/authService.js'
import { getDashboardSummary } from './services/dashboardService.js'
import { getDevices, refreshDeviceStatuses } from './services/deviceService.js'

const NAV_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard'   },
  { key: 'devices',     label: 'Devices'     },
  { key: 'events',      label: 'Events'      },
  { key: 'access-logs', label: 'Access Logs' },
  { key: 'telemetry',   label: 'Telemetry'   },
  { key: 'overrides',   label: 'Overrides'   },
]

const SECTION_META = {
  events: {
    heading: 'Events',
    description: 'Sensor events — fire, gas, CO, intrusion — with severity level, affected room, and timestamp will appear here.',
  },
  'access-logs': {
    heading: 'Access Logs',
    description: 'NFC access attempts — granted and denied — with user identity, tag ID, door, and timestamp will appear here.',
  },
  telemetry: {
    heading: 'Telemetry',
    description: 'Temperature, humidity, and raw sensor readings streamed live from ESP32 devices will appear here.',
  },
  overrides: {
    heading: 'Overrides',
    description: 'Manual override commands for pump, valve, and alarm actuators — with status, issuer, and full audit trail — will appear here.',
  },
}

function Sidebar({ active, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">&#9632;</span>
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
      <div className="sidebar-footer">Admin Panel</div>
    </aside>
  )
}

function formatTelemetry(latest) {
  if (!Array.isArray(latest) || latest.length === 0) return 'No data'
  const t = latest[0]
  if (t == null) return 'No data'
  const parts = []
  if (t.temperature_c != null) parts.push(`${t.temperature_c.toFixed(1)}°C`)
  if (t.humidity_percent != null) parts.push(`${t.humidity_percent.toFixed(0)}%`)
  if (t.room_id) parts.push(t.room_id)
  return parts.length > 0 ? parts.join(' · ') : 'No data'
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

  const activeDevices    = summary?.devices?.total_active                   ?? '—'
  const criticalEvents   = summary?.events?.recent_critical_24h_count       ?? '—'
  const pendingOverrides = summary?.overrides?.pending_count                 ?? '—'
  const latestTelemetry  = summary ? formatTelemetry(summary?.telemetry?.latest) : '—'

  const kpiCards = [
    { label: 'Active Devices',    value: activeDevices,    desc: 'Connected to system',  accent: false },
    { label: 'Critical Events',   value: criticalEvents,   desc: 'Last 24 hours',        accent: true  },
    { label: 'Pending Overrides', value: pendingOverrides, desc: 'Awaiting resolution',  accent: false },
    { label: 'Latest Telemetry',  value: latestTelemetry,  desc: 'Most recent reading',  accent: false },
  ]

  return (
    <div className="dashboard-page">
      {loading && <p className="dashboard-status">Loading dashboard…</p>}
      {!loading && error && <p className="dashboard-error">{error}</p>}
      <div className="kpi-grid">
        {kpiCards.map((card) => (
          <div key={card.label} className={`kpi-card${card.accent ? ' kpi-card--alert' : ''}`}>
            <span className="kpi-label">{card.label}</span>
            <span className="kpi-value">{card.value}</span>
            <span className="kpi-desc">{card.desc}</span>
          </div>
        ))}
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

function PageContent({ page }) {
  if (page === 'dashboard') return <DashboardPage />
  if (page === 'devices')   return <DevicesPage />
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
            {NAV_ITEMS.find((i) => i.key === activePage)?.label}
          </span>
          <div className="topbar-right">
            <span className="topbar-user">{userLabel}</span>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
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
