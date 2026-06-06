import { useState } from 'react'
import * as authService from '../services/authService.js'

const SECURITY_QUESTION_OPTIONS = [
  'What is the name of your first pet?',
  'What city were you born in?',
  'What was the name of your first school?',
  'What was the name of the street you grew up on?',
  "What is your mother's maiden name?",
  'What was the make and model of your first car?',
]

function mapError(msg) {
  if (
    !msg ||
    /failed to fetch|load failed|networkerror|network request failed/i.test(msg)
  ) {
    return 'Cannot reach server. Check your connection.'
  }
  return msg
}

function validate(fullName, email, password, confirmPassword, securityQuestion, securityAnswer) {
  const errs = {}
  const name = fullName.trim()

  if (name.length < 2) {
    errs.fullName = 'Full name must be at least 2 characters.'
  } else if (!/\p{L}/u.test(name)) {
    errs.fullName = 'Full name must include at least one letter.'
  }

  if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errs.email = 'Use a valid email format, e.g. name@example.com'
  }

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    errs.password =
      'Password must be at least 8 characters and include one uppercase letter and one number.'
  }

  if (password !== confirmPassword) {
    errs.confirmPassword = 'Passwords do not match.'
  }

  if (!securityQuestion) {
    errs.securityQuestion = 'Please select a security question.'
  }

  if (!securityAnswer.trim()) {
    errs.securityAnswer = 'Please enter a security answer.'
  }

  return errs
}

export default function RegisterPage({ onRegisterSuccess, onBackToLogin }) {
  const [fullName,         setFullName]         = useState('')
  const [email,            setEmail]            = useState('')
  const [password,         setPassword]         = useState('')
  const [confirmPassword,  setConfirmPassword]  = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer,   setSecurityAnswer]   = useState('')
  const [adminKey,         setAdminKey]         = useState('')
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState('')
  const [fieldErrors,      setFieldErrors]      = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const errs = validate(fullName, email, password, confirmPassword, securityQuestion, securityAnswer)
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await authService.register(
        fullName.trim(),
        email.trim(),
        password,
        adminKey.trim() || undefined,
        securityQuestion,
        securityAnswer.trim(),
      )
      onRegisterSuccess()
    } catch (err) {
      setError(mapError(err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card register-card">

        <div className="login-header">
          <div className="login-brand-wrap">
            <svg className="login-brand-icon" width="26" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6L12 2z" fill="#e53e3e"/>
              <path d="M12 5L5 8.5v4.5c0 3.9 2.7 7.55 7 8.85 4.3-1.3 7-4.95 7-8.85V8.5L12 5z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6"/>
            </svg>
          </div>
          <h1 className="login-title">Smart Home Security</h1>
          <p className="login-subtitle">Create Account</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>

          <div className="form-field">
            <label htmlFor="reg-fullname">Full Name</label>
            <input
              id="reg-fullname"
              type="text"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              autoComplete="name"
            />
            {fieldErrors.fullName && (
              <span className="form-field-error">{fieldErrors.fullName}</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            {fieldErrors.email ? (
              <span className="form-field-error">{fieldErrors.email}</span>
            ) : (
              <span className="form-field-helper">Use a valid email format, e.g. name@example.com</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              placeholder="Min 8 chars, uppercase, digit"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
            {fieldErrors.password ? (
              <span className="form-field-error">{fieldErrors.password}</span>
            ) : (
              <span className="form-field-helper">At least 8 characters with one uppercase letter and one number.</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && (
              <span className="form-field-error">{fieldErrors.confirmPassword}</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="reg-security-question">Security Question</label>
            <select
              id="reg-security-question"
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
              disabled={loading}
            >
              <option value="">Select a security question…</option>
              {SECURITY_QUESTION_OPTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
            {fieldErrors.securityQuestion && (
              <span className="form-field-error">{fieldErrors.securityQuestion}</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="reg-security-answer">Security Answer</label>
            <input
              id="reg-security-answer"
              type="text"
              placeholder="Your answer"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
            {fieldErrors.securityAnswer ? (
              <span className="form-field-error">{fieldErrors.securityAnswer}</span>
            ) : (
              <span className="form-field-helper">Used to recover your account if you forget your password.</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="reg-adminkey">
              Admin Registration Key{' '}
              <span className="form-field-optional">(optional)</span>
            </label>
            <input
              id="reg-adminkey"
              type="text"
              placeholder="Admin registration key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
            <span className="form-field-helper">
              Leave empty for resident account. Enter admin registration key only if you have one.
            </span>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

        </form>

        <div className="auth-nav">
          <button type="button" className="auth-nav-link" onClick={onBackToLogin}>
            ← Back to Sign In
          </button>
        </div>

      </div>
    </div>
  )
}
