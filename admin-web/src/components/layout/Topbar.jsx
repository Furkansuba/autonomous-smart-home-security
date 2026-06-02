import AvatarMenu from './AvatarMenu.jsx'
import ThemeToggle from './ThemeToggle.jsx'

export default function Topbar({ title, user, theme, onToggleTheme, onNavigateProfile, onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">{title}</span>
        <span className="topbar-session-tag">Secure Session</span>
      </div>
      <div className="topbar-right">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <AvatarMenu user={user} onNavigateProfile={onNavigateProfile} onLogout={onLogout} />
      </div>
    </header>
  )
}
