import { useState, useEffect, useCallback } from 'react'
import { getOverrides, createOverride } from '../services/overrideService.js'
import { formatDateTime } from '../utils/formatters.js'
import * as authService from '../services/authService.js'
import Badge from '../components/ui/Badge.jsx'
import FilterBar from '../components/ui/FilterBar.jsx'
import DataTable from '../components/ui/DataTable.jsx'

const OVERRIDE_STATUS_FILTERS = ['all', 'requested', 'executed', 'failed', 'blocked']
const OVERRIDE_ACTIONS_LIST = [
  'pump_on', 'pump_off',
  'valve_open', 'valve_close',
  'buzzer_on', 'buzzer_off',
  'door_unlock', 'system_reset',
]

function OverridesPage() {
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
      await createOverride({
        device_id:    formDevice.trim(),
        actuator_id:  formActuator.trim(),
        action:       formAction,
        reason:       formReason.trim(),
        requested_by: requestedBy,
      })
      setSubmitMsg({ ok: true, text: 'Override created successfully.' })
      loadOverrides(statusFilter)
    } catch (err) {
      setSubmitMsg({ ok: false, text: err.message || 'Failed to create override.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overrides-page">
      <div className="overrides-toolbar">
        <FilterBar options={OVERRIDE_STATUS_FILTERS} activeValue={statusFilter} onChange={handleFilterChange} />
      </div>

      {loading && <p className="overrides-loading">Loading overrides…</p>}

      {!loading && error && (
        <p className="overrides-error">{error}</p>
      )}

      {!loading && !error && overrides.length === 0 && (
        <p className="overrides-empty">No overrides found.</p>
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

      <div className="override-form-card">
        <h3 className="override-form-heading">Create Override</h3>
        <form className="override-form" onSubmit={handleSubmit}>
          <div className="override-form-row">
            <label className="override-form-label">Device ID</label>
            <input
              className="override-form-input"
              type="text"
              value={formDevice}
              onChange={(e) => setFormDevice(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="override-form-row">
            <label className="override-form-label">Actuator ID</label>
            <input
              className="override-form-input"
              type="text"
              value={formActuator}
              onChange={(e) => setFormActuator(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="override-form-row">
            <label className="override-form-label">Action</label>
            <select
              className="override-form-select"
              value={formAction}
              onChange={(e) => setFormAction(e.target.value)}
              disabled={submitting}
            >
              {OVERRIDE_ACTIONS_LIST.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="override-form-row">
            <label className="override-form-label">Reason</label>
            <input
              className="override-form-input"
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              disabled={submitting}
              maxLength={240}
            />
          </div>
          <div className="override-form-footer">
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
    </div>
  )
}

export default OverridesPage
