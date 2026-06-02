import { apiRequest } from './apiClient.js'

export async function getDashboardSummary() {
  return apiRequest('/api/dashboard/summary')
}
