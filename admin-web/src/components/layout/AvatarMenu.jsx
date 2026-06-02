import { useState, useEffect, useRef } from 'react'

export default function AvatarMenu({ user, onNavigateProfile, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const userLabel = user?.email ?? 'Admin'

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
          <div className="avatar-dropdown-email">{userLabel}</div>
          <button className="avatar-dropdown-item" onClick={() => { setOpen(false); onNavigateProfile() }}>
            Profile
          </button>
          <button className="avatar-dropdown-item avatar-dropdown-item--danger" onClick={() => { setOpen(false); onLogout() }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
