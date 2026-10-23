import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from '../auth'
import DocumentPreview from './DocumentPreview'
import LicenseReleaseControl from './LicenseReleaseControl'
import SecondAppointmentControl from './SecondAppointmentControl'
import { ReportCards } from './AdminTools'
import { filterApplications, filterApplicationsByStatus, getApplicationWorkflowStatus, getAppointmentDate, getAppointmentTime, sortAppointments } from './applicationSearch'
import { printExcelForm } from './printExcelForm'
import logoImage from '../../assets/wedrings-mark.png'
import './ApplicantDashboard.css'

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

export default function SuperAdminDashboard({ isAdmin = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const basePath = isAdmin ? '/admin' : '/superadmin'
  const displayName = user?.name || 'User'
  const firstName = displayName.split(' ')[0]
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [applications, setApplications] = useState([])
  const [updatingId, setUpdatingId] = useState('')
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [updatingDocumentKey, setUpdatingDocumentKey] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    apiFetch('/api/applications')
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
      const response = await apiFetch(`/api/applications/${applicationId}/status`, {
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

  async function updateDocumentReview(applicationId, documentKey, reviewStatus, reviewNote = '') {
    setUpdatingDocumentKey(documentKey)
    try {
      const response = await apiFetch(`/api/applications/${applicationId}/documents/${documentKey}/review`, {
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
  const isAppointmentsPage = location.pathname === `${basePath}/appointments`
  const isReportsPage = location.pathname === `${basePath}/reports`
  const appointmentApplications = sortAppointments(applications, getAppointmentDateKey)
  const statusApplications = isAppointmentsPage ? appointmentApplications : filterApplicationsByStatus(applications, statusFilter)
  const visibleApplications = filterApplications(statusApplications, searchTerm)

  return (
    <main className="applicant-shell admin-applicant-shell">
      <aside className="applicant-sidebar">
        <div className="brand-row">
          <span className="brand-mark" aria-label="WedRings logo">
            <img src={logoImage} alt="" className="brand-logo" />
          </span>
          <span className="brand-name">WEDRINGS</span>
        </div>

        <nav className="sidebar-nav" aria-label={isAdmin ? 'Admin navigation' : 'Super admin navigation'}>
          <button type="button" className={`nav-item ${!isAppointmentsPage && !isReportsPage ? 'active' : ''}`} onClick={() => navigate(`${basePath}/dashboard`)}>
            <span className="nav-icon" aria-hidden="true">⌂</span>
            <span>Dashboard</span>
          </button>
          <button type="button" className={`nav-item ${isAppointmentsPage ? 'active' : ''}`} onClick={() => navigate(`${basePath}/appointments`)}>
            <span className="nav-icon" aria-hidden="true">▦</span>
            <span>Appointments</span>
          </button>
          <button type="button" className={`nav-item ${isReportsPage ? 'active' : ''}`} onClick={() => navigate(`${basePath}/reports`)}><span className="nav-icon" aria-hidden="true">▤</span><span>Reports</span></button>
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
            <p>{isAdmin ? 'Review documents and schedule appointments for applicants.' : 'Final approval and system-wide oversight for all applications.'}</p>
          </div>

          <div className="topbar-user">
            <div className="user-avatar">{initials}</div>
            <span>{displayName}</span>
            <button type="button" className="mini-button" aria-label="Open user menu">▾</button>
          </div>
        </header>

        <div className="dashboard-panel admin-dashboard-panel">
          {!isAppointmentsPage && <div className="welcome-banner">
            <div className="banner-icon" aria-hidden="true">▤</div>
            <div className="banner-copy">
              <h2>{isAdmin ? 'Admin control' : 'Super admin control'}</h2>
              <p>{isAdmin ? 'Review documents and prepare applications for final approval.' : 'Only the super admin can verify or reject applicants.'}</p>
            </div>
          </div>}

          {isAppointmentsPage && <section className="admin-appointment-panel" aria-label="Appointment assignment">
            <div className="admin-appointment-panel-heading"><div><span className="admin-review-kicker">Applicant schedules</span><h2>Appointments</h2></div><span>{applications.filter((application) => getAppointmentDateKey(getAppointmentDate(application))).length} scheduled</span></div>
            <p className="admin-schedule-readonly-note">Applicants select their appointment date and time during registration.</p>
          </section>}

          {isReportsPage && <ReportCards applications={applications} showDateFilter />}

          {!isAppointmentsPage && <div className="summary-grid">
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

          {!isReportsPage && <section className="quick-actions admin-review-panel" id="admin-queue">
            <div className="admin-section-heading">
              <h3>{isAppointmentsPage ? 'Scheduled applicants' : isReportsPage ? 'Applicants' : 'Verification Queue'}</h3>
              <input className="admin-applicant-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search names, email, or phone" aria-label="Search applicants" />
              {!isAppointmentsPage && <select className="admin-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter applicants by status">
                {['All', 'Under Review', 'Verified', 'Complete', 'Rejected'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>}
            </div>

            {visibleApplications.length === 0 && <p className="admin-empty-state">{searchTerm ? 'No applicants match your search.' : 'No submitted applicants yet.'}</p>}

            {visibleApplications.map((application) => {
              const appointmentDate = getAppointmentDate(application)
              const appointmentTime = getAppointmentTime(application)

              return (
                <div key={application._id}>
                  <div className="admin-application-row">
                    <span className="admin-avatar">{application.groomFullName?.slice(0, 1)}{application.brideFullName?.slice(0, 1)}</span>
                    <div className="admin-application-copy">
                      <strong>{application.groomFullName} &amp; {application.brideFullName}</strong>
                      <small>{application.applicantEmail}</small>
                      {!isAppointmentsPage && <small className={`admin-workflow-status status-${getApplicationWorkflowStatus(application).toLowerCase().replace(/\s+/g, '-')}`}>{getApplicationWorkflowStatus(application)}</small>}
                    </div>
                    <button className="admin-details-button" type="button" onClick={() => setSelectedApplicationId((currentId) => currentId === application._id ? '' : application._id)}>{selectedApplicationId === application._id ? 'Hide details' : 'View details'}</button>
                    {isAppointmentsPage && <small className="admin-schedule-date">{appointmentDate ? `${appointmentDate} · ${appointmentTime || 'Time not set'}` : 'No appointment selected'}</small>}
                    {!isAppointmentsPage && <>
                      {!isAdmin && <>
                        <button className="admin-verify-button" type="button" onClick={() => confirmVerification(application._id)} disabled={application.status === 'Verified' || application.status === 'Rejected' || updatingId === application._id}>{updatingId === application._id ? 'Updating...' : application.status === 'Verified' ? 'Verified' : 'Verify'}</button>
                        <button className="admin-reject-button" type="button" onClick={() => confirmRejection(application._id)} disabled={application.status === 'Verified' || application.status === 'Rejected' || updatingId === application._id}>{updatingId === application._id ? 'Updating...' : application.status === 'Rejected' ? 'Rejected' : 'Reject'}</button>
                      </>}
                      {application.status === 'Verified' && <LicenseReleaseControl application={application} onSaved={(updatedApplication) => setApplications((currentApplications) => currentApplications.map((item) => item._id === updatedApplication._id ? updatedApplication : item))} />}
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
          <SuperAdminApplicationDetails
            application={selectedApplication}
            updatingDocumentKey={updatingDocumentKey}
            onDocumentReview={updateDocumentReview}
            onAppointmentSaved={(updatedApplication) => setApplications((currentApplications) => currentApplications.map((item) => item._id === updatedApplication._id ? updatedApplication : item))}
          />
          </section>
        </div>
      )}
    </main>
  )
}

function SuperAdminApplicationDetails({ application, updatingDocumentKey, onDocumentReview, onAppointmentSaved }) {
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
      <div className="admin-details-group"><h4>Appointment and payment</h4><p><strong>Applicant-selected date:</strong> {getAppointmentDate(application) || 'Not selected'}</p><p><strong>Applicant-selected time:</strong> {getAppointmentTime(application) || 'Not selected'}</p><p><strong>Location:</strong> {application.appointmentLocation || 'Not provided'}</p><p><strong>Payment:</strong> {application.paymentMethod || 'Not provided'}</p><p><strong>Amount:</strong> {application.paymentAmount || 'Not provided'}</p><p><strong>Status:</strong> {application.status || 'For Review'}</p></div>
      <SecondAppointmentControl application={application} onSaved={onAppointmentSaved} />
      <div className="admin-details-group"><h4>Marriage license release</h4><p><strong>Release date:</strong> {application.licenseReleaseDate || 'Not announced'}</p></div>
        <div className="admin-details-group admin-document-review-list"><h4>Submitted documents</h4>{documents.length > 0 ? documents.map(([key, value]) => <div className="admin-document-review-row" key={key}><h5>{key.replace(/([A-Z])/g, ' $1')}</h5><DocumentPreview label={key} value={value} /><span className={`document-review-status ${documentReviews[key] === 'Needs Redo' ? 'needs-redo' : documentReviews[key] === 'Accepted' ? 'accepted' : ''}`}>{documentReviews[key] || 'Pending review'}</span><div><button type="button" className="admin-document-accept" disabled={updatingDocumentKey === key} onClick={() => onDocumentReview(application._id, key, 'Accepted')}>Accept</button><button type="button" className="admin-document-flag" disabled={updatingDocumentKey === key} onClick={() => requestDocumentRedo(key)}>Needs redo</button></div></div>) : <p>No documents listed.</p>}</div>
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
      <div className="admin-print-actions"><button type="button" className="admin-details-button" onClick={() => printExcelForm(application._id)}>Print form</button></div>
    </div>
  )
}
