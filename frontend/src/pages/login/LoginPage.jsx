import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { demoAccounts, useAuth } from '../auth'
import './LoginPage.css'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) {
    return <Navigate to={`/${user.role}/dashboard`} replace />
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const result = login(email, password)
    if (!result.success) {
      setError(result.message)
      setIsSubmitting(false)
      return
    }

    const destination = location.state?.from?.pathname || `/${result.role}/dashboard`
    navigate(destination, { replace: true })
  }

  return (
    <main className="login-shell">
      <section className="login-intro">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-label="WedRings logo">
            <svg viewBox="0 0 90 78" aria-hidden="true">
              <path className="logo-heart" d="M45 66 C25 52, 6 40, 6 22 C6 12, 14 6, 22 6 C30 6, 36 11, 41 18 C46 11, 52 6, 60 6 C68 6, 76 12, 76 22 C76 40, 57 52, 45 66Z" />
              <path className="logo-ring" d="M28 40 C28 29, 35 22, 45 22 C55 22, 62 29, 62 40 C62 50, 54 58, 45 58 C35 58, 28 50, 28 40Z" />
              <path className="logo-ring" d="M17 38 C17 18, 30 10, 45 10 C60 10, 73 18, 73 38 C73 50, 62 60, 45 60 C28 60, 17 50, 17 38Z" opacity="0.65" />
              <path className="logo-heart" d="M45 64 C41 60, 37 57, 32 53 C24 47, 18 41, 18 31 C18 24, 23 18, 30 18 C35 18, 39 20, 43 24 C45 26, 47 26, 49 24 C53 20, 57 18, 62 18 C69 18, 74 24, 74 31 C74 41, 68 47, 60 53 C55 57, 51 60, 45 64Z" opacity="0.12" />
              <path className="logo-crown" d="M26 15 L34 8 L42 15 L50 8 L58 15 L64 13 L66 24 L24 24 L26 15Z" />
              <circle className="logo-crown" cx="28" cy="13" r="2.1" />
              <circle className="logo-crown" cx="45" cy="8" r="2.1" />
              <circle className="logo-crown" cx="62" cy="13" r="2.1" />
            </svg>
          </span>
          <span className="brand-name">WEDRINGS</span>
        </Link>

        

      </section>

      <section className="login-panel">
        <div className="panel-inner">
          <h2>Welcome Back</h2>
          <p className="form-lead">Log in to your account to continue.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="login-email">Email Address</label>
            <input id="login-email" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

            <label htmlFor="login-password">Password</label>
            <div className="password-wrap">
              <input id="login-password" type="password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <span className="password-eye" aria-hidden="true">◌</span>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-link">Forgot password?</a>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Log In'}</button>
          </form>

          <p className="signup-link">Don't have an account? <a href="#">Register</a></p>

          <details className="demo-access">
            <summary>View demo access</summary>
            <p><strong>Applicant:</strong> {demoAccounts.applicant.email}<br />{demoAccounts.applicant.password}</p>
            <p><strong>Admin:</strong> {demoAccounts.admin.email}<br />{demoAccounts.admin.password}</p>
          </details>
        </div>
      </section>
    </main>
  )
}
