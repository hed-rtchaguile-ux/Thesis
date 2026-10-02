import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { NoticeManager, ReportCards } from './AdminTools'
import { filterApplications, sortAppointments } from './applicationSearch'
import { printExcelForm } from './printExcelForm'
import './ApplicantDashboard.css'

function getAppointmentDateKey(value) {
  if (!value || value === 'To be assigned by office') return ''

  const normalizedValue = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) return normalizedValue

  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalizedValue)
  if (!slashMatch) return ''

  const [, first, second, year] = slashMatch
  const firstNumber = Number(first)
  const secondNumber = Number(second)
  const month = firstNumber > 12 ? second : first
  const day = firstNumber > 12 ? first : second

  if (Number(month) > 12 || Number(day) > 31) return ''
  return `${year}-${month}-${day}`
}

export default function AdminDashboard({ view = 'dashboard' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loadError, setLoadError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [showAllApplications, setShowAllApplications] = useState(false)
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [licenseError, setLicenseError] = useState('')

  useEffect(() => {
    fetch('/api/applications')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load applications.')
        return response.json()
      })
      .then(setApplications)
      .catch((error) => {
        setApplications([])
        setLoadError(error.message)
      })
  }, [])

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  async function issueMarriageLicense(applicationId) {
    const licenseNumber = window.prompt('Enter the marriage license number to issue:')
    if (!licenseNumber?.trim()) return

    setLicenseError('')
    setUpdatingId(applicationId)
    try {
      const response = await fetch(`/api/applications/${applicationId}/license`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseNumber }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to issue marriage license.')
      setApplications((currentApplications) => currentApplications.map((application) => (
        application._id === result._id ? result : application
      )))
    } catch (error) {
      setLicenseError(error.message)
    } finally {
      setUpdatingId('')
    }
  }

  const pageFilter = view === 'verified' ? 'Verified' : 'all'
  const filteredApplications = pageFilter === 'all'
    ? applications
    : applications.filter((application) => application.status === pageFilter)
  const appointmentApplications = sortAppointments(applications, getAppointmentDateKey)
  const searchedApplications = filterApplications(view === 'appointments' ? appointmentApplications : filteredApplications, searchTerm)
  const visibleApplications = view !== 'dashboard' || showAllApplications ? searchedApplications : searchedApplications.slice(0, 3)
  const pageTitle = view === 'verified' ? 'Verified records.' : view === 'all' ? 'All applications.' : view === 'reports' ? 'Applicant reports.' : view === 'notices' ? 'Public notices.' : 'Application overview.'
  const pageDescription = view === 'verified' ? 'Review applications that have already been verified.' : view === 'all' ? 'Review every application submitted to the office.' : view === 'reports' ? 'Track applicant submissions by day, month, and year.' : view === 'notices' ? 'Publish couple photos on the public ten-day notice board.' : 'Here is an overview of your application workspace.'

  return (
    <main className="applicant-shell admin-applicant-shell">
      <aside className="applicant-sidebar">
        <div className="brand-row">
          <span className="brand-name">WEDRINGS</span>
        </div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          <button type="button" className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('/admin/dashboard')}><span className="nav-icon" aria-hidden="true">⌂</span><span>Dashboard</span></button>
          <button type="button" className={`nav-item ${view === 'verified' ? 'active' : ''}`} onClick={() => navigate('/admin/verified-records')}><span className="nav-icon" aria-hidden="true">✓</span><span>Verified Records</span></button>
          <button type="button" className={`nav-item ${view === 'all' ? 'active' : ''}`} onClick={() => navigate('/admin/all-applications')}><span className="nav-icon" aria-hidden="true">▤</span><span>All Applications</span></button>
          <button type="button" className={`nav-item ${view === 'appointments' ? 'active' : ''}`} onClick={() => navigate('/admin/appointments')}><span className="nav-icon" aria-hidden="true">▦</span><span>Appointments</span></button>
          <button type="button" className={`nav-item ${view === 'reports' ? 'active' : ''}`} onClick={() => navigate('/admin/reports')}><span className="nav-icon" aria-hidden="true">▤</span><span>Reports</span></button>
          <button type="button" className={`nav-item ${view === 'notices' ? 'active' : ''}`} onClick={() => navigate('/admin/notices')}><span className="nav-icon" aria-hidden="true">♡</span><span>10-day notices</span></button>
        </nav>
        <button className="logout-button" type="button" onClick={signOut}><span className="nav-icon" aria-hidden="true">⎋</span><span>Logout</span></button>
      </aside>

      <section className="applicant-main" id="admin-dashboard-top">
        <header className="topbar">
          <div className="topbar-main"><h1>Welcome, Administrator!</h1><p>{pageDescription}</p></div>
          <div className="topbar-user"><div className="user-avatar">PA</div><span>{user.name}</span><span className="admin-user-caret" aria-hidden="true">▾</span></div>
        </header>

        <div className="dashboard-panel admin-dashboard-panel">
          {view !== 'appointments' && view !== 'notices' && <div className="welcome-banner"><div className="banner-icon" aria-hidden="true">▤</div><div className="banner-copy"><h2>{pageTitle}</h2><p>Review submissions and verify completed applications.</p></div></div>}

          {view === 'appointments' && <section className="admin-appointment-panel" aria-label="Applicant appointment schedule">
            <div className="admin-appointment-panel-heading"><div><span className="admin-review-kicker">Read-only schedule</span><h2>Applicant appointments</h2></div><span>{applications.filter((application) => getAppointmentDateKey(application.appointmentDate)).length} scheduled</span></div>
            <p className="admin-schedule-readonly-note">All applicants are listed by appointment date and time. Applicants without a scheduled appointment appear at the end.</p>
          </section>}

          {(view === 'dashboard' || view === 'reports') && <ReportCards applications={applications} />}

          {view === 'notices' && <NoticeManager />}

          {view !== 'appointments' && view !== 'notices' && <div className="summary-grid">
            <article className="summary-card"><div className="card-icon" aria-hidden="true">▣</div><div className="summary-copy"><span>Pending Review</span><strong>{applications.filter((application) => application.status === 'For Review').length}</strong></div></article>
            <article className="summary-card"><div className="card-icon" aria-hidden="true">◫</div><div className="summary-copy"><span>All Applications</span><strong>{applications.length}</strong></div></article>
            <article className="summary-card" id="admin-verified"><div className="card-icon" aria-hidden="true">✓</div><div className="summary-copy"><span>Verified Records</span><strong>{applications.filter((application) => application.status === 'Verified').length}</strong></div></article>
          </div>}

          {view !== 'notices' && <section className="quick-actions admin-review-panel" id="admin-queue">
            <div className="admin-section-heading">
              <h3>{view === 'appointments' ? 'Scheduled applicants' : view === 'dashboard' ? 'Application Queue' : pageTitle.replace('.', '')}</h3>
              <input className="admin-applicant-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search names, email, or phone" aria-label="Search applicants" />
              {view === 'dashboard' && <button className="admin-view-button" type="button" onClick={() => setShowAllApplications((currentValue) => !currentValue)}>{showAllApplications ? 'Show recent' : 'View all'}</button>}
            </div>

            {loadError && <p className="admin-empty-state">{loadError}</p>}
            {!loadError && visibleApplications.length === 0 && <p className="admin-empty-state">{searchTerm ? 'No applicants match your search.' : 'No submitted applicants yet.'}</p>}
            {licenseError && <p className="admin-appointment-error" role="alert">{licenseError}</p>}
            {!loadError && visibleApplications.map((application) => {
              const detailsOpen = selectedApplicationId === application._id

              return (
                <div key={application._id}>
                  <div className="admin-application-row">
                    <span className="admin-avatar">{application.groomFullName?.slice(0, 1)}{application.brideFullName?.slice(0, 1)}</span>
                    <div className="admin-application-copy">
                      <strong>{application.groomFullName} &amp; {application.brideFullName}</strong>
                      <small>{application.applicantEmail}</small>
                      {view === 'appointments' && <small className="admin-schedule-date">{application.appointmentDate ? `${application.appointmentDate} · ${application.appointmentTime || 'Time not set'}` : 'Appointment not scheduled'}</small>}
                    </div>
                    <button className="admin-details-button" type="button" onClick={() => setSelectedApplicationId((currentId) => currentId === application._id ? '' : application._id)}>
                      {detailsOpen ? 'Hide details' : 'View details'}
                    </button>
                    {view !== 'appointments' && (application.marriageLicenseIssuedAt ? <span className="license-issued-label">License issued: {application.marriageLicenseNumber}</span> : application.status === 'Verified' && <button className="admin-verify-button" type="button" onClick={() => issueMarriageLicense(application._id)} disabled={updatingId === application._id}>{updatingId === application._id ? 'Issuing...' : 'Issue license'}</button>)}
                  </div>
                  {detailsOpen && <ApplicationDetails application={application} />}
                </div>
              )
            })}
          </section>}
        </div>
      </section>
    </main>
  )
}

