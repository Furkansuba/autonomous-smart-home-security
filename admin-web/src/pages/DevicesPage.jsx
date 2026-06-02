import { useState, useEffect, useCallback } from 'react'
import { getDevices, refreshDeviceStatuses } from '../services/deviceService.js'
import { formatDateTime } from '../utils/formatters.js'
import Badge from '../components/ui/Badge.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'

function DevicesPage() {
  const [devices,     setDevices]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const [refreshMsg,  setRefreshMsg]  = useState(null)

  const loadDevices = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getDevices()
      .then((data) => {
        if (!cancelled) {
          setDevices(Array.isArray(data) ? data : (data?.devices ?? []))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load devices.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(loadDevices, [loadDevices])

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      await refreshDeviceStatuses()
      setRefreshMsg({ ok: true, text: 'Statuses refreshed.' })
      loadDevices()
    } catch (err) {
      setRefreshMsg({ ok: false, text: err.message || 'Refresh failed.' })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="devices-page">
      <div className="devices-toolbar">
        <button
          className="btn-refresh"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          {refreshing ? 'Refreshing…' : 'Refresh Status'}
        </button>
        {refreshMsg && (
          <span className={`refresh-msg${refreshMsg.ok ? ' refresh-msg--ok' : ' refresh-msg--err'}`}>
            {refreshMsg.text}
          </span>
        )}
      </div>

      {loading && <StateMessage className="devices-loading">Loading devices…</StateMessage>}

      {!loading && error && (
        <StateMessage className="devices-error">{error}</StateMessage>
      )}

      {!loading && !error && devices.length === 0 && (
        <StateMessage className="devices-empty">No devices found.</StateMessage>
      )}

      {!loading && !error && devices.length > 0 && (
        <DataTable
          wrapClassName="devices-table-wrap"
          tableClassName="devices-table"
          columns={['Device ID', 'Name', 'Status', 'Firmware', 'Last Heartbeat', 'Active']}
        >
          {devices.map((d) => (
            <tr key={d.device_id}>
              <td className="devices-col-id">{d.device_id}</td>
              <td>{d.name ?? '—'}</td>
              <td><Badge baseClass="device-status-badge" variant={d.status ?? 'offline'}>{d.status ?? 'offline'}</Badge></td>
              <td>{d.firmware_version ?? '—'}</td>
              <td className="devices-col-ts">{formatDateTime(d.last_heartbeat_at)}</td>
              <td>{d.is_active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  )
}

export default DevicesPage
