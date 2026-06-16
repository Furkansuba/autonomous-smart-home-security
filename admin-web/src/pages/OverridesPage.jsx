import { useState, useEffect, useCallback } from 'react'
import { getOverrides, createOverride } from '../services/overrideService.js'
import { formatDateTime } from '../utils/formatters.js'
import * as authService from '../services/authService.js'
import Badge from '../components/ui/Badge.jsx'
import FilterBar from '../components/ui/FilterBar.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'

const OVERRIDE_STATUS_FILTERS = ['all', 'requested', 'executed', 'failed', 'blocked']

const QUICK_ACTIONS = [
  { label: 'Silence Alarm', actuator: 'buzzer_01', action: 'buzzer_off'  },
  { label: 'Test Buzzer',   actuator: 'buzzer_01', action: 'buzzer_on'   },
  { label: 'Stop Pump',     actuator: 'pump_01',   action: 'pump_off'    },
]

function OverridesPage() {
  const storedUser = authService.getStoredUser()
  const isAdmin = storedUser?.role === 'admin'

  const [overrides,    setOverrides]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const [formDevice,   setFormDevice]   = useState('esp32_home_01')
  const [formActuator, setFormActuator] = useState('buzzer_01')
  const [formAction,   setFormAction]   = useState('buzzer_off')
  const [formReason,   setFormReason]   = useState('Manual admin web override.')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitMsg,    setSubmitMsg]    = useState(null)

  const [mrReason,     setMrReason]     = useState('')
  const [mrSubmitting, setMrSubmitting] = useState(false)
  const [mrMsg,        setMrMsg]        = useState(null)

  const [armSubmitting, setArmSubmitting] = useState(false)
  const [armMsg,        setArmMsg]        = useState(null)

  const loadOverrides = useCallback((status) => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = {}
    if (status !== 'all') params.status = status
    getOverrides(params)
      .then((data) => {
        if (!cancelled) {
          setOverrides(Array.isArray(data?.overrides) ? data.overrides : [])
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load overrides.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => loadOverrides(statusFilter), [loadOverrides, statusFilter])

  function handleFilterChange(f) {
    setStatusFilter(f)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMsg(null)
    const storedUser = authService.getStoredUser()
    const requestedBy = storedUser?.user_id ?? 'usr_admin_001'
    try {
      const res = await createOverride({
        device_id:    formDevice.trim(),
        actuator_id:  formActuator.trim(),
        action:       formAction,
        reason:       formReason.trim(),
        requested_by: requestedBy,
      })
      const ov = res?.override
      if (ov?.status === 'blocked') {
        setSubmitMsg({ ok: false, text: ov.blocked_reason || 'Command blocked for safety.' })
      } else {
        setSubmitMsg({ ok: true, text: 'Override created successfully.' })
      }
      loadOverrides(statusFilter)
    } catch (err) {
      setSubmitMsg({ ok: false, text: err.message || 'Failed to create override.' })
    } finally {
      setSubmitting(false)
    }
  }

  function applyQuickAction(actuator, action) {
    setFormActuator(actuator)
    setFormAction(action)
  }

  // ARM/DISARM controls security/intrusion monitoring only. It is admin-only and is
  // issued through the existing override pipeline (action arm/disarm). The status is
  // reported honestly: it stays "requested" until the device ACKs over MQTT.
  async function handleArmDisarm(action) {
    const device = formDevice.trim() || 'esp32_home_01'
    const verb = action === 'arm' ? 'ARM' : 'DISARM'
    const ok = window.confirm(
      `${verb} security monitoring for ${device}?\n\n` +
      (action === 'disarm'
        ? 'DISARM suppresses intrusion monitoring only (motion, vibration, reed/window). ' +
          'FIRE, GAS, and CO detection remain fully active and will still alarm.'
        : 'ARM re-enables intrusion monitoring (motion, vibration, reed/window).') +
      '\n\nThis is logged in override history and applied once the device acknowledges.'
    )
    if (!ok) return
    setArmSubmitting(true)
    setArmMsg(null)
    const user = authService.getStoredUser()
    const requestedBy = user?.user_id ?? 'usr_admin_001'
    try {
      const res = await createOverride({
        device_id:    device,
        actuator_id:  device,
        action,
        reason:       action === 'arm' ? 'Arm security via admin web.' : 'Disarm security via admin web.',
        requested_by: requestedBy,
      })
      const ov = res?.override
      if (ov?.status === 'blocked') {
        setArmMsg({ ok: false, text: ov.blocked_reason || 'Command blocked.' })
      } else if (ov?.status === 'failed') {
        setArmMsg({ ok: false, text: `Device rejected: ${ov.blocked_reason || 'unknown reason'}.` })
      } else if (ov?.status === 'executed') {
        setArmMsg({ ok: true, text: `Security ${action === 'arm' ? 'ARMED' : 'DISARMED'} — confirmed by device.` })
      } else {
        setArmMsg({ ok: true, text: `${verb} requested — awaiting device confirmation.` })
      }
      loadOverrides(statusFilter)
    } catch (err) {
      setArmMsg({ ok: false, text: err.message || 'Failed to send command.' })
    } finally {
      setArmSubmitting(false)
    }
  }

  async function handleMaintenanceReset() {
    if (!mrReason.trim()) {
      setMrMsg({ ok: false, text: 'A reason is required to confirm the threat is cleared.' })
      return
    }
    const ok = window.confirm(
      'Confirm Threat Cleared (maintenance reset)\n\n' +
      'Use this ONLY for a verified false alarm or a threat you have confirmed is cleared. ' +
      'It does NOT bypass gas/CO safety, and the device will reject it if flame is still detected.\n\n' +
      'Proceed?'
    )
    if (!ok) return
    setMrSubmitting(true)
    setMrMsg(null)
    const user = authService.getStoredUser()
    const requestedBy = user?.user_id ?? 'usr_admin_001'
    try {
      const res = await createOverride({
        device_id:    formDevice.trim(),
        actuator_id:  'pump_01',
        action:       'maintenance_reset',
        reason:       mrReason.trim(),
        requested_by: requestedBy,
      })
      const ov = res?.override
      if (ov?.status === 'executed') {
        setMrMsg({ ok: true, text: 'Threat cleared confirmed — device released fire suppression.' })
      } else if (ov?.status === 'failed') {
        setMrMsg({ ok: false, text: `Device rejected reset: ${ov.blocked_reason || 'unknown reason'}.` })
      } else if (ov?.status === 'blocked') {
        setMrMsg({ ok: false, text: ov.blocked_reason || 'Maintenance reset was blocked.' })
      } else {
        setMrMsg({ ok: true, text: 'Maintenance reset sent — awaiting device confirmation.' })
      }
      setMrReason('')
      loadOverrides(statusFilter)
    } catch (err) {
      setMrMsg({ ok: false, text: err.message || 'Failed to send maintenance reset.' })
    } finally {
      setMrSubmitting(false)
    }
  }

  const statsReady   = !loading && !error
  const countStatus  = (s) => overrides.filter(o => o.status === s).length
  const statPending  = statsReady ? countStatus('requested') : null
  const statExecuted = statsReady ? countStatus('executed')  : null
  const statFailed   = statsReady ? countStatus('failed') + countStatus('blocked') : null
  const statTotal    = statsReady ? overrides.length : null

  return (
    <div className="overrides-page">

      {/* Operations header */}
      <div className="ops-header">
        <div className="ops-header-body">
          <h2 className="ops-header-title">Override Operations</h2>
          <p className="ops-header-subtitle">Issue and track manual actuator commands for connected devices</p>
        </div>
        <div className="ops-stats-row">
          <div className="ops-stat">
            <span className="ops-stat-value ops-stat-value--blue">{statPending  ?? '—'}</span>
            <span className="ops-stat-label">Pending</span>
          </div>
          <div className="ops-stat-divider" />
          <div className="ops-stat">
            <span className="ops-stat-value ops-stat-value--green">{statExecuted ?? '—'}</span>
            <span className="ops-stat-label">Executed</span>
          </div>
          <div className="ops-stat-divider" />
          <div className="ops-stat">
            <span className="ops-stat-value ops-stat-value--red">{statFailed   ?? '—'}</span>
            <span className="ops-stat-label">Failed / Blocked</span>
          </div>
          <div className="ops-stat-divider" />
          <div className="ops-stat">
            <span className="ops-stat-value">{statTotal    ?? '—'}</span>
            <span className="ops-stat-label">Total Requests</span>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="overrides-toolbar">
        <FilterBar options={OVERRIDE_STATUS_FILTERS} activeValue={statusFilter} onChange={handleFilterChange} />
      </div>

      {loading && <StateMessage className="overrides-loading">Loading overrides…</StateMessage>}

      {!loading && error && (
        <StateMessage className="overrides-error">{error}</StateMessage>
      )}

      {!loading && !error && overrides.length === 0 && (
        <StateMessage className="overrides-empty">No overrides found.</StateMessage>
      )}

      {!loading && !error && overrides.length > 0 && (
        <DataTable
          wrapClassName="overrides-table-wrap"
          tableClassName="overrides-table"
          columns={['Override ID', 'Device', 'Requested By', 'Actuator', 'Action', 'Reason', 'Status', 'Requested At', 'Result At']}
        >
          {overrides.map((o) => (
            <tr key={o.override_id ?? o._id}>
              <td className="overrides-col-id">{o.override_id ?? '—'}</td>
              <td>{o.device_id ?? '—'}</td>
              <td>{o.requested_by ?? '—'}</td>
              <td>{o.actuator_id ?? '—'}</td>
              <td>{o.action ?? '—'}</td>
              <td className="overrides-col-reason" title={o.reason ?? '—'}>{o.reason ?? '—'}</td>
              <td><Badge baseClass="override-status-badge" variant={o.status ?? 'requested'}>{o.status ?? '—'}</Badge></td>
              <td className="overrides-col-ts">{formatDateTime(o.requested_at)}</td>
              <td className="overrides-col-ts">{o.result_at ? formatDateTime(o.result_at) : '—'}</td>
            </tr>
          ))}
        </DataTable>
      )}

      {/* Command panel: admin only */}
      {isAdmin ? (
        <div className="cmd-panel">

          <div className="cmd-quick-section">
            <span className="cmd-section-label">Quick Actions</span>
            <p className="cmd-quick-hint">Select a preset to populate the command form. Safe actions auto-complete in demo mode. Hazard events are not cleared by overrides.</p>
            <div className="cmd-quick-grid">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.action}
                  type="button"
                  className="cmd-quick-btn"
                  onClick={() => applyQuickAction(qa.actuator, qa.action)}
                  disabled={submitting}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cmd-form-card">
            <div className="cmd-form-hdr">
              <span className="cmd-form-title">Issue Command Override</span>
              <span className="cmd-form-badge">Manual Control</span>
            </div>
            <p className="cmd-form-helper">Specify the target device, actuator, action, and a reason for the audit log.</p>
            <form className="cmd-form" onSubmit={handleSubmit}>
              <div className="cmd-form-grid">
                <div className="cmd-form-field">
                  <label className="cmd-form-label">Device ID</label>
                  <input
                    className="override-form-input"
                    type="text"
                    value={formDevice}
                    onChange={(e) => setFormDevice(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
                <div className="cmd-form-field">
                  <label className="cmd-form-label">Actuator ID</label>
                  <input
                    className="override-form-input"
                    type="text"
                    value={formActuator}
                    onChange={(e) => setFormActuator(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
              </div>
              <div className="cmd-form-grid">
                <div className="cmd-form-field">
                  <label className="cmd-form-label">Action</label>
                  <select
                    className="override-form-select"
                    value={formAction}
                    onChange={(e) => setFormAction(e.target.value)}
                    disabled={submitting}
                  >
                    <optgroup label="Safe — auto-acked in demo">
                      <option value="buzzer_off">buzzer_off</option>
                      <option value="buzzer_on">buzzer_on</option>
                      <option value="pump_off">pump_off</option>
                    </optgroup>
                    <optgroup label="Advanced — requires device confirmation">
                      <option value="pump_on">pump_on</option>
                      <option value="door_unlock">door_unlock</option>
                      <option value="system_reset">system_reset</option>
                    </optgroup>
                  </select>
                </div>
                <div className="cmd-form-field">
                  <label className="cmd-form-label">Reason</label>
                  <input
                    className="override-form-input"
                    type="text"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    disabled={submitting}
                    maxLength={240}
                  />
                </div>
              </div>
              {formAction === 'pump_off' && (
                <p className="cmd-form-helper" style={{ color: '#d97706' }}>
                  ⚠ Stop Pump does not confirm a fire has been cleared. If a fire is
                  currently active, this command is blocked for safety and fire
                  suppression keeps running.
                </p>
              )}
              <div className="cmd-form-footer">
                <button
                  className="btn-override-submit"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : 'Submit Override'}
                </button>
                {submitMsg && (
                  <span className={`override-submit-msg${submitMsg.ok ? ' override-submit-msg--ok' : ' override-submit-msg--err'}`}>
                    {submitMsg.text}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Security mode — ARM / DISARM (intrusion monitoring only) */}
          <div className="cmd-form-card" style={{ borderTop: '3px solid #2563eb' }}>
            <div className="cmd-form-hdr">
              <span className="cmd-form-title">Security Mode</span>
              <span className="cmd-form-badge" style={{ background: '#2563eb', color: '#fff' }}>Admin</span>
            </div>
            <p className="cmd-form-helper">
              ARM/DISARM controls <strong>intrusion monitoring only</strong> (motion, vibration,
              reed/window) for <strong>{formDevice.trim() || 'the device'}</strong>. FIRE, GAS, and
              CO detection <strong>always remain active</strong> and are never affected. Disarming
              does not silence an active fire/gas/CO alarm. Applied once the device acknowledges.
            </p>
            <div className="cmd-quick-grid">
              <button
                type="button"
                className="cmd-quick-btn"
                onClick={() => handleArmDisarm('arm')}
                disabled={armSubmitting}
              >
                Arm
              </button>
              <button
                type="button"
                className="cmd-quick-btn"
                onClick={() => handleArmDisarm('disarm')}
                disabled={armSubmitting}
              >
                Disarm
              </button>
            </div>
            {armMsg && (
              <span className={`override-submit-msg${armMsg.ok ? ' override-submit-msg--ok' : ' override-submit-msg--err'}`}>
                {armMsg.text}
              </span>
            )}
          </div>

          {/* Threat recovery — distinct, not a quick action */}
          <div className="cmd-form-card" style={{ borderTop: '3px solid #dc2626' }}>
            <div className="cmd-form-hdr">
              <span className="cmd-form-title">Confirm Threat Cleared</span>
              <span className="cmd-form-badge" style={{ background: '#dc2626', color: '#fff' }}>Danger · Admin</span>
            </div>
            <p className="cmd-form-helper" style={{ color: '#b45309' }}>
              ⚠ For verified false alarms / cleared threats only. This releases fire
              suppression for <strong>{formDevice.trim() || 'the device'}</strong>. It does
              <strong> not</strong> bypass gas/CO safety, and the device will reject it if
              flame is still detected (<code>fire_still_present</code>).
            </p>
            <div className="cmd-form-field">
              <label className="cmd-form-label">Reason (required)</label>
              <input
                className="override-form-input"
                type="text"
                value={mrReason}
                onChange={(e) => setMrReason(e.target.value)}
                disabled={mrSubmitting}
                maxLength={240}
                placeholder="e.g. Burnt toast — kitchen verified clear, no fire."
              />
            </div>
            <div className="cmd-form-footer">
              <button
                type="button"
                className="btn-override-submit"
                style={{ background: '#dc2626' }}
                disabled={mrSubmitting || !mrReason.trim()}
                onClick={handleMaintenanceReset}
              >
                {mrSubmitting ? 'Sending…' : 'Confirm Threat Cleared'}
              </button>
              {mrMsg && (
                <span className={`override-submit-msg${mrMsg.ok ? ' override-submit-msg--ok' : ' override-submit-msg--err'}`}>
                  {mrMsg.text}
                </span>
              )}
            </div>
          </div>

        </div>
      ) : (
        <div className="cmd-panel">
          <div className="cmd-form-card">
            <div className="cmd-form-hdr">
              <span className="cmd-form-title">Override Controls</span>
              <span className="cmd-form-badge">Admin Role Required</span>
            </div>
            <p className="cmd-form-helper">Manual override controls are restricted to admin accounts.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default OverridesPage
