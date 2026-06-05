import { apiRequest } from './apiClient.js'

export async function getNotificationLogs(params = {}) {
  const query = new URLSearchParams()
  if (params.page      != null) query.set('page',      String(params.page))
  if (params.limit     != null) query.set('limit',     String(params.limit))
  if (params.channel   != null) query.set('channel',   String(params.channel))
  if (params.status    != null) query.set('status',    String(params.status))
  if (params.device_id != null) query.set('device_id', String(params.device_id))
  const qs = query.toString()
  return apiRequest(`/api/notification-logs${qs ? `?${qs}` : ''}`)
}
