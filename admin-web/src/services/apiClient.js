import { API_BASE_URL } from '../config/api.js'

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('auth_token')

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  const isLoginRequest = path.includes('/api/auth/login')

  if (response.status === 401 && token && !isLoginRequest) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    window.location.href = '/'
    throw new Error('Session expired. Please log in again.')
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed: ${response.status} ${response.statusText}`
    throw new Error(message)
  }

  return data
}
