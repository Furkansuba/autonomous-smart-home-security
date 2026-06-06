import { useState } from 'react'
import './App.css'
import LoginPage from './components/LoginPage.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import Topbar from './components/layout/Topbar.jsx'
import * as authService from './services/authService.js'
import DashboardPage from './pages/DashboardPage.jsx'
import DevicesPage from './pages/DevicesPage.jsx'
import EventsPage from './pages/EventsPage.jsx'
import AccessLogsPage from './pages/AccessLogsPage.jsx'
import TelemetryPage from './pages/TelemetryPage.jsx'
import OverridesPage from './pages/OverridesPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import NotificationLogsPage from './pages/NotificationLogsPage.jsx'
import UsersPage from './pages/UsersPage.jsx'

const ADMIN_ONLY_PAGES = new Set(['overrides', 'notification-logs', 'users'])

const NAV_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard'   },
  { key: 'devices',     label: 'Devices'     },
  { key: 'events',      label: 'Events'      },
  { key: 'access-logs', label: 'Access Logs' },
  { key: 'telemetry',   label: 'Telemetry'   },
  { key: 'overrides',          label: 'Overrides'   },
  { key: 'notification-logs', label: 'Notif. Logs' },
  { key: 'users',             label: 'Users'        },
]

const SECTION_META = {}

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
  if (page === 'dashboard')   return <DashboardPage />
  if (page === 'devices')     return <DevicesPage />
  if (page === 'events')      return <EventsPage />
  if (page === 'access-logs') return <AccessLogsPage />
  if (page === 'telemetry')   return <TelemetryPage />
  if (page === 'overrides')          return <OverridesPage />
  if (page === 'notification-logs') return <NotificationLogsPage />
  if (page === 'users')             return <UsersPage />
  if (page === 'profile')           return <ProfilePage />
  return <SectionPlaceholder page={page} />
}

function App() {
  const [authed, setAuthed]         = useState(() => authService.isAuthenticated())
  const [activePage, setActivePage] = useState('dashboard')
  const [theme, setTheme]           = useState(() => localStorage.getItem('admin-theme') ?? 'light')

  function handleLoginSuccess() {
    setAuthed(true)
  }

  function handleLogout() {
    authService.logout()
    setAuthed(false)
  }

  function handleToggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('admin-theme', next)
  }

  if (!authed) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  const user = authService.getStoredUser()
  const effectivePage = (ADMIN_ONLY_PAGES.has(activePage) && user?.role !== 'admin')
    ? 'dashboard'
    : activePage
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !ADMIN_ONLY_PAGES.has(item.key) || user?.role === 'admin'
  )
  const pageTitle = NAV_ITEMS.find((i) => i.key === effectivePage)?.label ?? (effectivePage === 'profile' ? 'Profile' : '')

  return (
    <div className={`app-shell theme-${theme}`}>
      <Sidebar navItems={visibleNavItems} activePage={effectivePage} onNavigate={setActivePage} />
      <div className="main-wrapper">
        <Topbar
          title={pageTitle}
          user={user}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onNavigateProfile={() => setActivePage('profile')}
          onLogout={handleLogout}
        />
        <main className="main-content">
          <PageContent page={effectivePage} />
        </main>
      </div>
    </div>
  )
}

export default App
