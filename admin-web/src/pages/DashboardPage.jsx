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

export default DashboardPage
