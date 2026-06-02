import AvatarMenu from './AvatarMenu.jsx'

export default function Topbar({ title, user, onNavigateProfile, onLogout }) {
  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-right">
        <AvatarMenu user={user} onNavigateProfile={onNavigateProfile} onLogout={onLogout} />
      </div>
    </header>
  )
}
