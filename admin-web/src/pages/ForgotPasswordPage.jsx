import { useState } from 'react'
import * as authService from '../services/authService.js'

function mapError(msg) {
  if (
    !msg ||
    /failed to fetch|load failed|networkerror|network request failed/i.test(msg)
  ) {
    return 'Cannot reach server. Check your connection.'
  }
  return msg
}

function validateReset(securityAnswer, newPassword, confirmPassword) {
  const errs = {}
  if (!securityAnswer.trim()) {
    errs.securityAnswer = 'Please enter your security answer.'
  }
  if (
    newPassword.length < 8 ||
    !/[A-Z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword)
  ) {
    errs.newPassword =
      'Password must be at least 8 characters and include one uppercase letter and one number.'
  }
  if (newPassword !== confirmPassword) {
    errs.confirmPassword = 'Passwords do not match.'
  }
  return errs
}

export default function ForgotPasswordPage({ onBackToLogin }) {
  const [step,            setStep]           = useState('email')  // 'email' | 'answer' | 'success'
  const [email,           setEmail]          = useState('')
  const [question,        setQuestion]       = useState('')
  const [securityAnswer,  setSecurityAnswer] = useState('')
  const [newPassword,     setNewPassword]    = useState('')
  const [confirmPassword, setConfirmPassword]= useState('')
  const [loading,         setLoading]        = useState(false)
  const [error,           setError]          = useState('')
  const [fieldErrors,     setFieldErrors]    = useState({})

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldErrors({ email: 'Use a valid email format, e.g. name@example.com' })
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      const data = await authService.getRecoveryQuestion(email.trim())
      if (!data.configured) {
        setError('Recovery is not configured for this account.')
      } else {
        setQuestion(data.question)
        setStep('answer')
      }
    } catch (err) {
      setError(mapError(err.message))
    } finally {
      setLoading(false)
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault()
    setError('')
    const errs = validateReset(securityAnswer, newPassword, confirmPassword)
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await authService.resetPassword(email.trim(), securityAnswer.trim(), newPassword)
      setStep('success')
    } catch (err) {
      setError(mapError(err.message))
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setStep('email')
    setError('')
    setFieldErrors({})
    setSecurityAnswer('')
    setNewPassword('')
    setConfirmPassword('')
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
          <p className="login-subtitle">Account Recovery</p>
        </div>

        {step === 'email' && (
          <form className="login-form" onSubmit={handleEmailSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="recovery-email">Email Address</label>
              <input
                id="recovery-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
              {fieldErrors.email && (
                <span className="form-field-error">{fieldErrors.email}</span>
              )}
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Looking up…' : 'Find My Security Question'}
            </button>
          </form>
        )}

        {step === 'answer' && (
          <form className="login-form" onSubmit={handleResetSubmit} noValidate>
            <div className="form-field">
              <label>Security Question</label>
              <div className="recovery-question-display">{question}</div>
            </div>

            <div className="form-field">
              <label htmlFor="recovery-answer">Security Answer</label>
              <input
                id="recovery-answer"
                type="text"
                placeholder="Your answer"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
              {fieldErrors.securityAnswer && (
                <span className="form-field-error">{fieldErrors.securityAnswer}</span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="recovery-newpassword">New Password</label>
              <input
                id="recovery-newpassword"
                type="password"
                placeholder="Min 8 chars, uppercase, digit"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              {fieldErrors.newPassword ? (
                <span className="form-field-error">{fieldErrors.newPassword}</span>
              ) : (
                <span className="form-field-helper">At least 8 characters with one uppercase letter and one number.</span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="recovery-confirm">Confirm New Password</label>
              <input
                id="recovery-confirm"
                type="password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword && (
                <span className="form-field-error">{fieldErrors.confirmPassword}</span>
              )}
            </div>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className="recovery-success">
            <p className="recovery-success-msg">Password updated. Please sign in.</p>
          </div>
        )}

        <div className="auth-nav">
          {step === 'answer' && (
            <>
              <button type="button" className="auth-nav-link" onClick={handleBack}>
                ← Back
              </button>
              <span className="auth-nav-sep"> · </span>
            </>
          )}
          <button type="button" className="auth-nav-link" onClick={onBackToLogin}>
            ← Back to Sign In
          </button>
        </div>

      </div>
    </div>
  )
}
