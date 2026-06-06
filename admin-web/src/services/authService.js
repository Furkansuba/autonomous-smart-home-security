import { apiRequest } from './apiClient.js'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export async function login(email, password) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (data.token) {
    localStorage.setItem(TOKEN_KEY, data.token)
  }
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  }

  return data
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return Boolean(getStoredToken())
}

export async function register(fullName, email, password, adminKey) {
  const body = { full_name: fullName, email, password }
  if (adminKey) body.admin_key = adminKey   // omit key entirely when empty

  const data = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (data.token) localStorage.setItem(TOKEN_KEY, data.token)
  if (data.user)  localStorage.setItem(USER_KEY, JSON.stringify(data.user))

  return data
}
