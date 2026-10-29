import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from './auth'
import './ApplicantProfile.css'

export default function ApplicantProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const displayName = user?.name || 'User'
  const accountRole = user?.role || 'applicant'
  const roleLabel = accountRole === 'superadmin' ? 'Super Admin' : accountRole === 'admin' ? 'Admin' : 'Applicant'
  const dashboardPath = accountRole === 'superadmin' ? '/superadmin/dashboard' : accountRole === 'admin' ? '/admin/dashboard' : '/applicant/dashboard'
  const initials = displayName
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const applicantInfo = [
    { label: 'Full Name', value: displayName },
    { label: 'Email', value: user?.email || 'Not available' },
    { label: 'Role', value: roleLabel },
    { label: 'Status', value: 'Active' },
  ]

  async function handleChangePassword(event) {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setIsChangingPassword(true)
    try {
      const response = await apiFetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword,
        }),
      })
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        if (response.status === 404) {
          throw new Error('Password change is not available on the running server yet. Restart the backend and try again.')
        }
        throw new Error('The server returned an unexpected response. Please try again later.')
      }

      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to change your password.')

      setPasswordMessage(result.message)
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setPasswordError(error.message || 'Unable to change your password.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  return (
    <main className={`profile-page ${accountRole !== 'applicant' ? 'staff-profile-page' : ''}`}>
      <header className="profile-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>{roleLabel} Profile</h1>
        </div>

        <button type="button" className="primary-button" onClick={() => navigate(dashboardPath)}>
          Back to Dashboard
        </button>
      </header>

      <section className="profile-card">
        <div className="profile-summary">
          <div className="profile-avatar">{initials}</div>
          <div>
            <h2>{displayName}</h2>
            <p>{accountRole === 'applicant' ? 'Marriage registration applicant' : `${roleLabel} account`}</p>
          </div>
        </div>

        <div className="profile-grid">
          <div className="info-panel">
            <h3>Personal Information</h3>
            <div className="info-list">
              {applicantInfo.map((item) => (
                <div key={item.label} className="info-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

          {accountRole === 'applicant' && (
            <div className="info-panel">
              <h3>Application Summary</h3>
              <div className="summary-boxes">
                <div className="mini-box">
                  <span>Latest Status</span>
                  <strong>In Review</strong>
                </div>
                <div className="mini-box">
                  <span>Appointment</span>
                  <strong>To be assigned</strong>
                </div>
                <div className="mini-box">
                  <span>Submitted</span>
                  <strong>1 application</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {accountRole === 'applicant' && <div className="profile-actions">
          <button type="button" className="secondary-button">Edit Profile</button>
        </div>}

        <section className="change-password-panel" aria-labelledby="change-password-title">
          <div className="change-password-heading">
            <h3 id="change-password-title">Change Password</h3>
            <p>Enter your current password, then choose a new password.</p>
          </div>
          <form className="change-password-form" onSubmit={handleChangePassword}>
            <label>
              Old password
              <input
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={passwords.newPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={passwords.confirmPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))}
                required
              />
            </label>
            {passwordError && <p className="change-password-error" role="alert">{passwordError}</p>}
            {passwordMessage && <p className="change-password-success" role="status">{passwordMessage}</p>}
            <button type="submit" className="primary-button" disabled={isChangingPassword}>
              {isChangingPassword ? 'Changing password...' : 'Update Password'}
            </button>
          </form>
        </section>
      </section>
    </main>
  )
}
