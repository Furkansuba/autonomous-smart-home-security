import { useState, useEffect, useCallback } from 'react'
import { getUsers, promoteToAdmin } from '../services/userService.js'
import { formatDateTime } from '../utils/formatters.js'
import Badge from '../components/ui/Badge.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'

function UsersPage() {
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [promotingId, setPromotingId] = useState(null)
  const [promoteMsg,  setPromoteMsg]  = useState(null)

  const loadUsers = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getUsers()
      .then((data) => {
        if (!cancelled) {
          setUsers(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load users.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => loadUsers(), [loadUsers])

  async function handlePromote(userId) {
    setPromotingId(userId)
    setPromoteMsg(null)
    try {
      await promoteToAdmin(userId)
      setPromoteMsg({ ok: true, text: 'User promoted to admin.' })
      loadUsers()
    } catch (err) {
      setPromoteMsg({ ok: false, text: err.message || 'Promotion failed.' })
    } finally {
      setPromotingId(null)
    }
  }

  const adminCount    = users.filter(u => u.role === 'admin').length
  const residentCount = users.filter(u => u.role === 'resident').length
  const statsReady    = !loading && !error

  return (
    <div className="users-page">

      <div className="ops-header">
        <div className="ops-header-body">
          <h2 className="ops-header-title">User Management</h2>
          <p className="ops-header-subtitle">View registered accounts and promote residents to admin</p>
        </div>
        {statsReady && (
          <div className="ops-stats-row">
            <div className="ops-stat">
              <span className="ops-stat-value">{users.length}</span>
              <span className="ops-stat-label">Total</span>
            </div>
            <div className="ops-stat-divider" />
            <div className="ops-stat">
              <span className="ops-stat-value ops-stat-value--green">{adminCount}</span>
              <span className="ops-stat-label">Admins</span>
            </div>
            <div className="ops-stat-divider" />
            <div className="ops-stat">
              <span className="ops-stat-value ops-stat-value--blue">{residentCount}</span>
              <span className="ops-stat-label">Residents</span>
            </div>
          </div>
        )}
      </div>

      {promoteMsg && (
        <p className={`users-promote-msg${promoteMsg.ok ? ' users-promote-msg--ok' : ' users-promote-msg--err'}`}>
          {promoteMsg.text}
        </p>
      )}

      {loading && <StateMessage className="users-loading">Loading users…</StateMessage>}

      {!loading && error && (
        <StateMessage className="users-error">{error}</StateMessage>
      )}

      {!loading && !error && users.length === 0 && (
        <StateMessage className="users-empty">No users found.</StateMessage>
      )}

      {!loading && !error && users.length > 0 && (
        <DataTable
          wrapClassName="users-table-wrap"
          tableClassName="users-table"
          columns={['Full Name', 'Email', 'Role', 'Status', 'Member Since', 'Action']}
        >
          {users.map((u) => (
            <tr key={u.user_id}>
              <td className="users-col-name">{u.full_name ?? '—'}</td>
              <td className="users-col-email">{u.email ?? '—'}</td>
              <td>
                <Badge baseClass="user-role-badge" variant={u.role ?? 'resident'}>
                  {(u.role ?? 'resident').charAt(0).toUpperCase() + (u.role ?? 'resident').slice(1)}
                </Badge>
              </td>
              <td>
                {u.is_active
                  ? <span className="user-active-badge user-active-badge--active">Active</span>
                  : <span className="user-active-badge user-active-badge--inactive">Inactive</span>
                }
              </td>
              <td className="users-col-ts">{u.createdAt ? formatDateTime(u.createdAt) : '—'}</td>
              <td>
                {u.role === 'resident' ? (
                  <button
                    className="btn-promote"
                    onClick={() => handlePromote(u.user_id)}
                    disabled={promotingId !== null}
                  >
                    {promotingId === u.user_id ? 'Promoting…' : 'Promote to Admin'}
                  </button>
                ) : (
                  <span className="users-action-none">—</span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

    </div>
  )
}

export default UsersPage
