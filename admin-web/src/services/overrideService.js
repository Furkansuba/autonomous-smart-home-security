import { apiRequest } from './apiClient.js'

export async function getOverrides(params = {}) {
  const query = new URLSearchParams()
  if (params.page         != null) query.set('page',         String(params.page))
  if (params.limit        != null) query.set('limit',        String(params.limit))
  if (params.status       != null) query.set('status',       String(params.status))
  if (params.device_id    != null) query.set('device_id',    String(params.device_id))
  if (params.requested_by != null) query.set('requested_by', String(params.requested_by))
  if (params.action       != null) query.set('action',       String(params.action))
  const qs = query.toString()
  return apiRequest(`/api/overrides${qs ? `?${qs}` : ''}`)
}

export async function createOverride(payload) {
  return apiRequest('/api/overrides', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
