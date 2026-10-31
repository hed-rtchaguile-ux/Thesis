import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import logoImage from '../../assets/wedrings-mark.png'
import '../login/LoginPage.css'

export default function ApplicantSignup() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
      setError('Enter your Gmail address, ending in @gmail.com.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await register(name, email, password)
      if (!result.success) {
        setError(result.message)
        return
      }

      navigate('/applicant/dashboard', { replace: true })
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
          <p className="form-lead">Register as an applicant to manage your applications. Use an email you can access for password recovery.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="signup-name">Full Name</label>
            <input id="signup-name" type="text" autoComplete="name" minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required />

            <label htmlFor="signup-email">Email Address</label>
            <input id="signup-email" type="text" inputMode="email" autoCapitalize="none" placeholder="you@gmail.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

            <label htmlFor="signup-password">Password</label>
            <input id="signup-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />

            <label htmlFor="signup-confirm-password">Confirm Password</label>
            <input id="signup-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />

            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Create account'}</button>
          </form>

          <p className="signup-link">Already registered? <Link to="/login">Log in</Link></p>
        </div>
      </section>
    </main>
  )
}
