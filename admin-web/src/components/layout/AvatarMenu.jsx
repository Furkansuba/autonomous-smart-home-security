import { useState, useEffect, useRef } from 'react'

export default function AvatarMenu({ user, onNavigateProfile, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const userLabel = user?.email ?? 'Admin'
  const role = user?.role ?? null

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const initial = (userLabel[0] ?? 'A').toUpperCase()

  return (
    <div className="avatar-menu" ref={ref}>
      <button className="avatar-btn" onClick={() => setOpen((v) => !v)} aria-label="User menu">
        {initial}
      </button>
      {open && (
        <div className="avatar-dropdown">
          <div className="avatar-dropdown-header">
            <span className="avatar-dropdown-email">{userLabel}</span>
            {role && <span className="avatar-dropdown-role">{role.toUpperCase()}</span>}
          </div>
          <div className="avatar-dropdown-body">
            <button className="avatar-dropdown-item" onClick={() => { setOpen(false); onNavigateProfile() }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              Profile
            </button>
            <div className="avatar-dropdown-divider" />
            <button className="avatar-dropdown-item avatar-dropdown-item--danger" onClick={() => { setOpen(false); onLogout() }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
