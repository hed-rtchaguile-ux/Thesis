import { Link } from 'react-router-dom'
import { useAuth } from './auth'

export default function ApplicantDashboard() {
  const { user, logout } = useAuth()

  return (
    <main className="dashboard-shell applicant-dashboard">
      <header className="dashboard-header">
        <Link className="brand" to="/applicant/dashboard"><span className="brand-mark">W</span><span>WedRings</span></Link>
        <div className="user-menu"><span>{user.name}</span><button type="button" onClick={logout}>Sign out</button></div>
      </header>
      <section className="dashboard-content">
        <p className="eyebrow">Applicant dashboard</p>
        <h1>Good morning, {user.name.split(' ')[0]}.</h1>
        <p className="dashboard-lead">Here is the latest view of your application journey.</p>
        <div className="status-banner"><span className="status-dot" /><div><strong>Application in review</strong><p>Your submitted application is being reviewed by our admissions team.</p></div><span className="status-date">Updated today</span></div>
        <div className="dashboard-grid">
          <article><p className="card-label">Application progress</p><strong className="metric">68%</strong><div className="progress-track"><span /></div><p>3 of 5 steps complete</p></article>
          <article><p className="card-label">Next step</p><strong className="card-title">Prepare for your interview</strong><p>We will contact you when an interview slot is available.</p><button className="text-button" type="button">View checklist <span aria-hidden="true">-&gt;</span></button></article>
          <article><p className="card-label">Messages</p><strong className="metric">02</strong><p>Unread updates from the admissions team.</p><button className="text-button" type="button">Open inbox <span aria-hidden="true">-&gt;</span></button></article>
        </div>
      </section>
    </main>
  )
}
