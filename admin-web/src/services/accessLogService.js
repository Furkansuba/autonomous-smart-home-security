import { apiRequest } from './apiClient.js'

export async function getAccessLogs(params = {}) {
  const query = new URLSearchParams()
  if (params.page   != null) query.set('page',   String(params.page))
  if (params.limit  != null) query.set('limit',  String(params.limit))
  if (params.result != null) query.set('result', String(params.result))
  const qs = query.toString()
  return apiRequest(`/api/access-logs${qs ? `?${qs}` : ''}`)
}
