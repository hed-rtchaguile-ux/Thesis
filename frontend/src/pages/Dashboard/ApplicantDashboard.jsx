import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import './ApplicantDashboard.css'

export default function ApplicantDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const firstName = displayName.split(' ')[0]
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [application, setApplication] = useState({ status: 'No applications', items: 0, appointment: 'None' })

  useEffect(() => {
    async function loadApplications() {
      const response = await fetch(`/api/applications?applicantEmail=${encodeURIComponent(user.email)}`)
      if (!response.ok) return

      const applications = await response.json()
      const latestApplication = applications[0]
      setApplication({
        status: latestApplication?.status || 'No applications',
        items: applications.length,
        appointment: latestApplication?.appointmentDate && latestApplication.appointmentDate !== 'To be assigned by office'
          ? latestApplication.appointmentDate
          : 'None',
      })
    }

    loadApplications().catch(() => setApplication({ status: 'Unable to load', items: 0, appointment: 'None' }))
  }, [user.email])

  const navigation = [
    { label: 'Dashboard', active: true, icon: '⌂' },
    { label: 'New Application', icon: '✎' },
    { label: 'My Appointments', icon: '🗓' },
    { label: 'Profile', icon: '◉' },
  ]

  return (
    <section className="applicant-main">
        <header className="topbar">
          <div className="topbar-main">
            <h1>Welcome, {firstName}!</h1>
            <p>Here’s an overview of your marriage registration.</p>
          </div>

          <div className="topbar-user">
            <div className="user-avatar">{initials}</div>
            <span>{displayName}</span>
            <button type="button" className="mini-button" aria-label="Open user menu">▾</button>
          </div>
        </header>

        <div className="dashboard-panel">
          <div className="welcome-banner">
            <div className="banner-icon" aria-hidden="true">▤</div>
            <div className="banner-copy">
              <h2>Start your forever, together.</h2>
              <p>Complete your application in 6 easy steps.</p>
            </div>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <div className="card-icon" aria-hidden="true">▣</div>
              <div className="summary-copy">
                <span>My Applications</span>
                <strong>{application.items}</strong>
              </div>
            </article>

            <article className="summary-card">
              <div className="card-icon" aria-hidden="true">🗓</div>
              <div className="summary-copy">
                <span>Upcoming Appointment</span>
                <strong>{application.appointment}</strong>
              </div>
            </article>

            <article className="summary-card">
              <div className="card-icon" aria-hidden="true">◩</div>
              <div className="summary-copy">
                <span>Recent Status</span>
                <strong>{application.status}</strong>
              </div>
            </article>
          </div>

          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <button type="button" className="quick-action-btn" onClick={() => navigate('/applicant/registration')}>
              <span className="quick-icon" aria-hidden="true">✎</span>
              <span>
                <strong>Start New Application</strong>
                <small>Begin your marriage registration process.</small>
              </span>
              <span className="arrow" aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      </section>
  )
}
