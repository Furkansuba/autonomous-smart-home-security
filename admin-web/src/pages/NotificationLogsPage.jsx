import { useState, useEffect } from 'react'
import { getNotificationLogs } from '../services/notificationLogService.js'
import { formatDateTime } from '../utils/formatters.js'
import Badge from '../components/ui/Badge.jsx'
import FilterBar from '../components/ui/FilterBar.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'

const CHANNEL_FILTERS = ['all', 'fcm', 'sms', 'in_app']
const STATUS_FILTERS  = ['all', 'sent', 'failed', 'skipped', 'queued']

function NotificationLogsPage() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [channel, setChannel] = useState('all')
  const [status,  setStatus]  = useState('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = {}
    if (channel !== 'all') params.channel = channel
    if (status  !== 'all') params.status  = status
    getNotificationLogs(params)
      .then((data) => {
        if (!cancelled) {
          setLogs(Array.isArray(data) ? data : (data?.notification_logs ?? []))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load notification logs.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [channel, status])

  const total       = logs.length
  const sentCount   = logs.filter(l => l.status === 'sent').length
  const failedCount = logs.filter(l => l.status === 'failed').length

  return (
    <div className="access-logs-page">

      <div className="access-page-hdr">
        <div className="access-page-hdr-body">
          <h1 className="access-page-title">Notification Logs</h1>
          <p className="access-page-subtitle">FCM and SMS dispatch records for alerts and offline events</p>
        </div>
      </div>

      {!loading && !error && (
        <div className="access-summary-grid">
          <div className="access-summary-card">
            <div className="access-summary-card-label">Total</div>
            <div className="access-summary-card-value">{total}</div>
            <div className="access-summary-card-desc">Current view</div>
          </div>
          <div className="access-summary-card access-summary-card--granted">
            <div className="access-summary-card-label">Sent</div>
            <div className="access-summary-card-value access-summary-val--granted">{sentCount}</div>
            <div className="access-summary-card-desc">Delivered</div>
          </div>
          <div className="access-summary-card access-summary-card--denied">
            <div className="access-summary-card-label">Failed</div>
            <div className="access-summary-card-value access-summary-val--denied">{failedCount}</div>
            <div className="access-summary-card-desc">Not delivered</div>
          </div>
          <div className="access-summary-card">
            <div className="access-summary-card-label">Skipped</div>
            <div className="access-summary-card-value">{total - sentCount - failedCount}</div>
            <div className="access-summary-card-desc">No token / disabled</div>
          </div>
        </div>
      )}

      <div className="access-logs-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <FilterBar options={CHANNEL_FILTERS} activeValue={channel} onChange={setChannel} />
        <FilterBar options={STATUS_FILTERS}  activeValue={status}  onChange={setStatus}  />
      </div>

      {loading && <StateMessage className="access-logs-loading">Loading notification logs…</StateMessage>}

      {!loading && error && (
        <StateMessage className="access-logs-error">{error}</StateMessage>
      )}

      {!loading && !error && logs.length === 0 && (
        <StateMessage className="access-logs-empty">No notification logs found.</StateMessage>
      )}

      {!loading && !error && logs.length > 0 && (
        <DataTable
          wrapClassName="access-logs-table-wrap"
          tableClassName="access-logs-table"
          columns={['Notification ID', 'Device', 'Recipient', 'Channel', 'Status', 'Title', 'Sent At']}
        >
          {logs.map((l) => (
            <tr key={l.notification_id ?? l._id}>
              <td className="access-logs-col-id">{l.notification_id ?? '—'}</td>
              <td>{l.device_id ?? '—'}</td>
              <td>{l.recipient_user_id ?? '—'}</td>
              <td><Badge baseClass="result-badge" variant={l.channel ?? 'unknown'}>{l.channel ?? '—'}</Badge></td>
              <td><Badge baseClass="override-status-badge" variant={l.status ?? 'unknown'}>{l.status ?? '—'}</Badge></td>
              <td>{l.title ?? '—'}</td>
              <td className="access-logs-col-ts">{l.sent_at ? formatDateTime(l.sent_at) : '—'}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  )
}

export default NotificationLogsPage
