import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import './ApplicantDashboard.css'

export default function AdminDashboard({ view = 'dashboard' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [updatingId, setUpdatingId] = useState('')
  const [showAllApplications, setShowAllApplications] = useState(false)
  const [selectedApplicationId, setSelectedApplicationId] = useState('')

  useEffect(() => {
    fetch('/api/applications')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load applications.')
        return response.json()
      })
      .then(setApplications)
      .catch(() => setApplications([]))
  }, [])

  async function updateApplicationStatus(applicationId, status) {
    setUpdatingId(applicationId)

    try {
      const response = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) throw new Error('Unable to update application status.')

      const updatedApplication = await response.json()
      setApplications((currentApplications) => currentApplications.map((application) => (
        application._id === updatedApplication._id ? updatedApplication : application
      )))
    } finally {
      setUpdatingId('')
    }
  }

  function verifyApplication(applicationId) {
    return updateApplicationStatus(applicationId, 'Verified')
  }

  function rejectApplication(applicationId) {
    return updateApplicationStatus(applicationId, 'Rejected')
  }

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  const pageFilter = view === 'verified' ? 'Verified' : view === 'new' ? 'For Review' : 'all'
  const filteredApplications = pageFilter === 'all'
    ? applications
    : applications.filter((application) => application.status === pageFilter)
  const visibleApplications = view !== 'dashboard' || showAllApplications ? filteredApplications : filteredApplications.slice(0, 3)
  const pageTitle = view === 'verified' ? 'Verified records.' : view === 'new' ? 'New submissions.' : view === 'all' ? 'All applications.' : 'Application overview.'
  const pageDescription = view === 'verified' ? 'Review applications that have already been verified.' : view === 'new' ? 'Review applications waiting for verification.' : view === 'all' ? 'Review every application submitted to the office.' : 'Here is an overview of your application workspace.'

  return (
    <main className="applicant-shell admin-applicant-shell">
      <aside className="applicant-sidebar">
        <div className="brand-row">
          <Link className="brand-name" to="/admin/dashboard"><span className="brand-mark">W</span></Link>
        </div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          <Link className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} to="/admin/dashboard"><span className="nav-icon" aria-hidden="true">⌂</span><span>Dashboard</span></Link>
          <Link className={`nav-item ${view === 'verified' ? 'active' : ''}`} to="/admin/verified-records"><span className="nav-icon" aria-hidden="true">✓</span><span>Verified Records</span></Link>
          <Link className={`nav-item ${view === 'all' ? 'active' : ''}`} to="/admin/all-applications"><span className="nav-icon" aria-hidden="true">▤</span><span>All Applications</span></Link>
          <Link className={`nav-item ${view === 'new' ? 'active' : ''}`} to="/admin/new-submissions"><span className="nav-icon" aria-hidden="true">◫</span><span>New Submissions</span></Link>
        </nav>
        <button className="logout-button" type="button" onClick={signOut}><span className="nav-icon" aria-hidden="true">⎋</span><span>Logout</span></button>
      </aside>

      <section className="applicant-main" id="admin-dashboard-top">
        <header className="topbar">
          <div className="topbar-main"><h1>Welcome, Administrator!</h1><p>{pageDescription}</p></div>
          <div className="topbar-user"><div className="user-avatar">PA</div><span>{user.name}</span><span className="admin-user-caret" aria-hidden="true">▾</span></div>
        </header>

        <div className="dashboard-panel admin-dashboard-panel">
          <div className="welcome-banner"><div className="banner-icon" aria-hidden="true">▤</div><div className="banner-copy"><h2>{pageTitle}</h2><p>Review submissions and verify completed applications.</p></div></div>

          <div className="summary-grid">
            <article className="summary-card"><div className="card-icon" aria-hidden="true">▣</div><div className="summary-copy"><span>New Submissions</span><strong>{applications.filter((application) => application.status === 'For Review').length}</strong></div></article>
            <article className="summary-card"><div className="card-icon" aria-hidden="true">◫</div><div className="summary-copy"><span>All Applications</span><strong>{applications.length}</strong></div></article>
            <article className="summary-card" id="admin-verified"><div className="card-icon" aria-hidden="true">✓</div><div className="summary-copy"><span>Verified Records</span><strong>{applications.filter((application) => application.status === 'Verified').length}</strong></div></article>
          </div>

          <section className="quick-actions admin-review-panel" id="admin-queue"><div className="admin-section-heading"><h3>{view === 'dashboard' ? 'Application Queue' : pageTitle.replace('.', '')}</h3><button className="admin-view-button" type="button" onClick={() => setShowAllApplications((currentValue) => !currentValue)}>{showAllApplications ? 'Show recent' : 'View all'}</button></div>{visibleApplications.map((application, index) => { const detailsOpen = selectedApplicationId === application._id || (view !== 'dashboard' && !selectedApplicationId && index === 0); return <div key={application._id}><div className="admin-application-row"><span className="admin-avatar">{application.groomFullName?.slice(0, 1)}{application.brideFullName?.slice(0, 1)}</span><div className="admin-application-copy"><strong>{application.groomFullName} &amp; {application.brideFullName}</strong><small>{application.applicantEmail}</small></div><button className="admin-details-button" type="button" onClick={() => setSelectedApplicationId((currentId) => currentId === application._id ? '' : application._id)}>{detailsOpen ? 'Hide details' : 'View details'}</button><button className="admin-verify-button" type="button" onClick={() => verifyApplication(application._id)} disabled={application.status === 'Verified' || updatingId === application._id}>{updatingId === application._id ? 'Updating...' : application.status === 'Verified' ? 'Verified' : 'Verify'}</button></div>{detailsOpen && <ApplicationDetails application={application} onVerify={verifyApplication} onReject={rejectApplication} updatingId={updatingId} />}</div> })}</section>
        </div>
      </section>
    </main>
  )
}

