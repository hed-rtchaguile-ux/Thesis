import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import logoImage from '../../assets/wedrings-mark.png'
import './LoginPage.css'

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('The server returned an unexpected response. Please try again later.')
  }
  return response.json()
}

export default function PasswordRecoveryPage({ mode }) {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const isDirectReset = mode === 'reset'
  const [step, setStep] = useState(mode === 'reset' ? 'password' : 'email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState(token)
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
    setMessage('')

    if (step === 'password' && password !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const endpoint = step === 'email'
        ? '/api/auth/forgot-password'
        : step === 'code'
          ? '/api/auth/verify-reset-code'
          : '/api/auth/reset-password'
      const body = step === 'email'
        ? { email }
        : step === 'code'
          ? { email, code }
          : { token: resetToken, password }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await readApiResponse(response)
      if (!response.ok) throw new Error(result.message || 'Unable to process your request.')

      if (step === 'email') {
        setDevelopmentHint(Boolean(result.developmentVerificationCodeLogged))
        setStep('code')
        setMessage(result.message)
      } else if (step === 'code') {
        setResetToken(result.resetToken)
        setStep('password')
        setMessage(result.message)
      } else {
        setMessage(result.message)
        setIsComplete(true)
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to process your request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const pageTitle = isComplete
    ? 'Password updated'
    : step === 'email'
      ? 'Forgot Password?'
      : step === 'code'
        ? 'Verify your email'
        : 'Choose a new password.'
  const introTitle = step === 'password' ? 'Choose a new password.' : 'Account recovery.'
  const leadText = isComplete
    ? message
    : step === 'email'
      ? 'Enter the email address associated with your account.'
      : step === 'code'
        ? 'Enter the six-digit verification code sent to your email.'
        : step === 'password'
          ? 'Your code is verified. Set a new password for your account.'
          : ''

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
          <h1>{introTitle}</h1>
          <p className="intro-description">We’ll help you get back into your account.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="panel-inner">
          <h2>{isComplete ? pageTitle : pageTitle}</h2>
          <p className="form-lead">{isComplete ? message : leadText}</p>

          {isComplete ? (
            <p className="signup-link"><Link to="/login">Back to Log In</Link></p>
          ) : isDirectReset && !resetToken ? (
            <p className="signup-link"><Link to="/forgot-password">Request a verification code</Link></p>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              {step === 'email' && (
                <>
                  <label htmlFor="recovery-email">Email Address</label>
                  <input
                    id="recovery-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </>
              )}
              {step === 'code' && (
                <>
                  {developmentHint && (
                    <p className="recovery-note" role="status">
                      Local development: check the backend terminal for the verification code.
                    </p>
                  )}
                  {message && <p className="recovery-note" role="status">{message}</p>}
                  <label htmlFor="recovery-code">Verification code</label>
                  <input
                    id="recovery-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    required
                  />
                  <button
                    type="button"
                    className="text-link recovery-resend"
                    onClick={() => {
                      setError('')
                      setMessage('')
                      setStep('email')
                    }}
                  >
                    Use a different email or request a new code
                  </button>
                </>
              )}
              {step === 'password' && (
                <>
                  {message && <p className="recovery-note" role="status">{message}</p>}
                  <label htmlFor="reset-password">New password</label>
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    required
                  />
                  <label htmlFor="reset-confirm-password">Confirm new password</label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </>
              )}

              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Please wait...'
                  : step === 'email'
                    ? 'Send verification code'
                    : step === 'code'
                      ? 'Verify code'
                      : 'Set New Password'}
              </button>
            </form>
          )}

          {!isComplete && <p className="signup-link"><Link to="/login">Back to Log In</Link></p>}
        </div>
      </section>
    </main>
  )
}
