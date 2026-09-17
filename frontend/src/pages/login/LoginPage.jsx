import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { demoAccounts, useAuth } from '../auth'
import logoImage from '../../assets/log.png'
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
            <img src={logoImage} alt="WedRings logo" className="brand-logo" />
          </span>
          <span className="brand-name">WEDRINGS</span>
        </Link>

        <div className="intro-content">
          <h1>Your Journey to Forever Starts Here</h1>
          <p className="intro-description">Book your marriage appointment easily, securely, and conveniently.</p>
        </div>

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

          <p className="signup-link">Don't have an account? <Link to="/register">Register</Link></p>

          <details className="demo-access">
            <summary>View demo access</summary>
            <p><strong>Applicant:</strong> {demoAccounts.applicant.email}<br />{demoAccounts.applicant.password}</p>
            <p><strong>Admin:</strong> {demoAccounts.admin.email}<br />{demoAccounts.admin.password}</p>
            <p><strong>Super Admin:</strong> {demoAccounts.superadmin.email}<br />{demoAccounts.superadmin.password}</p>
          </details>
        </div>
      </section>
    </main>
  )
}
