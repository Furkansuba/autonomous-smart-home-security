import { useState, useEffect, useCallback } from 'react'
import { getDevices, refreshDeviceStatuses, getDeviceComponents } from '../services/deviceService.js'
import { formatDateTime } from '../utils/formatters.js'
import { exportRowsToCsv } from '../utils/csvExport.js'
import { useEventStream } from '../hooks/useEventStream.js'
import Badge from '../components/ui/Badge.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'
import LiveIndicator from '../components/ui/LiveIndicator.jsx'

const MAIN_CONTROLLER_ID = 'esp32_home_01'
const COMPONENT_REFRESH_EVENTS = new Set(['telemetry', 'event', 'access', 'override_result', 'device_status'])

// Device-reported / last-commanded controller state (arm mode + door lock).
// Not independently sensor-verified; only meaningful for the main controller.
function controllerStateLabel(d) {
  const arm = d.security_armed === true ? 'Armed' : d.security_armed === false ? 'Disarmed' : 'Unknown'
  const door = d.door_locked === true ? 'Door locked' : d.door_locked === false ? 'Door unlocked' : 'Door unknown'
  return `${arm} · ${door}`
}

function DevicesPage() {
  const [devices,     setDevices]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const [refreshMsg,  setRefreshMsg]  = useState(null)

  const [components,    setComponents]    = useState([])
  const [compLoading,   setCompLoading]   = useState(true)
  const [compError,     setCompError]     = useState(null)

  const loadComponents = useCallback(() => {
    setCompError(null)
    getDeviceComponents(MAIN_CONTROLLER_ID)
      .then((data) => {
        setComponents(Array.isArray(data?.components) ? data.components : [])
        setCompLoading(false)
      })
      .catch((err) => {
        setComponents([])
        setCompError(err.message || 'Failed to load components.')
        setCompLoading(false)
      })
  }, [])

  useEffect(() => { loadComponents() }, [loadComponents])

  // Real-time: refresh the attached-component view when relevant activity streams in.
  const liveConnected = useEventStream((type) => {
    if (COMPONENT_REFRESH_EVENTS.has(type)) loadComponents()
  })

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

  const totalCount    = devices.length
  const onlineCount   = devices.filter(d => d.status === 'online').length
  const offlineCount  = devices.filter(d => d.status === 'offline').length
  const degradedCount = devices.filter(d => d.status === 'degraded').length
  const activeCount   = devices.filter(d => d.is_active).length

  const firmwareVersions = [...new Set(devices.map(d => d.firmware_version).filter(Boolean))]

  const latestHeartbeat = devices.reduce((latest, d) => {
    if (!d.last_heartbeat_at) return latest
    return !latest || d.last_heartbeat_at > latest ? d.last_heartbeat_at : latest
  }, null)

  const hasData = !loading && !error && devices.length > 0

  // Arm/door state is device-reported and only meaningful for the main controller.
  const armForExport  = (d) => d.device_id !== 'esp32_home_01' ? '' : d.security_armed === true ? 'Armed' : d.security_armed === false ? 'Disarmed' : ''
  const doorForExport = (d) => d.device_id !== 'esp32_home_01' ? '' : d.door_locked === true ? 'Locked' : d.door_locked === false ? 'Unlocked' : ''

  function handleExportCsv() {
    exportRowsToCsv('devices', [
      { header: 'Device ID',      value: (d) => d.device_id },
      { header: 'Name',           value: (d) => d.name },
      { header: 'Status',         value: (d) => d.status },
      { header: 'Security (reported)', value: armForExport },
      { header: 'Door (reported)',     value: doorForExport },
      { header: 'Firmware',       value: (d) => d.firmware_version },
      { header: 'Last Heartbeat', value: (d) => formatDateTime(d.last_heartbeat_at) },
      { header: 'Active',         value: (d) => (d.is_active ? 'Yes' : 'No') },
    ], devices)
  }

  return (
    <div className="devices-page">

      <div className="devices-page-hdr">
        <div className="devices-page-hdr-body">
          <h1 className="devices-page-title">Device Fleet</h1>
          <p className="devices-page-subtitle">Connected controllers and their operational status</p>
        </div>
      </div>

      {hasData && (
        <div className="devices-fleet-grid">
          <div className="devices-fleet-card">
            <div className="devices-fleet-card-label">Total Devices</div>
            <div className="devices-fleet-card-value">{totalCount}</div>
            <div className="devices-fleet-card-desc">Registered controllers</div>
          </div>
          <div className="devices-fleet-card devices-fleet-card--online">
            <div className="devices-fleet-card-label">Online</div>
            <div className="devices-fleet-card-value devices-fleet-val--online">{onlineCount}</div>
            <div className="devices-fleet-card-desc">Reporting heartbeat</div>
          </div>
          <div className="devices-fleet-card devices-fleet-card--offline">
            <div className="devices-fleet-card-label">Offline</div>
            <div className="devices-fleet-card-value devices-fleet-val--offline">{offlineCount}</div>
            <div className="devices-fleet-card-desc">No heartbeat detected</div>
          </div>
          <div className="devices-fleet-card">
            <div className="devices-fleet-card-label">Active</div>
            <div className="devices-fleet-card-value">{activeCount}</div>
            <div className="devices-fleet-card-desc">Enabled for operations</div>
          </div>
        </div>
      )}

      {hasData && (
        <div className="devices-health-panel">
          <div className="devices-health-hdr">
            <span className="devices-health-label">Controller Health Overview</span>
          </div>
          <div className="devices-health-body">
            <div className="devices-health-field">
              <div className="devices-health-field-label">Status Distribution</div>
              <div className="devices-health-status-row">
                <span className="devices-health-dot devices-health-dot--online" />
                <span className="devices-health-status-text">{onlineCount} online</span>
                {degradedCount > 0 && (
                  <>
                    <span className="devices-health-dot devices-health-dot--degraded" />
                    <span className="devices-health-status-text">{degradedCount} degraded</span>
                  </>
                )}
                <span className="devices-health-dot devices-health-dot--offline" />
                <span className="devices-health-status-text">{offlineCount} offline</span>
              </div>
            </div>
            <div className="devices-health-divider" />
            <div className="devices-health-field">
              <div className="devices-health-field-label">Last Heartbeat</div>
              <div className="devices-health-field-value devices-health-field-value--mono">
                {latestHeartbeat ? formatDateTime(latestHeartbeat) : '—'}
              </div>
            </div>
            <div className="devices-health-divider" />
            <div className="devices-health-field">
              <div className="devices-health-field-label">Firmware</div>
              <div className="devices-health-field-value">
                {firmwareVersions.length > 0 ? firmwareVersions.join(', ') : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="devices-ops-toolbar">
        <div className="devices-ops-toolbar-body">
          <span className="devices-ops-toolbar-label">Operations</span>
          <span className="devices-ops-toolbar-hint">Poll the backend to recalculate heartbeat status for all registered devices</span>
        </div>
        <div className="devices-ops-toolbar-actions">
          <button
            type="button"
            className="btn-export-csv"
            onClick={handleExportCsv}
            disabled={loading || !!error || devices.length === 0}
          >
            Export CSV
          </button>
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
          columns={['Device ID', 'Name', 'Status', 'Security · Door (reported)', 'Firmware', 'Last Heartbeat', 'Active']}
        >
          {devices.map((d) => (
            <tr key={d.device_id}>
              <td className="devices-col-id">{d.device_id}</td>
              <td>{d.name ?? '—'}</td>
              <td><Badge baseClass="device-status-badge" variant={d.status ?? 'offline'}>{d.status ?? 'offline'}</Badge></td>
              <td title="Device-reported / last-commanded state — not independently sensor-verified">
                {d.device_id === 'esp32_home_01' ? controllerStateLabel(d) : '—'}
              </td>
              <td>{d.firmware_version ?? '—'}</td>
              <td className="devices-col-ts">{formatDateTime(d.last_heartbeat_at)}</td>
              <td>{d.is_active ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </DataTable>
      )}

      {/* Attached components — derived, read-only view of modules on the controller.
          These are NOT separate devices and do not affect device counts. */}
      <div className="devices-components-hdr">
        <span className="devices-ops-toolbar-label">Attached Components — {MAIN_CONTROLLER_ID}</span>
        <LiveIndicator connected={liveConnected} />
      </div>
      <p className="devices-components-hint">
        Sensors, actuators, and buses attached to the controller. Status is derived from recent
        telemetry / events / access / override records — these are not independent devices and do
        not affect the device counts above.
      </p>

      {compLoading && <StateMessage className="devices-loading">Loading components…</StateMessage>}
      {!compLoading && compError && (
        <StateMessage className="devices-error">{compError}</StateMessage>
      )}
      {!compLoading && !compError && components.length === 0 && (
        <StateMessage className="devices-empty">No components derived yet.</StateMessage>
      )}
      {!compLoading && !compError && components.length > 0 && (
        <DataTable
          wrapClassName="devices-table-wrap"
          tableClassName="devices-table"
          columns={['Component', 'Category', 'Status', 'Latest Value', 'Last Seen', 'Notes']}
        >
          {components.map((c) => (
            <tr key={c.component_id}>
              <td>
                <div>{c.label}</div>
                <div className="devices-col-id">{c.component_id}</div>
              </td>
              <td>{c.category}</td>
              <td><Badge baseClass="component-status-badge" variant={c.status}>{c.status.replace(/_/g, ' ')}</Badge></td>
              <td>{c.latest_value ?? '—'}</td>
              <td className="devices-col-ts">{c.last_seen_at ? formatDateTime(c.last_seen_at) : '—'}</td>
              <td className="overrides-col-reason" title={c.notes ?? ''}>{c.notes ?? '—'}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  )
}

export default DevicesPage
