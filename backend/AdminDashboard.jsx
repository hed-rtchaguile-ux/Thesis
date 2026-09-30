import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from '../auth'
import './ApplicantDashboard.css'
import { printExcelForm } from './printExcelForm'

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

function formatAppointmentDate(dateKey) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${dateKey}T00:00:00`))
}

export default function AdminDashboard({ view = 'dashboard' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loadError, setLoadError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [showAllApplications, setShowAllApplications] = useState(false)
  const [selectedApplicationId, setSelectedApplicationId] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [selectedAppointmentDate, setSelectedAppointmentDate] = useState('')
  const [scheduleApplicantId, setScheduleApplicantId] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleError, setScheduleError] = useState('')

  useEffect(() => {
    apiFetch('/api/applications')
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

  const pageFilter = view === 'verified' ? 'Verified' : view === 'new' ? 'For Review' : 'all'
  const filteredApplications = pageFilter === 'all'
    ? applications
    : applications.filter((application) => application.status === pageFilter)
  const availableAppointmentDates = [...new Set(filteredApplications
    .map((application) => getAppointmentDateKey(application.appointmentDate))
    .filter((dateKey) => dateKey.startsWith(selectedMonth)))]
    .sort()
  const dateFilteredApplications = selectedAppointmentDate
    ? filteredApplications.filter((application) => getAppointmentDateKey(application.appointmentDate) === selectedAppointmentDate)
    : filteredApplications
  const visibleApplications = view !== 'dashboard' || showAllApplications ? dateFilteredApplications : dateFilteredApplications.slice(0, 3)
  const pageTitle = view === 'verified' ? 'Verified records.' : view === 'new' ? 'New submissions.' : view === 'all' ? 'All applications.' : 'Application overview.'
  const pageDescription = view === 'verified' ? 'Review applications that have already been verified.' : view === 'new' ? 'Review applications waiting for verification.' : view === 'all' ? 'Review every application submitted to the office.' : 'Here is an overview of your application workspace.'

  function changeMonth(event) {
    const month = event.target.value
    setSelectedMonth(month)
    setSelectedAppointmentDate('')
  }

  async function scheduleAppointment(event) {
    event.preventDefault()
    if (!scheduleApplicantId || !scheduleDate || !scheduleTime) return

    setScheduleError('')
    try {
      const isSchedulingAll = scheduleApplicantId === 'all'
      const response = await apiFetch(isSchedulingAll ? '/api/applications/appointments' : `/api/applications/${scheduleApplicantId}/appointment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentDate: scheduleDate, appointmentTime: scheduleTime }),
      })
      if (!response.ok) throw new Error('Unable to schedule appointment.')
      const result = await response.json()
      if (isSchedulingAll) {
        setApplications(result.applications)
      } else {
        setApplications((currentApplications) => currentApplications.map((application) => (
          application._id === result._id ? result : application
        )))
      }
      setSelectedAppointmentDate(scheduleDate)
    } catch (error) {
      setScheduleError(error.message)
    }
  }

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
          <button type="button" className={`nav-item ${view === 'new' ? 'active' : ''}`} onClick={() => navigate('/admin/new-submissions')}><span className="nav-icon" aria-hidden="true">◫</span><span>New Submissions</span></button>
          <button type="button" className={`nav-item ${view === 'appointments' ? 'active' : ''}`} onClick={() => navigate('/admin/appointments')}><span className="nav-icon" aria-hidden="true">🗓</span><span>Appointments</span></button>
        </nav>
        <button className="logout-button" type="button" onClick={signOut}><span className="nav-icon" aria-hidden="true">⎋</span><span>Logout</span></button>
      </aside>

      <section className="applicant-main" id="admin-dashboard-top">
        <header className="topbar">
          <div className="topbar-main"><h1>Welcome, Administrator!</h1><p>{pageDescription}</p></div>
          <div className="topbar-user"><div className="user-avatar">PA</div><span>{user.name}</span><span className="admin-user-caret" aria-hidden="true">▾</span></div>
        </header>

        <div className="dashboard-panel admin-dashboard-panel">
          {view !== 'appointments' && <div className="welcome-banner"><div className="banner-icon" aria-hidden="true">▤</div><div className="banner-copy"><h2>{pageTitle}</h2><p>Review submissions and verify completed applications.</p></div></div>}

          {view === 'appointments' && <section className="admin-appointment-panel" aria-label="Appointment calendar">
            <div className="admin-appointment-panel-heading"><div><span className="admin-review-kicker">Scheduling workspace</span><h2>Appointment calendar</h2></div><span>Select a day to filter applicants</span></div>
            <div className="admin-appointment-controls">
              <label>Month<input type="month" value={selectedMonth} onChange={changeMonth} /></label>
              <label>Applicant<select value={scheduleApplicantId} onChange={(event) => setScheduleApplicantId(event.target.value)}><option value="">Select applicant</option><option value="all">All applicants</option>{applications.map((application) => <option key={application._id} value={application._id}>{application.groomFullName} &amp; {application.brideFullName}</option>)}</select></label>
              <label>Day<input type="date" value={scheduleDate} min={`${selectedMonth}-01`} max={`${selectedMonth}-${new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate().toString().padStart(2, '0')}`} onChange={(event) => setScheduleDate(event.target.value)} /></label>
              <label>Time<select value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)}><option value="">Select time</option><option value="9:00 AM">9:00 AM</option><option value="10:30 AM">10:30 AM</option><option value="1:00 PM">1:00 PM</option><option value="3:30 PM">3:30 PM</option></select></label>
              <button type="button" onClick={scheduleAppointment} disabled={!scheduleApplicantId || !scheduleDate || !scheduleTime}>{scheduleApplicantId === 'all' ? 'Schedule all applicants' : 'Set appointment'}</button>
            </div>
            {scheduleError && <p className="admin-appointment-error">{scheduleError}</p>}
            <div className="admin-appointment-dates admin-appointment-dates-main"><button type="button" className={!selectedAppointmentDate ? 'selected' : ''} onClick={() => setSelectedAppointmentDate('')}>All dates</button>{availableAppointmentDates.map((dateKey) => <button key={dateKey} type="button" className={selectedAppointmentDate === dateKey ? 'selected' : ''} onClick={() => setSelectedAppointmentDate(dateKey)}>{formatAppointmentDate(dateKey)}</button>)}{availableAppointmentDates.length === 0 && <p>No appointments this month.</p>}</div>
          </section>}

          {view !== 'appointments' && <div className="summary-grid">
            <article className="summary-card"><div className="card-icon" aria-hidden="true">▣</div><div className="summary-copy"><span>New Submissions</span><strong>{applications.filter((application) => application.status === 'For Review').length}</strong></div></article>
            <article className="summary-card"><div className="card-icon" aria-hidden="true">◫</div><div className="summary-copy"><span>All Applications</span><strong>{applications.length}</strong></div></article>
            <article className="summary-card" id="admin-verified"><div className="card-icon" aria-hidden="true">✓</div><div className="summary-copy"><span>Verified Records</span><strong>{applications.filter((application) => application.status === 'Verified').length}</strong></div></article>
          </div>}

          <section className="quick-actions admin-review-panel" id="admin-queue">
            <div className="admin-section-heading">
              <h3>{view === 'appointments' ? 'Scheduled applicants' : view === 'dashboard' ? 'Application Queue' : pageTitle.replace('.', '')}</h3>
              <button className="admin-view-button" type="button" onClick={() => setShowAllApplications((currentValue) => !currentValue)}>
                {showAllApplications ? 'Show recent' : 'View all'}
              </button>
            </div>

            {loadError && <p className="admin-empty-state">{loadError}</p>}
            {!loadError && visibleApplications.length === 0 && <p className="admin-empty-state">No submitted applicants yet.</p>}
            {!loadError && visibleApplications.map((application) => {
              const detailsOpen = selectedApplicationId === application._id

              return (
                <div key={application._id}>
                  <div className="admin-application-row">
                    <span className="admin-avatar">{application.groomFullName?.slice(0, 1)}{application.brideFullName?.slice(0, 1)}</span>
                    <div className="admin-application-copy">
                      <strong>{application.groomFullName} &amp; {application.brideFullName}</strong>
                      <small>{application.applicantEmail}</small>
                    </div>
                    <button className="admin-details-button" type="button" onClick={() => setSelectedApplicationId((currentId) => currentId === application._id ? '' : application._id)}>
                      {detailsOpen ? 'Hide details' : 'View details'}
                    </button>
                  </div>
                  {detailsOpen && <ApplicationDetails application={application} />}
                </div>
              )
            })}
          </section>
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
      <div className="admin-details-group"><h4>Submitted documents</h4>{documents.length > 0 ? documents.map(([key, value]) => <p key={key}><strong>{key}:</strong> {value}</p>) : <p>No documents listed.</p>}</div>
      <div className="admin-print-actions"><button type="button" className="admin-details-button" onClick={() => printExcelForm(application._id)}>Print form</button></div>
    </div>
  )
}
