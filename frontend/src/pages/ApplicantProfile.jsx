import { useNavigate } from 'react-router-dom'
import { useAuth } from './auth'
import './ApplicantProfile.css'

export default function ApplicantProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.name || 'User'
  const initials = displayName
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const applicantInfo = [
    { label: 'Full Name', value: displayName },
    { label: 'Email', value: user?.email || 'Not available' },
    { label: 'Role', value: 'Applicant' },
    { label: 'Status', value: 'Active' },
  ]

  return (
    <main className="profile-page">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Applicant Profile</h1>
        </div>

        <button type="button" className="primary-button" onClick={() => navigate('/applicant/dashboard')}>
          Back to Dashboard
        </button>
      </header>

      <section className="profile-card">
        <div className="profile-summary">
          <div className="profile-avatar">{initials}</div>
          <div>
            <h2>{displayName}</h2>
            <p>Marriage registration applicant</p>
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
        </div>

        <div className="profile-actions">
          <button type="button" className="secondary-button">Edit Profile</button>
          <button type="button" className="secondary-button">Change Password</button>
        </div>
      </section>
    </main>
  )
}
