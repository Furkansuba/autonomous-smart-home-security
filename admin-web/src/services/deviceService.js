import { apiRequest } from './apiClient.js'

export async function getDevices(params = {}) {
  const query = new URLSearchParams()
  if (params.page  != null) query.set('page',  String(params.page))
  if (params.limit != null) query.set('limit', String(params.limit))
  const qs = query.toString()
  return apiRequest(`/api/devices${qs ? `?${qs}` : ''}`)
}

export async function refreshDeviceStatuses() {
  return apiRequest('/api/devices/refresh-status', { method: 'POST' })
}
