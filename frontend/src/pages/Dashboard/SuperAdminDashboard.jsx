import { useNavigate } from 'react-router-dom'
import logoImage from '../../assets/log.png'
import { useAuth } from '../auth'
import './AdminDashboard.css'

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const firstName = displayName.split(' ')[0]
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()

  const navigation = [
    { label: 'Overview', active: true, icon: '⌂' },
    { label: 'All Applications', icon: '✎' },
    { label: 'Final Approval', icon: '✓' },
    { label: 'Reports', icon: '◉' },
  ]

  const approvals = [
    { name: 'Maria Lim', program: 'Master of Business Administration', status: 'Pending final approval' },
    { name: 'Joshua Reyes', program: 'Bachelor of Computer Science', status: 'Awaiting review' },
    { name: 'Sofia Cruz', program: 'Bachelor of Arts in Communication', status: 'Final approved' },
  ]

  return (
    <div className="applicant-shell admin-shell">
      <aside className="applicant-sidebar admin-sidebar">
        <div className="brand-row admin-brand-row">
          <span className="brand-mark" aria-label="WedRings logo">
            <img src={logoImage} alt="WedRings logo" className="brand-logo" />
          </span>
          <span className="brand-name">WEDRINGS</span>
        </div>

        <nav className="sidebar-nav" aria-label="Super admin navigation">
          {navigation.map((item) => (
            <button key={item.label} type="button" className={`nav-item ${item.active ? 'active' : ''}`}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="logout-button"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          <span className="nav-icon" aria-hidden="true">⎋</span>
          <span>Logout</span>
        </button>
      </aside>

      <section className="applicant-main admin-main">
        <header className="topbar">
          <div className="topbar-main">
            <h1>Welcome, {firstName}!</h1>
            <p>Final approval and system-wide oversight for all applications.</p>
          </div>

          <div className="topbar-user">
            <div className="user-avatar">{initials}</div>
            <span>{displayName}</span>
            <button type="button" className="mini-button" aria-label="Open user menu">▾</button>
          </div>
        </header>

        <div className="dashboard-panel">
          <div className="welcome-banner admin-welcome-banner">
            <div className="banner-icon" aria-hidden="true">▤</div>
            <div className="banner-copy">
              <h2>Super admin control</h2>
              <p>Review final approvals and access the full administrative queue.</p>
            </div>
          </div>

          <div className="summary-grid admin-summary-grid">
            <article className="summary-card admin-summary-card">
              <div className="card-icon" aria-hidden="true">▣</div>
              <div className="summary-copy">
                <span>Total applications</span>
                <strong>142</strong>
                <small className="trend">+18% this month</small>
              </div>
            </article>

            <article className="summary-card admin-summary-card">
              <div className="card-icon" aria-hidden="true">✓</div>
              <div className="summary-copy">
                <span>Final approvals</span>
                <strong>38</strong>
                <small>Across all offices</small>
              </div>
            </article>

            <article className="summary-card admin-summary-card">
              <div className="card-icon" aria-hidden="true">🗓</div>
              <div className="summary-copy">
                <span>Pending review</span>
                <strong>12</strong>
                <small className="warning">Needs action</small>
              </div>
            </article>
          </div>

          <section className="review-list">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Final approval</p>
                <h2>Approval queue</h2>
              </div>
              <button className="outline-button" type="button">Review all</button>
            </div>

            {approvals.map(({ name, program, status }) => (
              <div key={name} className="application-row">
                <span className="avatar">{name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{name}</strong>
                  <p>{program}</p>
                </div>
                <span className="review-status">{status}</span>
              </div>
            ))}
          </section>
        </div>
      </section>
    </div>
  )
}
