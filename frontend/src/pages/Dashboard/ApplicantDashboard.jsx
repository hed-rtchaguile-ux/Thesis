import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import './ApplicantDashboard.css'

function formatAppointmentDate(value, time = '') {
  if (!value || value === 'To be assigned by office') return 'None'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
  return time ? `${formattedDate} at ${time}` : formattedDate
}

function formatDocumentName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
}

export default function ApplicantDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const firstName = displayName.split(' ')[0]
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [application, setApplication] = useState({ status: 'No applications', items: 0, appointment: 'None' })
  const [applications, setApplications] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [isEditingApplication, setIsEditingApplication] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editDocuments, setEditDocuments] = useState({})
  const [editError, setEditError] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  function getFlaggedDocuments(applicationRecord) {
    return Object.entries(applicationRecord.documentReviews || {}).filter(([, status]) => status === 'Needs Redo').map(([key]) => key)
  }

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
        appointment: formatAppointmentDate(latestApplication?.appointmentDate, latestApplication?.appointmentTime),
      })
    }

    const refreshApplications = () => loadApplications().catch(() => {
      setApplications([])
      setApplication({ status: 'Unable to load', items: 0, appointment: 'None' })
    })

    refreshApplications()
    const refreshTimer = window.setInterval(refreshApplications, 30000)
    return () => window.clearInterval(refreshTimer)
  }, [user.email])

  const applicantNotifications = applications.flatMap((applicationRecord) => {
    const coupleNames = [applicationRecord.groomFullName, applicationRecord.brideFullName].filter(Boolean).join(' & ') || 'your application'
    const notificationReads = applicationRecord.notificationReads || {}
    const notifications = []

    if (!notificationReads.appointment && applicationRecord.appointmentDate && applicationRecord.appointmentDate !== 'To be assigned by office') {
      notifications.push({
        id: `${applicationRecord._id}-appointment`,
        notificationKey: 'appointment',
        application: applicationRecord,
        editing: false,
        action: 'View appointment',
        message: `Your appointment for ${coupleNames} is scheduled for ${formatAppointmentDate(applicationRecord.appointmentDate, applicationRecord.appointmentTime)}.`,
      })
    }

    if (!notificationReads.rejected && applicationRecord.status === 'Rejected') {
      notifications.push({
        id: `${applicationRecord._id}-rejected`,
        notificationKey: 'rejected',
        application: applicationRecord,
        editing: true,
        action: 'Update',
        message: `Your application for ${coupleNames} was rejected. Please review and update it before submitting again.`,
      })
    }

    getFlaggedDocuments(applicationRecord).forEach((documentKey) => {
      const notificationKey = `redo-${documentKey}`
      if (notificationReads[notificationKey]) return
      const reviewNote = applicationRecord.documentReviewNotes?.[documentKey]
      notifications.push({
        id: `${applicationRecord._id}-${documentKey}-redo`,
        notificationKey,
        application: applicationRecord,
        editing: true,
        action: 'Update',
        message: reviewNote
          ? `${formatDocumentName(documentKey)} needs to be replaced for ${coupleNames}. Reviewer note: ${reviewNote}`
          : `${formatDocumentName(documentKey)} needs to be replaced for ${coupleNames}.`,
      })
    })

    return notifications
  })

  const navigation = [
    { label: 'My Appointments',active: true, icon: '🗓' },
    { label: 'New Application', icon: '✎' },
    { label: 'Profile', icon: '◉' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  function openApplication(applicationRecord, editing = false) {
    setSelectedApplication(applicationRecord)
    setIsEditingApplication(editing)
    setEditError('')
    setEditForm({
      groomFullName: applicationRecord.groomFullName || '',
      groomDob: applicationRecord.groomDob || '',
      groomGender: applicationRecord.groomGender || '',
      groomCivilStatus: applicationRecord.groomCivilStatus || '',
      groomMobile: applicationRecord.groomMobile || '',
      groomEmail: applicationRecord.groomEmail || '',
      brideFullName: applicationRecord.brideFullName || '',
      brideDob: applicationRecord.brideDob || '',
      brideGender: applicationRecord.brideGender || '',
      brideCivilStatus: applicationRecord.brideCivilStatus || '',
      brideMobile: applicationRecord.brideMobile || '',
      brideEmail: applicationRecord.brideEmail || '',
    })
    setEditDocuments(applicationRecord.documents || {})
  }

  async function openNotification(notification) {
    openApplication(notification.application, notification.editing)
    try {
      const response = await fetch(`/api/applications/${notification.application._id}/notifications/${notification.notificationKey}/read`, { method: 'PUT' })
      if (!response.ok) throw new Error('Unable to mark notification as read.')
      const updatedApplication = await response.json()
      setApplications((currentApplications) => currentApplications.map((applicationRecord) => (
        applicationRecord._id === updatedApplication._id ? updatedApplication : applicationRecord
      )))
    } catch {
      // The notification remains visible after the next refresh if it could not be acknowledged.
    }
  }

  async function saveApplicationEdit(event) {
    event.preventDefault()
    setIsSavingEdit(true)
    setEditError('')

    try {
      const response = await fetch(`/api/applications/${selectedApplication._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          documents: Object.fromEntries(Object.entries(editDocuments).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : value.dataUrl,
          ])),
        }),
      })
      if (!response.ok) throw new Error('Unable to save your changes.')

      const updatedApplication = await response.json()
      setApplications((currentApplications) => currentApplications.map((item) => (
        item._id === updatedApplication._id ? updatedApplication : item
      )))
      setSelectedApplication(updatedApplication)
      setIsEditingApplication(false)
    } catch (error) {
      setEditError(error.message)
    } finally {
      setIsSavingEdit(false)
    }
  }

  function updateEditField(field, value) {
    setEditForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  function updateEditDocument(key, event) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    const reader = new FileReader()
    reader.onload = () => {
      setEditDocuments((currentDocuments) => ({
        ...currentDocuments,
        [key]: { name: selectedFile.name, dataUrl: reader.result },
      }))
    }
    reader.readAsDataURL(selectedFile)
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

          {applicantNotifications.length > 0 && (
            <section className="applicant-notifications" aria-live="polite" aria-label="Application updates">
              <div className="applicant-notifications-heading">
                <div><span className="application-label">Action needed</span><h3>Application updates</h3></div>
                <span className="notification-count">{applicantNotifications.length}</span>
              </div>
              <div className="applicant-notification-list">
                {applicantNotifications.map((notification) => (
                  <button key={notification.id} type="button" className="applicant-notification" onClick={() => openNotification(notification)}>
                    <span className="notification-icon" aria-hidden="true">!</span>
                    <span>{notification.message}</span>
                    <span className="notification-action">{notification.action}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

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
                        <strong>{formatAppointmentDate(item.appointmentDate, item.appointmentTime)}</strong>
                      </div>
                      {getFlaggedDocuments(item).length > 0 && <div className="application-document-alert"><span className="application-label">Document action</span><strong>{getFlaggedDocuments(item).length} document(s) need redo</strong></div>}
                      <div className="application-actions">
                        <button type="button" className="application-view-button" onClick={() => openApplication(item)}>View submission</button>
                        <button type="button" className="application-edit-button" onClick={() => openApplication(item, true)}>Edit information</button>
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

        {selectedApplication && (
          <div className="applicant-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedApplication(null)
          }}>
            <section className="applicant-modal" role="dialog" aria-modal="true" aria-labelledby="application-modal-title">
              <div className="applicant-modal-header">
                <div><span className="application-label">Submitted form</span><h2 id="application-modal-title">{isEditingApplication ? 'Edit your information' : 'Application details'}</h2></div>
                <button type="button" className="applicant-modal-close" onClick={() => setSelectedApplication(null)} aria-label="Close application">x</button>
              </div>

              {isEditingApplication ? (
                <form className="applicant-edit-form" onSubmit={saveApplicationEdit}>
                  <div className="applicant-edit-grid">
                    {['groomFullName', 'groomDob', 'groomGender', 'groomCivilStatus', 'groomMobile', 'groomEmail', 'brideFullName', 'brideDob', 'brideGender', 'brideCivilStatus', 'brideMobile', 'brideEmail'].map((field) => (
                      <label key={field}>{field.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}<input value={editForm[field] || ''} onChange={(event) => updateEditField(field, event.target.value)} /></label>
                    ))}
                  </div>
                  <div className="applicant-edit-documents">
                    <h3>Submitted documents</h3>
                    {Object.entries(editDocuments).map(([key, value]) => (
                      <label key={key}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}<input type="file" accept="image/*,.pdf" onChange={(event) => updateEditDocument(key, event)} /><small>{typeof value === 'string' ? 'Document saved' : value?.name || 'Choose a replacement file'}</small></label>
                    ))}
                  </div>
                  <div className="applicant-modal-actions"><button type="button" className="application-view-button" onClick={() => setIsEditingApplication(false)}>Cancel</button><button type="submit" className="application-edit-button" disabled={isSavingEdit}>{isSavingEdit ? 'Saving...' : 'Save changes'}</button></div>
                  {editError && <p className="application-edit-error">{editError}</p>}
                </form>
              ) : (
                <div className="applicant-submission-details">
                  <div><h3>Groom information</h3><p><strong>Name:</strong> {selectedApplication.groomFullName || 'Not provided'}</p><p><strong>Date of birth:</strong> {selectedApplication.groomDob || 'Not provided'}</p><p><strong>Gender:</strong> {selectedApplication.groomGender || 'Not provided'}</p><p><strong>Civil status:</strong> {selectedApplication.groomCivilStatus || 'Not provided'}</p><p><strong>Mobile:</strong> {selectedApplication.groomMobile || 'Not provided'}</p><p><strong>Email:</strong> {selectedApplication.groomEmail || 'Not provided'}</p></div>
                  <div><h3>Bride information</h3><p><strong>Name:</strong> {selectedApplication.brideFullName || 'Not provided'}</p><p><strong>Date of birth:</strong> {selectedApplication.brideDob || 'Not provided'}</p><p><strong>Gender:</strong> {selectedApplication.brideGender || 'Not provided'}</p><p><strong>Civil status:</strong> {selectedApplication.brideCivilStatus || 'Not provided'}</p><p><strong>Mobile:</strong> {selectedApplication.brideMobile || 'Not provided'}</p><p><strong>Email:</strong> {selectedApplication.brideEmail || 'Not provided'}</p></div>
                  <div><h3>Appointment</h3><p><strong>Date:</strong> {formatAppointmentDate(selectedApplication.appointmentDate)}</p><p><strong>Time:</strong> {selectedApplication.appointmentTime || 'To be assigned by office'}</p><p><strong>Location:</strong> {selectedApplication.appointmentLocation || 'Not provided'}</p><p><strong>Status:</strong> {selectedApplication.status || 'For Review'}</p></div>
                  <div className="applicant-document-review"><h3>Document review</h3>{Object.entries(selectedApplication.documents || {}).map(([key]) => { const reviewStatus = selectedApplication.documentReviews?.[key] || 'Pending review'; const reviewNote = selectedApplication.documentReviewNotes?.[key]; return <p key={key}><strong>{key}:</strong> <span className={reviewStatus === 'Needs Redo' ? 'document-status-redo' : ''}>{reviewStatus}</span>{reviewStatus === 'Needs Redo' && <small className="document-redo-note">{reviewNote || 'Please replace this document and save your changes.'}</small>}</p> })}</div>
                  <button type="button" className="application-edit-button" onClick={() => setIsEditingApplication(true)}>Edit information</button>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
  )
}
