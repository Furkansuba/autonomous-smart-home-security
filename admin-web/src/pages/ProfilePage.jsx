import * as authService from '../services/authService.js'

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

export default ProfilePage
