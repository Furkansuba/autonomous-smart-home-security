import AvatarMenu from './AvatarMenu.jsx'
import ThemeToggle from './ThemeToggle.jsx'

export default function Topbar({ title, user, theme, onToggleTheme, onNavigateProfile, onLogout }) {
  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-right">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <AvatarMenu user={user} onNavigateProfile={onNavigateProfile} onLogout={onLogout} />
      </div>
    </header>
  )
}
