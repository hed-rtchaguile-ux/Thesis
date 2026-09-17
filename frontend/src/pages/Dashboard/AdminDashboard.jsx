import { useNavigate } from 'react-router-dom'
import logoImage from '../../assets/log.png'
import { useAuth } from '../auth'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const firstName = displayName.split(' ')[0]
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()

  const navigation = [
    { label: 'Overview', active: true, icon: '⌂' },
    { label: 'Applications', icon: '✎' },
    { label: 'Queue', icon: '🗓' },
    { label: 'Reports', icon: '◉' },
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

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${item.active ? 'active' : ''}`}
            >
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
            <p>Here’s an overview of the records that need your attention today.</p>
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
              <h2>Application overview</h2>
              <p>Keep track of incoming submissions, review queues, and deadlines.</p>
            </div>
          </div>

          <div className="summary-grid admin-summary-grid">
            <article className="summary-card admin-summary-card">
              <div className="card-icon" aria-hidden="true">▣</div>
              <div className="summary-copy">
                <span>New submissions</span>
                <strong>24</strong>
                <small className="trend">+12% this week</small>
              </div>
            </article>

            <article className="summary-card admin-summary-card">
              <div className="card-icon" aria-hidden="true">◩</div>
              <div className="summary-copy">
                <span>In review</span>
                <strong>86</strong>
                <small>Across all programs</small>
              </div>
            </article>

            <article className="summary-card admin-summary-card">
              <div className="card-icon" aria-hidden="true">🗓</div>
              <div className="summary-copy">
                <span>Decisions due</span>
                <strong>09</strong>
                <small className="warning">Within 7 days</small>
              </div>
            </article>
          </div>

          <section className="review-list">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Queue</p>
                <h2>Recent applications</h2>
              </div>
              <button className="outline-button" type="button">View all</button>
            </div>

            <div className="application-row">
              <span className="avatar">ML</span>
              <div>
                <strong>Maria Lim</strong>
                <p>Master of Business Administration</p>
              </div>
              <span className="review-status">Needs review</span>
            </div>

            <div className="application-row">
              <span className="avatar">JR</span>
              <div>
                <strong>Joshua Reyes</strong>
                <p>Bachelor of Computer Science</p>
              </div>
              <span className="review-status">Interview scheduled</span>
            </div>

            <div className="application-row">
              <span className="avatar">SC</span>
              <div>
                <strong>Sofia Cruz</strong>
                <p>Bachelor of Arts in Communication</p>
              </div>
              <span className="review-status">New submission</span>
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
