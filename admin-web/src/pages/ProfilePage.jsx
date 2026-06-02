import * as authService from '../services/authService.js'

function ProfilePage() {
  const user = authService.getStoredUser()
  const initial = (user?.email?.[0] ?? 'A').toUpperCase()
  const role = user?.role ?? null

  return (
    <div className="profile-page">
      <div className="profile-page-hdr">
        <h2 className="profile-page-title">Account Identity</h2>
        <p className="profile-page-subtitle">Authenticated administrator profile and session credentials</p>
      </div>

      <div className="profile-card">
        <div className="profile-card-top">
          <div className="profile-avatar-lg">{initial}</div>
          <div className="profile-card-top-body">
            <span className="profile-display-email">{user?.email ?? 'Unknown'}</span>
            {role && (
              <span className="profile-role-badge">{role.toUpperCase()}</span>
            )}
          </div>
        </div>

        <div className="profile-fields profile-fields--grid">
          <div className="profile-field">
            <span className="profile-field-label">Email</span>
            <span className="profile-field-value">{user?.email ?? '—'}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">Role</span>
            <span className="profile-field-value">{user?.role ?? '—'}</span>
          </div>
          <div className="profile-field profile-field--full">
            <span className="profile-field-label">User ID</span>
            <span className="profile-field-value profile-field-value--mono">{user?.user_id ?? '—'}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">Account Status</span>
            <span className="profile-status-badge profile-status-badge--active">Active</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
