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
  const [applications, setApplications] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    async function loadApplications() {
      const response = await fetch(`/api/applications?applicantEmail=${encodeURIComponent(user.email)}`)
      if (!response.ok) return

      const fetchedApplications = await response.json()
      const latestApplication = fetchedApplications[0]
      setApplications(fetchedApplications)
      setApplication({
        status: latestApplication?.status || 'No applications',
        items: fetchedApplications.length,
        appointment: latestApplication?.appointmentDate && latestApplication.appointmentDate !== 'To be assigned by office'
          ? latestApplication.appointmentDate
          : 'None',
      })
    }

    loadApplications().catch(() => {
      setApplications([])
      setApplication({ status: 'Unable to load', items: 0, appointment: 'None' })
    })
  }, [user.email])

  const navigation = [
    { label: 'My Appointments',active: true, icon: '🗓' },
    { label: 'New Application', icon: '✎' },
    { label: 'Profile', icon: '◉' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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

            <div className="user-menu-wrapper">
              <button
                type="button"
                className="mini-button"
                aria-label="Open user menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                ▾
              </button>

              {menuOpen && (
                <div className="user-dropdown" role="menu" aria-label="User actions">
                  <button type="button" className="dropdown-item" onClick={() => {
                    setMenuOpen(false)
                    navigate('/applicant/profile')
                  }}>
                    Profile
                  </button>
                  <button type="button" className="dropdown-item danger" onClick={() => {
                    setMenuOpen(false)
                    handleLogout()
                  }}>
                    Logout
                  </button>
                </div>
              )}
            </div>
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

          {applications.length > 0 && (
            <div className="application-history">
              <h3>My Applications</h3>
              <div className="application-list">
                {applications.map((item, index) => {
                  const coupleNames = [item.groomFullName, item.brideFullName].filter(Boolean).join(' & ') || 'Couple'

                  return (
                    <div key={`${item._id || item.applicantEmail || index}`} className="application-item">
                      <div>
                        <span className="application-label">Couple</span>
                        <strong>{coupleNames}</strong>
                      </div>
                      <div>
                        <span className="application-label">Status</span>
                        <strong>{item.status || 'For Review'}</strong>
                      </div>
                      <div>
                        <span className="application-label">Appointment</span>
                        <strong>{item.appointmentDate || 'To be assigned by office'}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
