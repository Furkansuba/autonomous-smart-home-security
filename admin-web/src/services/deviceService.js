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

// Derived, read-only attached-component view for a single controller.
export async function getDeviceComponents(deviceId) {
  return apiRequest(`/api/devices/${encodeURIComponent(deviceId)}/components`)
}
