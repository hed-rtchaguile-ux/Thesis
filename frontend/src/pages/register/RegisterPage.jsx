import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import './RegisterPage.css'

export default function RegisterPage() {
  const { registerAccount } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    const result = registerAccount(form.name, form.email, form.password)
    if (!result.success) {
      setError(result.message)
      setIsSubmitting(false)
      return
    }

    navigate('/login', { state: { registered: true } })
  }

  return (
    <main className="register-page">
      <section className="register-card">
        <Link className="register-brand" to="/login">WEDRINGS</Link>
        <p className="register-eyebrow">Applicant account</p>
        <h1>Create your account</h1>
        <p className="register-lead">Register to start your marriage application.</p>

        <form className="register-form" onSubmit={handleSubmit}>
          <label htmlFor="register-name">Full Name</label>
          <input
            id="register-name"
            type="text"
            placeholder="Your full name"
            autoComplete="name"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            required
          />

          <label htmlFor="register-email">Email Address</label>
          <input
            id="register-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            required
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            required
          />

          <label htmlFor="register-confirm-password">Confirm Password</label>
          <input
            id="register-confirm-password"
            type="password"
            placeholder="Repeat your password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            required
          />

          {error && <p className="register-error" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="register-footer">Already have an account? <Link to="/login">Log in</Link></p>
      </section>
    </main>
  )
}
