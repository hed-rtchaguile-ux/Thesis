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
          <span className="brand-mark">W</span>
          <span>WedRings</span>
        </Link>
        <div className="intro-content">
          <p className="eyebrow">Applicant portal</p>
          <h1>Your next chapter starts here.</h1>
          <p className="intro-description">Track your application, keep your details current, and stay close to every milestone.</p>
          <div className="intro-stamp" aria-hidden="true">APPLY</div>
        </div>
        <p className="intro-footer">A considered digital experience for every important beginning.</p>
      </section>

      <section className="login-panel">
        <div className="panel-inner">
          <p className="eyebrow">Sign in securely</p>
          <h2>Welcome back.</h2>
          <p className="form-lead">Sign in to continue to your WedRings workspace.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="login-email">Email address</label>
            <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
          </form>

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
