import { apiRequest } from './apiClient.js'

export async function getTelemetry(params = {}) {
  const query = new URLSearchParams()
  if (params.page      != null) query.set('page',      String(params.page))
  if (params.limit     != null) query.set('limit',     String(params.limit))
  if (params.device_id != null) query.set('device_id', String(params.device_id))
  if (params.room_id   != null) query.set('room_id',   String(params.room_id))
  const qs = query.toString()
  const data = await apiRequest(`/api/telemetry${qs ? `?${qs}` : ''}`)
  return Array.isArray(data) ? data : (data?.telemetry ?? [])
}

export async function getLatestTelemetry(params = {}) {
  const query = new URLSearchParams()
  if (params.device_id != null) query.set('device_id', String(params.device_id))
  if (params.room_id   != null) query.set('room_id',   String(params.room_id))
  const qs = query.toString()
  try {
    const data = await apiRequest(`/api/telemetry/latest${qs ? `?${qs}` : ''}`)
    return data?.telemetry ?? null
  } catch {
    return null
  }
}
