import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from '../auth'
import { printExcelForm } from './printExcelForm'
import { formatNotificationDate, getApplicantNotifications } from './applicantNotifications'
import './ApplicantDashboard.css'

export default function ApplicantDashboard() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const firstName = displayName.split(' ')[0]
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [application, setApplication] = useState({ status: 'No applications', items: 0, appointment: 'None' })
  const [applications, setApplications] = useState([])
  const [applicationsStatus, setApplicationsStatus] = useState('loading')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [editingSection, setEditingSection] = useState('')
  const [editForm, setEditForm] = useState({})
  const [editDocuments, setEditDocuments] = useState({})
  const [editError, setEditError] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [receiptUploads, setReceiptUploads] = useState({})
  const [receiptErrors, setReceiptErrors] = useState({})
  const handledNotificationRef = useRef('')

  function getFlaggedDocuments(applicationRecord) {
    return Object.entries(applicationRecord.documentReviews || {}).filter(([, status]) => status === 'Needs Redo').map(([key]) => key)
  }

  useEffect(() => {
    async function loadApplications() {
      const response = await apiFetch('/api/applications')
      if (!response.ok) throw new Error('Unable to load your application history.')

      const fetchedApplications = await response.json()
      const latestApplication = fetchedApplications[0]
      setApplications(fetchedApplications)
      setApplicationsStatus('ready')
      setApplication({
        status: latestApplication?.status || 'No applications',
        items: fetchedApplications.length,
        appointment: formatNotificationDate(latestApplication?.appointmentDate, latestApplication?.appointmentTime),
      })
    }

    const refreshApplications = () => loadApplications().catch(() => {
      setApplicationsStatus('error')
      setApplication({ status: 'Unable to load', items: 0, appointment: 'None' })
    })

    refreshApplications()
    const refreshTimer = window.setInterval(refreshApplications, 30000)
    return () => window.clearInterval(refreshTimer)
  }, [user.email])

  const applicantNotifications = getApplicantNotifications(applications, true)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getEditableApplicationData = useCallback((applicationRecord) => {
    const applicationData = applicationRecord.applicationData
    if (!applicationData || typeof applicationData !== 'object' || Array.isArray(applicationData)) {
      return {
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
        appointmentDate: applicationRecord.preferredAppointmentDate || '',
        appointmentTime: applicationRecord.preferredAppointmentTime || '',
        paymentMethod: applicationRecord.paymentMethod || '',
        paymentAmount: applicationRecord.paymentAmount || '',
      }
    }

    const editableData = { ...applicationData }
    const derivedFields = [
      ...(applicationData.groomFirstName || applicationData.groomLastName
        ? ['groomFullName', 'groomDob']
        : []),
      ...(applicationData.brideFirstName || applicationData.brideLastName
        ? ['brideFullName', 'brideDob']
        : []),
      'groomAge',
      'brideAge',
      'preferredAppointmentDate',
      'preferredAppointmentTime',
      'appointmentLocation',
    ]
    derivedFields.forEach((field) => delete editableData[field])

    return {
      ...editableData,
      appointmentDate: applicationRecord.preferredAppointmentDate || applicationData.preferredAppointmentDate || '',
      appointmentTime: applicationRecord.preferredAppointmentTime || applicationData.preferredAppointmentTime || '',
      paymentMethod: applicationRecord.paymentMethod || applicationData.paymentMethod || '',
      paymentAmount: applicationRecord.paymentAmount || applicationData.paymentAmount || '',
    }
  }, [])

  const openApplication = useCallback((applicationRecord, editing = false) => {
    setSelectedApplication(applicationRecord)
    setEditingSection(editing ? 'groom' : '')
    setEditError('')
    setEditForm(getEditableApplicationData(applicationRecord))
    setEditDocuments(applicationRecord.documents || {})
  }, [getEditableApplicationData])

  async function uploadPaymentReceipt(applicationRecord, event) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return

    setReceiptErrors((currentErrors) => ({ ...currentErrors, [applicationRecord._id]: '' }))
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      setReceiptErrors((currentErrors) => ({
        ...currentErrors,
        [applicationRecord._id]: 'Choose a JPEG, PNG, or PDF receipt.',
      }))
      input.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptErrors((currentErrors) => ({
        ...currentErrors,
        [applicationRecord._id]: 'The receipt must be no larger than 5 MB.',
      }))
      input.value = ''
      return
    }

    setReceiptUploads((currentUploads) => ({ ...currentUploads, [applicationRecord._id]: true }))
    try {
      const receipt = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Unable to read the selected receipt.'))
        reader.readAsDataURL(file)
      })
      const response = await apiFetch(`/api/applications/${applicationRecord._id}/payment-receipt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to upload the receipt.')

      setApplications((currentApplications) => currentApplications.map((item) => (
        item._id === result._id ? result : item
      )))
      setSelectedApplication((currentApplication) => (
        currentApplication?._id === result._id ? result : currentApplication
      ))
    } catch (error) {
      setReceiptErrors((currentErrors) => ({
        ...currentErrors,
        [applicationRecord._id]: error.message || 'Unable to upload the receipt.',
      }))
    } finally {
      setReceiptUploads((currentUploads) => ({ ...currentUploads, [applicationRecord._id]: false }))
      input.value = ''
    }
  }

  const openNotification = useCallback(async (notification) => {
    openApplication(notification.application, notification.editing)
    if (notification.notificationKey.startsWith('redo-')) setEditingSection('documents')
    try {
      const response = await apiFetch(`/api/applications/${notification.application._id}/notifications/${notification.notificationKey}/read`, { method: 'PUT' })
      if (!response.ok) throw new Error('Unable to mark notification as read.')
      const updatedApplication = await response.json()
      setApplications((currentApplications) => currentApplications.map((applicationRecord) => (
        applicationRecord._id === updatedApplication._id ? updatedApplication : applicationRecord
      )))
    } catch {
      // The notification remains visible after the next refresh if it could not be acknowledged.
    }
  }, [openApplication])

  useEffect(() => {
    const requestedNotification = location.state?.notificationToOpen
    if (!requestedNotification) {
      handledNotificationRef.current = ''
      return
    }
    if (applicationsStatus !== 'ready') return

    const requestId = `${requestedNotification.applicationId}:${requestedNotification.notificationKey}`
    if (handledNotificationRef.current === requestId) return
    handledNotificationRef.current = requestId

    const applicationRecord = applications.find((item) => item._id === requestedNotification.applicationId)
    const notification = applicationRecord
      ? getApplicantNotifications([applicationRecord]).find((item) => item.notificationKey === requestedNotification.notificationKey)
      : null
    if (notification) openNotification(notification)
    navigate('/applicant/dashboard', { replace: true, state: null })
  }, [applications, applicationsStatus, location.state, navigate, openNotification])

  async function saveApplicationEdit(event) {
    event.preventDefault()
    setIsSavingEdit(true)
    setEditError('')

    try {
      const getPersonValues = (person) => {
        const hasNameParts = [`${person}FirstName`, `${person}LastName`].some((field) => field in editForm)
        const hasDobParts = [`${person}DobDay`, `${person}DobMonth`, `${person}DobYear`].some((field) => field in editForm)
        const fullName = hasNameParts
          ? [`${person}FirstName`, `${person}MiddleName`, `${person}LastName`, `${person}Suffix`]
            .map((field) => editForm[field])
            .filter(Boolean)
            .join(' ')
            .trim()
          : editForm[`${person}FullName`] || ''
        const dob = hasDobParts
          ? [`${person}DobMonth`, `${person}DobDay`, `${person}DobYear`]
            .map((field) => editForm[field])
            .filter(Boolean)
            .join('/')
          : editForm[`${person}Dob`] || ''
        const day = Number(editForm[`${person}DobDay`])
        const month = Number(editForm[`${person}DobMonth`])
        const year = Number(editForm[`${person}DobYear`])
        let age = ''
        if (day && month && year) {
          const dateOfBirth = new Date(year, month - 1, day)
          const today = new Date()
          const isValidDate = dateOfBirth.getFullYear() === year
            && dateOfBirth.getMonth() === month - 1
            && dateOfBirth.getDate() === day
            && dateOfBirth <= today
          if (isValidDate) {
            age = today.getFullYear() - year
            if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1
          }
        }

        return {
          [`${person}FullName`]: fullName,
          [`${person}Dob`]: dob,
          [`${person}Age`]: age,
        }
      }
      const updatedPersonValues = {
        ...getPersonValues('groom'),
        ...getPersonValues('bride'),
      }
      const preferredAppointmentDate = editForm.appointmentDate || ''
      const preferredAppointmentTime = editForm.appointmentTime || ''
      const updatedApplicationData = {
        ...(selectedApplication.applicationData || {}),
        ...editForm,
        ...updatedPersonValues,
        preferredAppointmentDate,
        preferredAppointmentTime,
        appointmentDate: selectedApplication.applicationData?.appointmentDate ?? selectedApplication.appointmentDate,
        appointmentTime: selectedApplication.applicationData?.appointmentTime ?? selectedApplication.appointmentTime,
      }
      const response = await apiFetch(`/api/applications/${selectedApplication._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          ...updatedPersonValues,
          preferredAppointmentDate,
          preferredAppointmentTime,
          applicationData: updatedApplicationData,
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
      setEditingSection('')
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

  function formatEditFieldLabel(key) {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
  }

  function cancelSectionEdit() {
    setEditForm(getEditableApplicationData(selectedApplication))
    setEditDocuments(selectedApplication.documents || {})
    setEditingSection('')
    setEditError('')
  }

  function renderEditFields(fields) {
    return (
      <div className="applicant-edit-grid">
        {fields.map((field) => (
          <label key={field}>
            {formatEditFieldLabel(field)}
            <input
              type={field === 'appointmentDate' ? 'date' : 'text'}
              value={String(editForm[field] ?? '')}
              onChange={(event) => updateEditField(field, event.target.value)}
            />
          </label>
        ))}
      </div>
    )
  }

  function renderSectionActions() {
    return (
      <>
        <button type="button" className="application-view-button" onClick={cancelSectionEdit}>Cancel</button>
        <button type="submit" className="application-edit-button" disabled={isSavingEdit}>
          {isSavingEdit ? 'Saving...' : 'Save changes'}
        </button>
      </>
    )
  }

  const groomEditFields = Object.keys(editForm).filter((field) => field.startsWith('groom') && field !== 'groomAge')
  const brideEditFields = Object.keys(editForm).filter((field) => field.startsWith('bride') && field !== 'brideAge')
  const appointmentEditFields = ['appointmentDate', 'appointmentTime'].filter((field) => field in editForm)
  const otherEditFields = Object.keys(editForm).filter((field) => (
    !field.startsWith('groom')
    && !field.startsWith('bride')
    && !appointmentEditFields.includes(field)
  ))

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
                  <button type="button" className="dropdown-item" onClick={() => {
                    setMenuOpen(false)
                    navigate('/applicant/notifications')
                  }}>
                    Notifications
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

          <section
            id="notifications"
            className={`applicant-notifications ${applicantNotifications.length === 0 ? 'applicant-notifications-empty' : ''}`}
            aria-live="polite"
            aria-label="Application updates"
          >
            {applicantNotifications.length > 0 ? (
              <>
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
              </>
            ) : (
              <p>No new notifications.</p>
            )}
          </section>

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

          <div className="application-history">
            <h3>My Applications</h3>
            {applicationsStatus === 'loading' && <p role="status">Loading your application history...</p>}
            {applicationsStatus === 'error' && (
              <p className="application-history-error" role="alert">
                Unable to refresh your application history. Your previously loaded records are still shown.
              </p>
            )}
            {applicationsStatus === 'ready' && applications.length === 0 && (
              <p>No application history was found for this account.</p>
            )}
            {applications.length > 0 && (
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
                        <strong>{formatNotificationDate(item.appointmentDate, item.appointmentTime)}</strong>
                      </div>
                      {item.secondAppointmentDate && (
                        <div>
                          <span className="application-label">Counseling appointment</span>
                          <strong>{formatNotificationDate(item.secondAppointmentDate, item.secondAppointmentTime)}</strong>
                        </div>
                      )}
                      {getFlaggedDocuments(item).length > 0 && <div className="application-document-alert"><span className="application-label">Document action</span><strong>{getFlaggedDocuments(item).length} document(s) need redo</strong></div>}
                      <div className="application-receipt">
                        <div className="application-receipt-heading">
                          <span className="application-receipt-icon" aria-hidden="true">₱</span>
                          <div>
                            <span className="application-label">Over-the-counter payment</span>
                            <strong>Payment receipt</strong>
                          </div>
                        </div>
                        <p className="application-receipt-description">
                          {item.paymentReceipt
                            ? 'Your receipt is saved. You can upload a replacement if needed.'
                            : 'Upload a photo or PDF of your official payment receipt.'}
                        </p>
                        <div className="application-receipt-controls">
                          <label className={`receipt-upload-button ${receiptUploads[item._id] ? 'uploading' : ''}`}>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,application/pdf"
                              disabled={Boolean(receiptUploads[item._id])}
                              onChange={(event) => uploadPaymentReceipt(item, event)}
                            />
                            <span aria-hidden="true">{receiptUploads[item._id] ? '◌' : '↑'}</span>
                            {receiptUploads[item._id] ? 'Uploading...' : item.paymentReceipt ? 'Replace receipt' : 'Choose receipt'}
                          </label>
                          {item.paymentReceipt && (
                            <a className="receipt-view-link" href={item.paymentReceipt} target="_blank" rel="noreferrer">
                              View uploaded receipt
                            </a>
                          )}
                        </div>
                        <small className="application-receipt-hint">JPEG, PNG, or PDF · Maximum 5 MB</small>
                        {receiptErrors[item._id] && <p role="alert">{receiptErrors[item._id]}</p>}
                      </div>
                      <div className="application-actions">
                        <button type="button" className="application-view-button" onClick={() => openApplication(item)}>View submission</button>
                        <button type="button" className="application-view-button" onClick={() => printExcelForm(item._id)}>Print form</button>
                        <button type="button" className="application-edit-button" onClick={() => openApplication(item, true)}>Edit information</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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
                <div><span className="application-label">Submitted form</span><h2 id="application-modal-title">Application details</h2></div>
                <button type="button" className="applicant-modal-close" onClick={() => setSelectedApplication(null)} aria-label="Close application">x</button>
              </div>

              <div className="applicant-submission-details">
                <section className="applicant-detail-card">
                  <div className="applicant-detail-heading">
                    <h3>Groom information</h3>
                    {editingSection !== 'groom' && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('groom'); setEditError('') }}>Edit information</button>}
                  </div>
                  {editingSection === 'groom' ? (
                    <form onSubmit={saveApplicationEdit}>
                      {renderEditFields(groomEditFields)}
                      <div className="applicant-modal-actions">{renderSectionActions()}</div>
                      {editError && <p className="application-edit-error">{editError}</p>}
                    </form>
                  ) : groomEditFields.map((field) => (
                    <p key={field}><strong>{formatEditFieldLabel(field)}:</strong> {editForm[field] || 'Not provided'}</p>
                  ))}
                </section>

                <section className="applicant-detail-card">
                  <div className="applicant-detail-heading">
                    <h3>Bride information</h3>
                    {editingSection !== 'bride' && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('bride'); setEditError('') }}>Edit information</button>}
                  </div>
                  {editingSection === 'bride' ? (
                    <form onSubmit={saveApplicationEdit}>
                      {renderEditFields(brideEditFields)}
                      <div className="applicant-modal-actions">{renderSectionActions()}</div>
                      {editError && <p className="application-edit-error">{editError}</p>}
                    </form>
                  ) : brideEditFields.map((field) => (
                    <p key={field}><strong>{formatEditFieldLabel(field)}:</strong> {editForm[field] || 'Not provided'}</p>
                  ))}
                </section>

                <section className="applicant-detail-card">
                  <div className="applicant-detail-heading">
                    <h3>Appointment</h3>
                    {editingSection !== 'appointment' && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('appointment'); setEditError('') }}>Edit information</button>}
                  </div>
                  {editingSection === 'appointment' ? (
                    <form onSubmit={saveApplicationEdit}>
                      {renderEditFields(appointmentEditFields)}
                      <div className="applicant-modal-actions">{renderSectionActions()}</div>
                      {editError && <p className="application-edit-error">{editError}</p>}
                    </form>
                  ) : (
                    <>
                      <p><strong>Preferred date:</strong> {formatNotificationDate(selectedApplication.preferredAppointmentDate)}</p>
                      <p><strong>Preferred time:</strong> {selectedApplication.preferredAppointmentTime || 'Not provided'}</p>
                      <p><strong>Scheduled date:</strong> {formatNotificationDate(selectedApplication.appointmentDate)}</p>
                      <p><strong>Scheduled time:</strong> {selectedApplication.appointmentTime || 'To be assigned by office'}</p>
                      <p><strong>Location:</strong> {selectedApplication.appointmentLocation || 'Not provided'}</p>
                      <p><strong>Status:</strong> {selectedApplication.status || 'For Review'}</p>
                      <p><strong>Counseling appointment:</strong> {selectedApplication.secondAppointmentDate ? formatNotificationDate(selectedApplication.secondAppointmentDate, selectedApplication.secondAppointmentTime) : 'Not scheduled'}</p>
                      <p><strong>Marriage license release:</strong> {selectedApplication.licenseReleaseDate ? formatNotificationDate(selectedApplication.licenseReleaseDate) : 'Not announced'}</p>
                    </>
                  )}
                </section>

                {otherEditFields.length > 0 && (
                  <section className="applicant-detail-card">
                    <div className="applicant-detail-heading">
                      <h3>Other submitted information</h3>
                      {editingSection !== 'other' && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('other'); setEditError('') }}>Edit information</button>}
                    </div>
                    {editingSection === 'other' ? (
                      <form onSubmit={saveApplicationEdit}>
                        {renderEditFields(otherEditFields)}
                        <div className="applicant-modal-actions">{renderSectionActions()}</div>
                        {editError && <p className="application-edit-error">{editError}</p>}
                      </form>
                    ) : otherEditFields.map((field) => (
                      <p key={field}><strong>{formatEditFieldLabel(field)}:</strong> {editForm[field] || 'Not provided'}</p>
                    ))}
                  </section>
                )}

                {Object.keys(editDocuments).length > 0 && (
                  <section className="applicant-detail-card applicant-edit-documents">
                    <div className="applicant-detail-heading">
                      <h3>Submitted documents</h3>
                      {editingSection !== 'documents' && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('documents'); setEditError('') }}>Edit information</button>}
                    </div>
                    {editingSection === 'documents' ? (
                      <form onSubmit={saveApplicationEdit}>
                        {Object.entries(editDocuments).map(([key, value]) => (
                          <label key={key}>{formatEditFieldLabel(key)}<input type="file" accept="image/*,.pdf" onChange={(event) => updateEditDocument(key, event)} /><small>{typeof value === 'string' ? 'Document saved' : value?.name || 'Choose a replacement file'}</small></label>
                        ))}
                        <div className="applicant-modal-actions">{renderSectionActions()}</div>
                        {editError && <p className="application-edit-error">{editError}</p>}
                      </form>
                    ) : Object.entries(editDocuments).map(([key]) => (
                      <p key={key}><strong>{formatEditFieldLabel(key)}:</strong> {selectedApplication.documents?.[key] ? 'Document saved' : 'Not provided'}</p>
                    ))}
                  </section>
                )}

                <div className="applicant-document-review">
                  <h3>Document review</h3>
                  {Object.entries(selectedApplication.documents || {}).map(([key]) => {
                    const reviewStatus = selectedApplication.documentReviews?.[key] || 'Pending review'
                    const reviewNote = selectedApplication.documentReviewNotes?.[key]
                    return (
                      <p key={key}>
                        <strong>{formatEditFieldLabel(key)}:</strong>
                        <span className={reviewStatus === 'Needs Redo' ? 'document-status-redo' : ''}>{reviewStatus}</span>
                        {reviewStatus === 'Needs Redo' && (
                          <small className="document-redo-note">{reviewNote || 'Please replace this document and save your changes.'}</small>
                        )}
                      </p>
                    )
                  })}
                </div>

                <div className="applicant-modal-actions">
                  <button type="button" className="application-view-button" onClick={() => printExcelForm(selectedApplication._id)}>
                    Print form
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

      </section>
  )
}
