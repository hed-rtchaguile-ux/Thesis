import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import logoImage from '../../assets/wedrings-mark.png'
import './LoginPage.css'

export default function PasswordRecoveryPage({ mode }) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const isReset = mode === 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [developmentHint, setDevelopmentHint] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (isReset && password !== confirmPassword) {
        throw new Error('The passwords do not match.')
      }

      const response = await fetch(isReset ? '/api/auth/reset-password' : '/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isReset ? { token, password } : { email }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to process your request.')

      setMessage(result.message)
      setDevelopmentHint(Boolean(result.developmentResetLinkLogged))
      setIsComplete(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-intro">
        <Link className="brand" to="/login">
          <span className="brand-mark" aria-label="WedRings logo">
            <img src={logoImage} alt="WedRings logo" className="brand-logo" />
          </span>
          <span className="brand-name">WEDRINGS</span>
        </Link>
        <div className="intro-content">
          <h1>{isReset ? 'Choose a new password.' : 'Account recovery.'}</h1>
          <p className="intro-description">{isReset ? 'Set a new password to get back to your account.' : 'We’ll help you get back into your account.'}</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="panel-inner">
          <h2>{isComplete ? (isReset ? 'Password updated' : 'Check your email') : (isReset ? 'Reset Password' : 'Forgot Password?')}</h2>
          <p className="form-lead">
            {isComplete
              ? message
              : isReset
                ? 'Enter a new password for your account.'
                : 'Enter the email address associated with your account.'}
          </p>

          {isComplete ? (
            <>
              {developmentHint && <p className="recovery-note" role="status">For local development, use the reset link printed in the backend terminal.</p>}
              <p className="signup-link"><Link to="/login">Back to Log In</Link></p>
            </>
          ) : isReset && !token ? (
            <p className="signup-link"><Link to="/forgot-password">Request a new reset link</Link></p>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              {isReset ? (
                <>
                  <label htmlFor="reset-password">New password</label>
                  <input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required />

                  <label htmlFor="reset-confirm-password">Confirm new password</label>
                  <input id="reset-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required />
                </>
              ) : (
                <>
                  <label htmlFor="recovery-email">Email Address</label>
                  <input id="recovery-email" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </>
              )}

              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : isReset ? 'Set New Password' : 'Send Reset Link'}
              </button>
            </form>
          )}

          {!isComplete && <p className="signup-link"><Link to="/login">Back to Log In</Link></p>}
        </div>
      </section>
    </main>
  )
}
