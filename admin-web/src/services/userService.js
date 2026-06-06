import { apiRequest } from './apiClient.js'

export async function getUsers() {
  const data = await apiRequest('/api/users')
  return Array.isArray(data?.users) ? data.users : []
}

export async function promoteToAdmin(userId) {
  return apiRequest(`/api/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'admin' }),
  })
}
