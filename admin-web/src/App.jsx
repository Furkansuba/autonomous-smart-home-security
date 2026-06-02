import { useState } from 'react'
import './App.css'
import LoginPage from './components/LoginPage.jsx'
import * as authService from './services/authService.js'

const NAV_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard'   },
  { key: 'devices',     label: 'Devices'     },
  { key: 'events',      label: 'Events'      },
  { key: 'access-logs', label: 'Access Logs' },
  { key: 'telemetry',   label: 'Telemetry'   },
  { key: 'overrides',   label: 'Overrides'   },
]

const KPI_CARDS = [
  { label: 'Active Devices',    value: '—', desc: 'Connected to system',   accent: false },
  { label: 'Critical Events',   value: '—', desc: 'Last 24 hours',         accent: true  },
  { label: 'Pending Overrides', value: '—', desc: 'Awaiting resolution',   accent: false },
  { label: 'Latest Telemetry',  value: '—', desc: 'Most recent reading',   accent: false },
]

const SECTION_META = {
  devices: {
    heading: 'Devices',
    description: 'Connected ESP32 devices, their online / degraded / offline status, firmware version, and last heartbeat will appear here.',
  },
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

function DashboardPage() {
  return (
    <div className="dashboard-page">
      <div className="kpi-grid">
        {KPI_CARDS.map((card) => (
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
