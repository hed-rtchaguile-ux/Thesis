import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export default function AdminDashboard() {
  const { user, logout } = useAuth()

  return (
    <main className="dashboard-shell admin-dashboard">
      <header className="dashboard-header">
        <Link className="brand" to="/admin/dashboard"><span className="brand-mark">W</span><span>WedRings <small>ADMIN</small></span></Link>
        <div className="user-menu"><span>{user.name}</span><button type="button" onClick={logout}>Sign out</button></div>
      </header>
      <section className="dashboard-content">
        <p className="eyebrow">Administration workspace</p>
        <h1>Application overview.</h1>
        <p className="dashboard-lead">A focused view of the records that need your attention today.</p>
        <div className="admin-stats"><article><p>New submissions</p><strong>24</strong><span className="trend">+12% this week</span></article><article><p>In review</p><strong>86</strong><span>Across all programs</span></article><article><p>Decisions due</p><strong>09</strong><span className="warning">Within 7 days</span></article></div>
        <section className="review-list"><div className="section-heading"><div><p className="eyebrow">Queue</p><h2>Recent applications</h2></div><button className="outline-button" type="button">View all</button></div><div className="application-row"><span className="avatar">ML</span><div><strong>Maria Lim</strong><p>Master of Business Administration</p></div><span className="review-status">Needs review</span></div><div className="application-row"><span className="avatar">JR</span><div><strong>Joshua Reyes</strong><p>Bachelor of Computer Science</p></div><span className="review-status">Interview scheduled</span></div><div className="application-row"><span className="avatar">SC</span><div><strong>Sofia Cruz</strong><p>Bachelor of Arts in Communication</p></div><span className="review-status">New submission</span></div></section>
      </section>
    </main>
  )
}
