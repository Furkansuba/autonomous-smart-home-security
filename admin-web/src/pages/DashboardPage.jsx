import { useState, useEffect } from 'react'
import { getDashboardSummary } from '../services/dashboardService.js'

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

  // Raw telemetry object for sensor tiles
  const rawTel = summary?.telemetry?.latest?.[0] ?? null

  const tempVal   = rawTel?.temperature_c   != null ? `${rawTel.temperature_c.toFixed(1)}°C` : '—'
  const humVal    = rawTel?.humidity_percent != null ? `${rawTel.humidity_percent.toFixed(0)}%` : '—'
  const motionVal = rawTel == null ? '—' : rawTel.motion_detected ? 'Detected' : 'Clear'
  const flameVal  = rawTel == null ? '—' : rawTel.flame_detected  ? 'Detected' : 'Clear'
  const gasVal    = rawTel == null ? '—' : rawTel.gas_detected    ? 'Detected' : 'Clear'

  const tempStatus   = rawTel?.temperature_c == null ? 'neutral' : rawTel.temperature_c > 40 ? 'alert' : rawTel.temperature_c > 30 ? 'warn' : 'ok'
  const motionStatus = rawTel == null ? 'neutral' : rawTel.motion_detected ? 'warn'  : 'ok'
  const flameStatus  = rawTel == null ? 'neutral' : rawTel.flame_detected  ? 'alert' : 'ok'
  const gasStatus    = rawTel == null ? 'neutral' : rawTel.gas_detected    ? 'alert' : 'ok'

  // Risk score derived from critical events + pending overrides
  const riskScore = summary === null ? null : Math.min(100, critCount * 20 + pendCount * 10)
  const riskLabel = riskScore === null ? '—' : riskScore === 0 ? 'Low' : riskScore < 40 ? 'Moderate' : riskScore < 70 ? 'High' : 'Critical'
  const riskColor = riskScore === null ? 'neutral' : riskScore === 0 ? 'ok' : riskScore < 40 ? 'warn' : 'alert'

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

      {!loading && !error && summary !== null && (
        <div className={`sec-banner sec-banner--${secColor}`}>
          <span className="sec-banner-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </span>
          <div className="sec-banner-body">
            <span className="sec-banner-title">{secStatus}</span>
            <span className="sec-banner-desc">{secDesc}</span>
          </div>
          <span className="sec-banner-tag">Security Status</span>
        </div>
      )}

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

      <div className="dashboard-mid">
        <div className="dash-panel">
          <div className="dash-panel-hdr">
            <span className="dash-panel-title">Environmental Snapshot</span>
            {rawTel?.room_id && <span className="dash-panel-badge">{rawTel.room_id}</span>}
          </div>
          <div className="sensor-tile-grid">
            <div className={`sensor-tile sensor-tile--${tempStatus}`}>
              <span className="sensor-tile-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
                </svg>
              </span>
              <span className="sensor-tile-value">{tempVal}</span>
              <span className="sensor-tile-label">Temperature</span>
            </div>
            <div className="sensor-tile sensor-tile--neutral">
              <span className="sensor-tile-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                </svg>
              </span>
              <span className="sensor-tile-value">{humVal}</span>
              <span className="sensor-tile-label">Humidity</span>
            </div>
            <div className={`sensor-tile sensor-tile--${motionStatus}`}>
              <span className="sensor-tile-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3l14 9-14 9V3z"/>
                </svg>
              </span>
              <span className="sensor-tile-value">{motionVal}</span>
              <span className="sensor-tile-label">Motion</span>
            </div>
            <div className={`sensor-tile sensor-tile--${flameStatus}`}>
              <span className="sensor-tile-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                </svg>
              </span>
              <span className="sensor-tile-value">{flameVal}</span>
              <span className="sensor-tile-label">Flame</span>
            </div>
            <div className={`sensor-tile sensor-tile--${gasStatus}`}>
              <span className="sensor-tile-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 12h8M12 8v8"/>
                </svg>
              </span>
              <span className="sensor-tile-value">{gasVal}</span>
              <span className="sensor-tile-label">Gas</span>
            </div>
          </div>
        </div>

        <div className="dash-side-stack">
          <div className="dash-panel">
            <div className="dash-panel-hdr">
              <span className="dash-panel-title">Device Connectivity</span>
            </div>
            <span className={`dash-big-value${devCount > 0 && summary !== null ? ' dash-big-value--ok' : ''}`}>
              {activeDevices}
            </span>
            <span className="dash-panel-sub">{healthDesc}</span>
            <div className="connectivity-status-row">
              <span className={`connectivity-dot connectivity-dot--${devCount > 0 && summary !== null ? 'ok' : 'neutral'}`} />
              <span className="connectivity-status-text">
                {summary === null ? 'Awaiting data' : devCount > 0 ? 'Devices reachable' : 'No devices online'}
              </span>
            </div>
          </div>

          <div className="dash-panel">
            <div className="dash-panel-hdr">
              <span className="dash-panel-title">Risk Assessment</span>
            </div>
            <span className={`risk-value risk-value--${riskColor}`}>{riskLabel}</span>
            {riskScore !== null && (
              <div className="risk-bar-track">
                <div
                  className={`risk-bar-fill risk-bar-fill--${riskColor}`}
                  style={{ width: `${riskScore}%` }}
                />
              </div>
            )}
            <span className="dash-panel-sub">
              {riskScore === null ? 'Awaiting data' : `${critCount} critical · ${pendCount} pending`}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-row2">
        <div className="info-panel info-panel--accented">
          <span className="info-panel-label">System Health</span>
          <span className={`info-panel-value info-panel-value--${devCount > 0 && summary !== null ? 'ok' : 'neutral'}`}>
            {healthStatus}
          </span>
          <span className="info-panel-desc">{healthDesc}</span>
        </div>
        <div className="info-panel info-panel--accented">
          <span className="info-panel-label">Security Overview</span>
          <span className={`info-panel-value info-panel-value--${summary !== null ? secColor : 'neutral'}`}>
            {secStatus}
          </span>
          <span className="info-panel-desc">{secDesc}</span>
        </div>
        <div className="info-panel info-panel--accented">
          <span className="info-panel-label">Recent Activity</span>
          <span className="info-panel-value info-panel-value--neutral">{actValue}</span>
          <span className="info-panel-desc">{actDesc}</span>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
