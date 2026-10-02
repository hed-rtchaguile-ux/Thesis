import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { NoticeManager, ReportCards } from './AdminTools'
import { filterApplications, sortAppointments } from './applicationSearch'
import './ApplicantDashboard.css'
import OfficialApplicationForm from './OfficialApplicationForm'

function getAppointmentDateKey(value) {
  if (!value || value === 'To be assigned by office') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return ''
  const [, first, second, year] = match
  const month = Number(first) > 12 ? second : first
  const day = Number(first) > 12 ? first : second
  return `${year}-${month}-${day}`
}

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const displayName = user?.name || 'User'
  const firstName = displayName.split(' ')[0]
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [applications, setApplications] = useState([])
  const [updatingId, setUpdatingId] = useState('')
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [updatingDocumentKey, setUpdatingDocumentKey] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [licenseError, setLicenseError] = useState('')

  useEffect(() => {
    fetch('/api/applications')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load applications.')
        return response.json()
      })
      .then((fetchedApplications) => setApplications(Array.isArray(fetchedApplications) ? fetchedApplications : []))
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

  function confirmRejection(applicationId) {
    const confirmed = window.confirm('Reject this submitted application? The applicant will be notified and asked to make the required changes.')
    if (confirmed) updateApplicationStatus(applicationId, 'Rejected')
  }

  function confirmVerification(applicationId) {
    const confirmed = window.confirm('Verify this submitted application? This finalizes the application as verified.')
    if (confirmed) updateApplicationStatus(applicationId, 'Verified')
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

  async function updateDocumentReview(applicationId, documentKey, reviewStatus, reviewNote = '') {
    setUpdatingDocumentKey(documentKey)
    try {
      const response = await fetch(`/api/applications/${applicationId}/documents/${documentKey}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus, reviewNote }),
      })
      if (!response.ok) throw new Error('Unable to update document review.')
      const updatedApplication = await response.json()
      setApplications((currentApplications) => currentApplications.map((application) => (
        application._id === updatedApplication._id ? updatedApplication : application
      )))
    } finally {
      setUpdatingDocumentKey('')
    }
  }

  const pendingCount = applications.filter((application) => application.status === 'For Review').length
  const verifiedCount = applications.filter((application) => application.status === 'Verified').length
  const selectedApplication = applications.find((application) => application._id === selectedApplicationId)
  const isAppointmentsPage = location.pathname === '/superadmin/appointments'
  const isReportsPage = location.pathname === '/superadmin/reports'
  const isNoticesPage = location.pathname === '/superadmin/notices'
  const appointmentApplications = sortAppointments(applications, getAppointmentDateKey)
  const visibleApplications = filterApplications(isAppointmentsPage ? appointmentApplications : applications, searchTerm)

  return (
    <main className="applicant-shell admin-applicant-shell">
      <aside className="applicant-sidebar">
        <div className="brand-row">
          <span className="brand-name">WEDRINGS</span>
        </div>

        <nav className="sidebar-nav" aria-label="Super admin navigation">
          <button type="button" className={`nav-item ${!isAppointmentsPage && !isReportsPage && !isNoticesPage ? 'active' : ''}`} onClick={() => navigate('/superadmin/dashboard')}>
            <span className="nav-icon" aria-hidden="true">⌂</span>
            <span>Dashboard</span>
          </button>
          <button type="button" className={`nav-item ${isAppointmentsPage ? 'active' : ''}`} onClick={() => navigate('/superadmin/appointments')}>
            <span className="nav-icon" aria-hidden="true">▦</span>
            <span>Appointments</span>
          </button>
          <button type="button" className={`nav-item ${isReportsPage ? 'active' : ''}`} onClick={() => navigate('/superadmin/reports')}><span className="nav-icon" aria-hidden="true">▤</span><span>Reports</span></button>
          <button type="button" className={`nav-item ${isNoticesPage ? 'active' : ''}`} onClick={() => navigate('/superadmin/notices')}><span className="nav-icon" aria-hidden="true">♡</span><span>10-day notices</span></button>
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

      <section className="applicant-main" id="admin-dashboard-top">
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

        <div className="dashboard-panel admin-dashboard-panel">
          {!isAppointmentsPage && !isNoticesPage && <div className="welcome-banner">
            <div className="banner-icon" aria-hidden="true">▤</div>
            <div className="banner-copy">
              <h2>Super admin control</h2>
              <p>Only the super admin can verify or reject applicants.</p>
            </div>
          </div>}

          {isAppointmentsPage && <section className="admin-appointment-panel" aria-label="Applicant appointment schedule">
            <div className="admin-appointment-panel-heading"><div><span className="admin-review-kicker">Read-only schedule</span><h2>Applicant appointments</h2></div><span>{applications.filter((application) => getAppointmentDateKey(application.appointmentDate)).length} scheduled</span></div>
            <p className="admin-schedule-readonly-note">All applicants are listed by appointment date and time. Applicants without a scheduled appointment appear at the end.</p>
          </section>}

          {(location.pathname === '/superadmin/dashboard' || isReportsPage) && <ReportCards applications={applications} />}

          {isNoticesPage && <NoticeManager />}

          {!isAppointmentsPage && !isNoticesPage && <div className="summary-grid">
            <article className="summary-card">
              <div className="card-icon" aria-hidden="true">▣</div>
              <div className="summary-copy">
                <span>Total applications</span>
                <strong>{applications.length}</strong>
              </div>
            </article>

            <article className="summary-card">
              <div className="card-icon" aria-hidden="true">✓</div>
              <div className="summary-copy">
                <span>Verified</span>
                <strong>{verifiedCount}</strong>
              </div>
            </article>

            <article className="summary-card">
              <div className="card-icon" aria-hidden="true">🗓</div>
              <div className="summary-copy">
                <span>Pending review</span>
                <strong>{pendingCount}</strong>
              </div>
            </article>
          </div>}

          {!isNoticesPage && <section className="quick-actions admin-review-panel" id="admin-queue">
            <div className="admin-section-heading">
              <h3>{isAppointmentsPage ? 'Scheduled applicants' : isReportsPage ? 'Applicants' : 'Verification Queue'}</h3>
              <input className="admin-applicant-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search names, email, or phone" aria-label="Search applicants" />
            </div>

            {licenseError && <p className="admin-appointment-error" role="alert">{licenseError}</p>}
            {visibleApplications.length === 0 && <p className="admin-empty-state">{searchTerm ? 'No applicants match your search.' : 'No submitted applicants yet.'}</p>}

            {visibleApplications.map((application) => {
              return (
                <div key={application._id}>
                  <div className="admin-application-row">
                    <span className="admin-avatar">{application.groomFullName?.slice(0, 1)}{application.brideFullName?.slice(0, 1)}</span>
                    <div className="admin-application-copy">
                      <strong>{application.groomFullName} &amp; {application.brideFullName}</strong>
                      <small>{application.applicantEmail}</small>
                    </div>
                    <button className="admin-details-button" type="button" onClick={() => setSelectedApplicationId((currentId) => currentId === application._id ? '' : application._id)}>{selectedApplicationId === application._id ? 'Hide details' : 'View details'}</button>
                    {isAppointmentsPage && <small className="admin-schedule-date">{application.appointmentDate ? `${application.appointmentDate} · ${application.appointmentTime || 'Time not set'}` : 'Appointment not scheduled'}</small>}
                    {!isAppointmentsPage && <>
                      <button className="admin-verify-button" type="button" onClick={() => confirmVerification(application._id)} disabled={application.status === 'Verified' || application.status === 'Rejected' || updatingId === application._id}>{updatingId === application._id ? 'Updating...' : application.status === 'Verified' ? 'Verified' : 'Verify'}</button>
                      <button className="admin-reject-button" type="button" onClick={() => confirmRejection(application._id)} disabled={application.status === 'Verified' || application.status === 'Rejected' || updatingId === application._id}>{updatingId === application._id ? 'Updating...' : application.status === 'Rejected' ? 'Rejected' : 'Reject'}</button>
                      {application.marriageLicenseIssuedAt ? <span className="license-issued-label">License issued: {application.marriageLicenseNumber}</span> : application.status === 'Verified' && <button className="admin-verify-button" type="button" onClick={() => issueMarriageLicense(application._id)} disabled={updatingId === application._id}>{updatingId === application._id ? 'Issuing...' : 'Issue license'}</button>}
                    </>}
                  </div>

                </div>
              )
            })}
          </section>}
        </div>
      </section>

      {selectedApplication && (
        <div className="review-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedApplicationId('')
        }}>
          <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
            <div className="review-modal-header">
              <div><span className="admin-review-kicker">Super admin review</span><h2 id="review-modal-title">Application details</h2></div>
              <button type="button" className="review-modal-close" aria-label="Close application details" onClick={() => setSelectedApplicationId('')}>x</button>
            </div>
            <SuperAdminApplicationDetails application={selectedApplication} updatingDocumentKey={updatingDocumentKey} onDocumentReview={updateDocumentReview} />
          </section>
        </div>
      )}
    </main>
  )
}

function SuperAdminApplicationDetails({ application, updatingDocumentKey, onDocumentReview }) {
  const [isPrintFormOpen, setIsPrintFormOpen] = useState(false)
  const documents = Object.entries(application.documents || {})
  const documentReviews = application.documentReviews || {}
  const psaDocument = documents.find(([key]) => key === 'psaMarriageLicense')
  const imageDocuments = documents.filter(([, value]) => typeof value === 'string' && value.startsWith('data:image/'))

  function requestDocumentRedo(documentKey) {
    const reviewNote = window.prompt('What does the applicant need to redo for this document?')
    if (reviewNote?.trim()) onDocumentReview(application._id, documentKey, 'Needs Redo', reviewNote.trim())
  }

  return (
    <div className="admin-details-panel">
      <div className="admin-details-group"><h4>Groom information</h4><p><strong>Name:</strong> {application.groomFullName || 'Not provided'}</p><p><strong>Date of birth:</strong> {application.groomDob || 'Not provided'}</p><p><strong>Gender:</strong> {application.groomGender || 'Not provided'}</p><p><strong>Civil status:</strong> {application.groomCivilStatus || 'Not provided'}</p><p><strong>Mobile:</strong> {application.groomMobile || 'Not provided'}</p><p><strong>Email:</strong> {application.groomEmail || 'Not provided'}</p></div>
      <div className="admin-details-group"><h4>Bride information</h4><p><strong>Name:</strong> {application.brideFullName || 'Not provided'}</p><p><strong>Date of birth:</strong> {application.brideDob || 'Not provided'}</p><p><strong>Gender:</strong> {application.brideGender || 'Not provided'}</p><p><strong>Civil status:</strong> {application.brideCivilStatus || 'Not provided'}</p><p><strong>Mobile:</strong> {application.brideMobile || 'Not provided'}</p><p><strong>Email:</strong> {application.brideEmail || 'Not provided'}</p></div>
      <div className="admin-details-group"><h4>Appointment and payment</h4><p><strong>Date:</strong> {application.appointmentDate || 'Not provided'}</p><p><strong>Time:</strong> {application.appointmentTime || 'Not provided'}</p><p><strong>Location:</strong> {application.appointmentLocation || 'Not provided'}</p><p><strong>Payment:</strong> {application.paymentMethod || 'Not provided'}</p><p><strong>Amount:</strong> {application.paymentAmount || 'Not provided'}</p><p><strong>Status:</strong> {application.status || 'For Review'}</p></div>
      <div className="admin-details-group"><h4>Marriage license</h4><p><strong>Number:</strong> {application.marriageLicenseNumber || 'Not issued'}</p><p><strong>Issued:</strong> {application.marriageLicenseIssuedAt ? new Date(application.marriageLicenseIssuedAt).toLocaleDateString() : 'Not issued'}</p></div>
      <div className="admin-details-group admin-document-review-list"><h4>Submitted documents</h4>{documents.length > 0 ? documents.map(([key, value]) => <div className="admin-document-review-row" key={key}><p><strong>{key}:</strong> {value}</p><span className={`document-review-status ${documentReviews[key] === 'Needs Redo' ? 'needs-redo' : documentReviews[key] === 'Accepted' ? 'accepted' : ''}`}>{documentReviews[key] || 'Pending review'}</span><div><button type="button" className="admin-document-accept" disabled={updatingDocumentKey === key} onClick={() => onDocumentReview(application._id, key, 'Accepted')}>Accept</button><button type="button" className="admin-document-flag" disabled={updatingDocumentKey === key} onClick={() => requestDocumentRedo(key)}>Needs redo</button></div></div>) : <p>No documents listed.</p>}</div>
      <div className="admin-document-review">
        <div className="admin-document-review-heading">
          <div>
            <span className="admin-review-kicker">Verification</span>
            <h4>Compare submitted PSA</h4>
          </div>
          <span className="admin-review-note">Manual review</span>
        </div>
        <div className="admin-document-comparison">
          <div className="admin-document-preview">
            {psaDocument && typeof psaDocument[1] === 'string' && psaDocument[1].startsWith('data:image/') ? (
              <img src={psaDocument[1]} alt="Submitted PSA marriage license" />
            ) : (
              <p>{psaDocument ? 'The submitted PSA is not an image preview.' : 'No PSA image was submitted.'}</p>
            )}
            <small>Submitted PSA / marriage license</small>
          </div>
          <div className="admin-comparison-details">
            <h5>Application details</h5>
            <p><strong>Groom:</strong> {application.groomFullName || 'Not provided'}</p>
            <p><strong>Groom birth date:</strong> {application.groomDob || 'Not provided'}</p>
            <p><strong>Bride:</strong> {application.brideFullName || 'Not provided'}</p>
            <p><strong>Bride birth date:</strong> {application.brideDob || 'Not provided'}</p>
            <p><strong>Applicant email:</strong> {application.applicantEmail || 'Not provided'}</p>
          </div>
        </div>
        {imageDocuments.length > 0 && <div className="admin-other-documents"><h5>Other document images</h5>{imageDocuments.filter(([key]) => key !== 'psaMarriageLicense').map(([key, value]) => <img key={key} src={value} alt={`Submitted ${key}`} />)}</div>}
      </div>
      <div className="admin-print-actions"><button type="button" className="admin-details-button" onClick={() => setIsPrintFormOpen(true)}>Print form</button></div>
      {isPrintFormOpen && <div className="print-form-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPrintFormOpen(false) }}><section className="print-form-modal" role="dialog" aria-modal="true" aria-label="Printable application form"><div className="print-form-actions"><button type="button" className="admin-details-button" onClick={() => window.print()}>Print</button><button type="button" className="review-modal-close" aria-label="Close print form" onClick={() => setIsPrintFormOpen(false)}>×</button></div><OfficialApplicationForm application={application} /></section></div>}
    </div>
  )
}
