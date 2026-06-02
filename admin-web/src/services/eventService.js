import { apiRequest } from './apiClient.js'

export async function getEvents(params = {}) {
  const query = new URLSearchParams()
  if (params.page     != null) query.set('page',     String(params.page))
  if (params.limit    != null) query.set('limit',    String(params.limit))
  if (params.severity != null) query.set('severity', String(params.severity))
  const qs = query.toString()
  return apiRequest(`/api/events${qs ? `?${qs}` : ''}`)
}
