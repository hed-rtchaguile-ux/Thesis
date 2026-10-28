import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import logoImage from '../../assets/wedrings-mark.png'
import '../login/LoginPage.css'

export default function ApplicantSignup() {
  const { user, register, requestRegistrationCode } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!codeSent && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = codeSent
        ? await register(email, verificationCode)
        : await requestRegistrationCode(name, email, password)
      if (!result.success) {
        setError(result.message)
        return
      }

      if (codeSent) {
        navigate('/applicant/dashboard', { replace: true })
      } else {
        setCodeSent(true)
        setNotice(result.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendCode() {
    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      const result = await requestRegistrationCode(name, email, password)
      if (!result.success) {
        setError(result.message)
        return
      }

      setVerificationCode('')
      setNotice(result.message)
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
          <h1>Your story starts here.</h1>
          <p className="intro-description">Create an applicant account to begin your marriage registration.</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="panel-inner">
          <h2>Create account</h2>
          <p className="form-lead">Register as an applicant to manage your applications.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="signup-name">Full Name</label>
            <input id="signup-name" type="text" autoComplete="name" minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required disabled={codeSent} />

            <label htmlFor="signup-email">Email Address</label>
            <input id="signup-email" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={codeSent} />

            <label htmlFor="signup-password">Password</label>
            <input id="signup-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={codeSent} />

            <label htmlFor="signup-confirm-password">Confirm Password</label>
            <input id="signup-confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required disabled={codeSent} />

            {codeSent && (
              <>
                <label htmlFor="signup-verification-code">Email verification code</label>
                <input
                  id="signup-verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            {notice && <p className="recovery-note" role="status">{notice}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? (codeSent ? 'Verifying code...' : 'Sending code...')
                : (codeSent ? 'Verify code & create account' : 'Send verification code')}
            </button>
            {codeSent && (
              <button
                type="button"
                className="signup-resend-button"
                disabled={isSubmitting}
                onClick={handleResendCode}
              >
                Resend verification code
              </button>
            )}
          </form>

          <p className="signup-link">Already registered? <Link to="/login">Log in</Link></p>
        </div>
      </section>
    </main>
  )
}