function ApplicationDetails({ application, onVerify, onReject, updatingId }) {
  const documents = Object.entries(application.documents || {})

  return (
    <div className="admin-details-panel">
      <div className="admin-details-group"><h4>Groom information</h4><p><strong>Name:</strong> {application.groomFullName || 'Not provided'}</p><p><strong>Date of birth:</strong> {application.groomDob || 'Not provided'}</p><p><strong>Gender:</strong> {application.groomGender || 'Not provided'}</p><p><strong>Civil status:</strong> {application.groomCivilStatus || 'Not provided'}</p><p><strong>Mobile:</strong> {application.groomMobile || 'Not provided'}</p><p><strong>Email:</strong> {application.groomEmail || 'Not provided'}</p></div>
      <div className="admin-details-group"><h4>Bride information</h4><p><strong>Name:</strong> {application.brideFullName || 'Not provided'}</p><p><strong>Date of birth:</strong> {application.brideDob || 'Not provided'}</p><p><strong>Gender:</strong> {application.brideGender || 'Not provided'}</p><p><strong>Civil status:</strong> {application.brideCivilStatus || 'Not provided'}</p><p><strong>Mobile:</strong> {application.brideMobile || 'Not provided'}</p><p><strong>Email:</strong> {application.brideEmail || 'Not provided'}</p></div>
      <div className="admin-details-group"><h4>Appointment and payment</h4><p><strong>Date:</strong> {application.appointmentDate || 'Not provided'}</p><p><strong>Time:</strong> {application.appointmentTime || 'Not provided'}</p><p><strong>Location:</strong> {application.appointmentLocation || 'Not provided'}</p><p><strong>Payment:</strong> {application.paymentMethod || 'Not provided'}</p><p><strong>Amount:</strong> {application.paymentAmount || 'Not provided'}</p><p><strong>Status:</strong> {application.status || 'For Review'}</p></div>
      <div className="admin-details-group"><h4>Submitted documents</h4>{documents.length > 0 ? documents.map(([key, value]) => <p key={key}><strong>{key}:</strong> {value}</p>) : <p>No documents listed.</p>}</div>
      {application.status === 'For Review' && <div className="admin-details-actions"><button type="button" className="admin-reject-button" onClick={() => onReject(application._id)} disabled={updatingId === application._id}>{updatingId === application._id ? 'Updating...' : 'Reject'}</button><button type="button" className="admin-verify-button" onClick={() => onVerify(application._id)} disabled={updatingId === application._id}>Verify</button></div>}
    </div>
  )
}
