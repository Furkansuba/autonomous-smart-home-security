import { useState, useEffect, useCallback } from 'react'
import { getOverrides, createOverride } from '../services/overrideService.js'
import { formatDateTime } from '../utils/formatters.js'
import { exportRowsToCsv } from '../utils/csvExport.js'
import { useEventStream } from '../hooks/useEventStream.js'
import * as authService from '../services/authService.js'
import Badge from '../components/ui/Badge.jsx'
import FilterBar from '../components/ui/FilterBar.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import StateMessage from '../components/ui/StateMessage.jsx'
import LiveIndicator from '../components/ui/LiveIndicator.jsx'

const OVERRIDE_STATUS_FILTERS = ['all', 'requested', 'executed', 'failed', 'blocked']

const QUICK_ACTIONS = [
  { label: 'Silence Alarm', action: 'buzzer_off' },
  { label: 'Test Buzzer',   action: 'buzzer_on'  },
  { label: 'Stop Pump',     action: 'pump_off'   },
]

// Action-aware actuator options for the manual override form. Labels are shown to the
// user; the raw actuator_id value below is what is submitted — the MQTT/backend/firmware
// contract is unchanged. Actuator IDs match the firmware override handlers in
// firmware/code-final-v3.ino (pump_on checks pump_rm1_01/pump_rm2_01/pump_kit_01/pump_liv_01).
const PUMP_OPTIONS = [
  { value: 'pump_rm1_01', label: 'Bedroom 1 Pump' },
  { value: 'pump_rm2_01', label: 'Bedroom 2 Pump' },
  { value: 'pump_kit_01', label: 'Kitchen Pump' },
  { value: 'pump_liv_01', label: 'Living Room Pump' },
]
const BUZZER_OPTIONS = [{ value: 'buzzer_01', label: 'Alarm Buzzer' }]
const DOOR_OPTIONS   = [{ value: 'door_controller_01', label: 'Main Door Servo Lock' }]

const ACTION_ACTUATOR_OPTIONS = {
  buzzer_on:   BUZZER_OPTIONS,
  buzzer_off:  BUZZER_OPTIONS,
  door_lock:   DOOR_OPTIONS,
  door_unlock: DOOR_OPTIONS,
  pump_on:     PUMP_OPTIONS,
  pump_off:    PUMP_OPTIONS,
}

// Device-level actions target the controller itself (no discrete actuator). The backend
// and firmware ignore actuator_id for these, so we submit the device_id and keep the
// selection automatic instead of leaving a stale/confusing actuator like buzzer_01.
const DEVICE_LEVEL_ACTIONS = new Set(['arm', 'disarm', 'maintenance_reset', 'system_reset'])

function getActuatorOptionsForAction(action, deviceId = 'esp32_home_01') {
  if (ACTION_ACTUATOR_OPTIONS[action]) return ACTION_ACTUATOR_OPTIONS[action]
  // Device-level (and any unmapped) actions target the controller so a stale actuator
  // can never persist after the action changes.
  return [{ value: deviceId, label: 'Controller (device-level command)' }]
}

