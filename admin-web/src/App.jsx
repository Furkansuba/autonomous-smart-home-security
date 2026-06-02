import { useState } from 'react'
import './App.css'

const NAV_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard'   },
  { key: 'devices',     label: 'Devices'     },
  { key: 'events',      label: 'Events'      },
  { key: 'access-logs', label: 'Access Logs' },
  { key: 'telemetry',   label: 'Telemetry'   },
  { key: 'overrides',   label: 'Overrides'   },
]

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

function PagePlaceholder({ page }) {
  const label = NAV_ITEMS.find((i) => i.key === page)?.label ?? page
  return (
    <div className="page-placeholder">
      <h2>{label}</h2>
      <p className="placeholder-note">This section is under construction.</p>
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  return (
    <div className="app-shell">
      <Sidebar active={activePage} onNavigate={setActivePage} />
      <div className="main-wrapper">
        <header className="topbar">
          <span className="topbar-title">
            {NAV_ITEMS.find((i) => i.key === activePage)?.label}
          </span>
          <span className="topbar-badge">Admin</span>
        </header>
        <main className="main-content">
          <PagePlaceholder page={activePage} />
        </main>
      </div>
    </div>
  )
}

export default App