function ApplicationDetails({ application }) {
  const documents = Object.entries(application.documents || {})

  return (
    <div className="admin-details-panel">
      <div className="admin-details-group"><h4>Groom information</h4><p><strong>Name:</strong> {application.groomFullName || 'Not provided'}</p><p><strong>Date of birth:</strong> {application.groomDob || 'Not provided'}</p><p><strong>Gender:</strong> {application.groomGender || 'Not provided'}</p><p><strong>Civil status:</strong> {application.groomCivilStatus || 'Not provided'}</p><p><strong>Mobile:</strong> {application.groomMobile || 'Not provided'}</p><p><strong>Email:</strong> {application.groomEmail || 'Not provided'}</p></div>
      <div className="admin-details-group"><h4>Bride information</h4><p><strong>Name:</strong> {application.brideFullName || 'Not provided'}</p><p><strong>Date of birth:</strong> {application.brideDob || 'Not provided'}</p><p><strong>Gender:</strong> {application.brideGender || 'Not provided'}</p><p><strong>Civil status:</strong> {application.brideCivilStatus || 'Not provided'}</p><p><strong>Mobile:</strong> {application.brideMobile || 'Not provided'}</p><p><strong>Email:</strong> {application.brideEmail || 'Not provided'}</p></div>
      <div className="admin-details-group"><h4>Appointment and payment</h4><p><strong>Date:</strong> {application.appointmentDate || 'Not provided'}</p><p><strong>Time:</strong> {application.appointmentTime || 'Not provided'}</p><p><strong>Location:</strong> {application.appointmentLocation || 'Not provided'}</p><p><strong>Payment:</strong> {application.paymentMethod || 'Not provided'}</p><p><strong>Amount:</strong> {application.paymentAmount || 'Not provided'}</p><p><strong>Status:</strong> {application.status || 'For Review'}</p></div>
      <div className="admin-details-group"><h4>Marriage license</h4><p><strong>Number:</strong> {application.marriageLicenseNumber || 'Not issued'}</p><p><strong>Issued:</strong> {application.marriageLicenseIssuedAt ? new Date(application.marriageLicenseIssuedAt).toLocaleDateString() : 'Not issued'}</p></div>
      <div className="admin-details-group"><h4>Submitted documents</h4>{documents.length > 0 ? documents.map(([key, value]) => <p key={key}><strong>{key}:</strong> {value}</p>) : <p>No documents listed.</p>}</div>
      <div className="admin-print-actions"><button type="button" className="admin-details-button" onClick={() => printExcelForm(application._id)}>Print form</button></div>
    </div>
  )
}
