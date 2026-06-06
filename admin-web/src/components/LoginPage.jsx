import { useState } from 'react'
import * as authService from '../services/authService.js'

export default function LoginPage({ onLoginSuccess, onCreateAccount }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authService.login(email, password)
      onLoginSuccess()
    } catch (err) {
      setError(err.message || 'Login failed. Check credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand-wrap">
            <svg className="login-brand-icon" width="26" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6L12 2z" fill="#e53e3e"/>
              <path d="M12 5L5 8.5v4.5c0 3.9 2.7 7.55 7 8.85 4.3-1.3 7-4.95 7-8.85V8.5L12 5z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6"/>
            </svg>
          </div>
          <h1 className="login-title">Smart Home Security</h1>
          <p className="login-subtitle">Security Operations Portal</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="admin@smarthome.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Authenticating…' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div className="auth-nav">
          <span className="auth-nav-text">New here?&nbsp;</span>
          <button type="button" className="auth-nav-link" onClick={onCreateAccount}>
            Create account
          </button>
        </div>

      </div>
    </div>
  )
}