function getDefaultActuatorForAction(action, deviceId = 'esp32_home_01') {
  const opts = getActuatorOptionsForAction(action, deviceId)
  return opts[0]?.value ?? deviceId
}

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

  const [doorSubmitting, setDoorSubmitting] = useState(false)
  const [doorMsg,         setDoorMsg]        = useState(null)

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

  // Real-time: reload the history when an override result is streamed.
  const liveConnected = useEventStream((type) => {
    if (type === 'override_result') loadOverrides(statusFilter)
  })

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

  // Changing the action re-selects a valid actuator for that action so wrong
  // action/actuator combinations (e.g. pump_on with buzzer_01) can never be submitted.
  function handleActionChange(action) {
    setFormAction(action)
    setFormActuator(getDefaultActuatorForAction(action, formDevice.trim() || 'esp32_home_01'))
  }

  // For device-level actions the actuator IS the device id, so keep them in sync when
  // the target device changes. Actuator-specific actions (buzzer/pump/door) are unaffected.
  function handleDeviceChange(device) {
    setFormDevice(device)
    if (DEVICE_LEVEL_ACTIONS.has(formAction)) {
      setFormActuator(getDefaultActuatorForAction(formAction, device.trim() || 'esp32_home_01'))
    }
  }

  function applyQuickAction(action) {
    setFormAction(action)
    setFormActuator(getDefaultActuatorForAction(action, formDevice.trim() || 'esp32_home_01'))
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

  // Door Lock / Unlock — physical door actuator control. Admin-only. door_lock is
  // blocked during an active fire/gas/CO hazard for evacuation safety; door_unlock is
  // always allowed. Status is reported honestly and applied only on device ACK.
  async function handleDoorControl(action) {
    const device = formDevice.trim() || 'esp32_home_01'
    const verb = action === 'door_lock' ? 'LOCK' : 'UNLOCK'
    const ok = window.confirm(
      `${verb} the physical door for ${device}?\n\n` +
      (action === 'door_lock'
        ? 'Lock Door is BLOCKED while a fire/gas/CO hazard is active so evacuation is never ' +
          'trapped behind a locked door.'
        : 'Unlock Door is a physical-security action. It is allowed during a hazard for ' +
          'evacuation.') +
      '\n\nThis is logged in override history and applied once the device acknowledges.'
    )
    if (!ok) return
    setDoorSubmitting(true)
    setDoorMsg(null)
    const user = authService.getStoredUser()
    const requestedBy = user?.user_id ?? 'usr_admin_001'
    try {
      const res = await createOverride({
        device_id:    device,
        actuator_id:  'door_controller_01',
        action,
        reason:       action === 'door_lock' ? 'Lock door via admin web.' : 'Unlock door via admin web.',
        requested_by: requestedBy,
      })
      const ov = res?.override
      if (ov?.status === 'blocked') {
        setDoorMsg({ ok: false, text: ov.blocked_reason || 'Command blocked for safety.' })
      } else if (ov?.status === 'failed') {
        setDoorMsg({ ok: false, text: `Device rejected: ${ov.blocked_reason || 'unknown reason'}.` })
      } else if (ov?.status === 'executed') {
        setDoorMsg({ ok: true, text: `Door ${action === 'door_lock' ? 'LOCKED' : 'UNLOCKED'} — confirmed by device.` })
      } else {
        setDoorMsg({ ok: true, text: `${verb} requested — awaiting device confirmation.` })
      }
      loadOverrides(statusFilter)
    } catch (err) {
      setDoorMsg({ ok: false, text: err.message || 'Failed to send command.' })
    } finally {
      setDoorSubmitting(false)
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
        // maintenance_reset is a device-level command; backend/firmware ignore the
        // actuator_id, so use the device id (not a pump) to avoid confusing history.
        actuator_id:  formDevice.trim() || 'esp32_home_01',
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

  function handleExportCsv() {
    exportRowsToCsv('overrides', [
      { header: 'Status',        value: (o) => o.status },
      { header: 'Action',        value: (o) => o.action },
      { header: 'Actuator',      value: (o) => o.actuator_id },
      { header: 'Requested By',  value: (o) => o.requested_by },
      { header: 'Requested At',  value: (o) => formatDateTime(o.requested_at) },
      { header: 'Result At',     value: (o) => (o.result_at ? formatDateTime(o.result_at) : '') },
      { header: 'Result Detail', value: (o) => o.blocked_reason },
      { header: 'Reason',        value: (o) => o.reason },
      { header: 'Device',        value: (o) => o.device_id },
      { header: 'Override ID',   value: (o) => o.override_id },
    ], overrides)
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

      {/* ── Admin control area: primary form on top, action cards in a responsive grid ── */}
      {isAdmin ? (
        <>
          {/* Primary control — full width */}
          <div className="cmd-form-card ovr-primary">
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
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
                <div className="cmd-form-field">
                  <label className="cmd-form-label">Actuator</label>
                  <select
                    className="override-form-select"
                    value={formActuator}
                    onChange={(e) => setFormActuator(e.target.value)}
                    disabled={submitting}
                    required
                  >
                    {getActuatorOptionsForAction(formAction, formDevice.trim() || 'esp32_home_01').map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} ({opt.value})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="cmd-form-grid">
                <div className="cmd-form-field">
                  <label className="cmd-form-label">Action</label>
                  <select
                    className="override-form-select"
                    value={formAction}
                    onChange={(e) => handleActionChange(e.target.value)}
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

          {/* Action cards — responsive 2–4 column grid */}
          <div className="ovr-actions-grid">

            {/* Quick Actions */}
            <div className="cmd-form-card ovr-action-card">
              <div className="cmd-form-hdr">
                <span className="cmd-form-title">Quick Actions</span>
                <span className="cmd-form-badge">Presets</span>
              </div>
              <p className="cmd-form-helper">Select a preset to populate the command form above. Safe actions auto-complete in demo mode. Hazard events are not cleared by overrides.</p>
              <div className="ovr-btn-row">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.action}
                    type="button"
                    className="cmd-quick-btn"
                    onClick={() => applyQuickAction(qa.action)}
                    disabled={submitting}
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Security Mode — ARM / DISARM (intrusion monitoring only) */}
            <div className="cmd-form-card ovr-action-card" style={{ borderTopColor: '#2563eb' }}>
              <div className="cmd-form-hdr">
                <span className="cmd-form-title">Security Mode</span>
                <span className="cmd-form-badge" style={{ background: '#2563eb', color: '#fff' }}>Admin</span>
              </div>
              <p className="cmd-form-helper">
                ARM/DISARM controls <strong>intrusion monitoring only</strong> (motion, vibration,
                reed/window) for <strong>{formDevice.trim() || 'the device'}</strong>. FIRE, GAS, and
                CO detection <strong>always remain active</strong>. Disarming does not silence an
                active fire/gas/CO alarm. Applied once the device acknowledges.
              </p>
              <div className="ovr-btn-row">
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

            {/* Door Controls — physical door actuator (separate from ARM/DISARM) */}
            <div className="cmd-form-card ovr-action-card" style={{ borderTopColor: '#0891b2' }}>
              <div className="cmd-form-hdr">
                <span className="cmd-form-title">Door Controls</span>
                <span className="cmd-form-badge" style={{ background: '#0891b2', color: '#fff' }}>Admin</span>
              </div>
              <p className="cmd-form-helper">
                Physical door lock/unlock for <strong>{formDevice.trim() || 'the device'}</strong>.
                <strong> Lock Door is blocked during an active fire/gas/CO hazard</strong> so evacuation
                is never trapped; <strong>Unlock Door</strong> is allowed at any time (including during a
                hazard). Logged and applied on device ACK. Does not change ARM/DISARM mode.
              </p>
              <div className="ovr-btn-row">
                <button
                  type="button"
                  className="cmd-quick-btn"
                  onClick={() => handleDoorControl('door_lock')}
                  disabled={doorSubmitting}
                >
                  Lock Door
                </button>
                <button
                  type="button"
                  className="cmd-quick-btn"
                  onClick={() => handleDoorControl('door_unlock')}
                  disabled={doorSubmitting}
                >
                  Unlock Door
                </button>
              </div>
              {doorMsg && (
                <span className={`override-submit-msg${doorMsg.ok ? ' override-submit-msg--ok' : ' override-submit-msg--err'}`}>
                  {doorMsg.text}
                </span>
              )}
            </div>

            {/* Threat Recovery — Confirm Threat Cleared with required reason */}
            <div className="cmd-form-card ovr-action-card" style={{ borderTopColor: '#dc2626' }}>
              <div className="cmd-form-hdr">
                <span className="cmd-form-title">Confirm Threat Cleared</span>
                <span className="cmd-form-badge" style={{ background: '#dc2626', color: '#fff' }}>Danger · Admin</span>
              </div>
              <p className="cmd-form-helper" style={{ color: '#b45309' }}>
                ⚠ For verified false alarms / cleared threats only. Releases fire suppression for
                <strong> {formDevice.trim() || 'the device'}</strong>. Does <strong>not</strong> bypass
                gas/CO safety; the device rejects it if flame is still detected
                (<code>fire_still_present</code>).
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
                  placeholder="e.g. Burnt toast — kitchen verified clear."
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
        </>
      ) : (
        <div className="cmd-form-card">
          <div className="cmd-form-hdr">
            <span className="cmd-form-title">Override Controls</span>
            <span className="cmd-form-badge">Admin Role Required</span>
          </div>
          <p className="cmd-form-helper">Manual override controls are restricted to admin accounts.</p>
        </div>
      )}

      {/* ── Override history / logs — full width below the controls ── */}
      <div className="ovr-logs">
        <div className="ovr-logs-hdr">
          <span className="cmd-form-title">Override History</span>
          <div className="ovr-logs-hdr-controls">
            <LiveIndicator connected={liveConnected} />
            <FilterBar options={OVERRIDE_STATUS_FILTERS} activeValue={statusFilter} onChange={handleFilterChange} />
            <button
              type="button"
              className="btn-export-csv"
              onClick={handleExportCsv}
              disabled={loading || !!error || overrides.length === 0}
            >
              Export CSV
            </button>
          </div>
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
            columns={['Status', 'Action', 'Actuator', 'Requested By', 'Requested At', 'Result At', 'Result Detail', 'Reason', 'Device']}
          >
            {overrides.map((o) => (
              <tr key={o.override_id ?? o._id}>
                <td><Badge baseClass="override-status-badge" variant={o.status ?? 'requested'}>{o.status ?? '—'}</Badge></td>
                <td>{o.action ?? '—'}</td>
                <td>{o.actuator_id ?? '—'}</td>
                <td>{o.requested_by ?? '—'}</td>
                <td className="overrides-col-ts">{formatDateTime(o.requested_at)}</td>
                <td className="overrides-col-ts">{o.result_at ? formatDateTime(o.result_at) : '—'}</td>
                <td className="overrides-col-reason" title={o.blocked_reason ?? '—'}>{o.blocked_reason ?? '—'}</td>
                <td className="overrides-col-reason" title={o.reason ?? '—'}>{o.reason ?? '—'}</td>
                <td>{o.device_id ?? '—'}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  )
}

export default OverridesPage
