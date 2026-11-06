import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from '../auth'
import { appointmentTimeOptions } from '../../appointmentTimeSlots'
import DocumentPreview from './DocumentPreview'
import { printExcelForm } from './printExcelForm'
import { formatNotificationDate, getApplicantNotifications } from './applicantNotifications'
import './ApplicantDashboard.css'

const FIXED_PAYMENT_METHOD = 'Over the counter (Cash)'
const FIXED_PAYMENT_AMOUNT = '₱ 250.00'

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
  const [appointmentSlots, setAppointmentSlots] = useState([])
  const [appointmentSlotsStatus, setAppointmentSlotsStatus] = useState('idle')
  const [appointmentSlotsError, setAppointmentSlotsError] = useState('')
  const [appointmentSlotsRefresh, setAppointmentSlotsRefresh] = useState(0)
  const [editDocuments, setEditDocuments] = useState({})
  const [editError, setEditError] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editRequestComment, setEditRequestComment] = useState('')
  const [isRequestingEdit, setIsRequestingEdit] = useState(false)
  const [isFinishingEdit, setIsFinishingEdit] = useState(false)
  const [receiptUploads, setReceiptUploads] = useState({})
  const [receiptErrors, setReceiptErrors] = useState({})
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState({})
  const [deletionRequests, setDeletionRequests] = useState({})
  const [deletionRequestErrors, setDeletionRequestErrors] = useState({})
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
      setSelectedApplication((current) => current
        ? fetchedApplications.find((item) => item._id === current._id) || current
        : current)
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

  useEffect(() => {
    let active = true
    const applicationId = selectedApplication?._id
    const date = editForm.appointmentDate
    if (editingSection !== 'appointment' || !applicationId || !date) {
      setAppointmentSlots([])
      setAppointmentSlotsStatus('idle')
      setAppointmentSlotsError('')
      return () => {
        active = false
      }
    }

    setAppointmentSlots([])
    setAppointmentSlotsStatus('loading')
    setAppointmentSlotsError('')
    const query = new URLSearchParams({ date, excludeApplicationId: applicationId })
    apiFetch(`/api/appointment-slots?${query}`)
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load appointment availability.')
        if (!Array.isArray(result.slots)) throw new Error('The appointment availability response was invalid.')
        return result.slots
      })
      .then((slots) => {
        if (!active) return
        setAppointmentSlots(slots)
        setAppointmentSlotsStatus('ready')
        setEditForm((currentForm) => {
          if (currentForm.appointmentDate !== date || !currentForm.appointmentTime) return currentForm
          const selectedSlot = slots.find((slot) => slot.value === currentForm.appointmentTime)
          return selectedSlot?.available ? currentForm : { ...currentForm, appointmentTime: '' }
        })
      })
      .catch((error) => {
        if (!active) return
        setAppointmentSlotsStatus('error')
        setAppointmentSlotsError(error.message)
      })

    return () => {
      active = false
    }
  }, [appointmentSlotsRefresh, editingSection, editForm.appointmentDate, selectedApplication?._id])

  const applicantNotifications = getApplicantNotifications(applications, true)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  async function requestApplicationDeletion(applicationRecord) {
    if (!window.confirm('Request deletion of this application? It will remain active until an admin approves the request.')) return

    setDeletionRequests((current) => ({ ...current, [applicationRecord._id]: true }))
    setDeletionRequestErrors((current) => ({ ...current, [applicationRecord._id]: '' }))
    try {
      const response = await apiFetch(`/api/applications/${applicationRecord._id}/deletion-request`, {
        method: 'POST',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to request application deletion.')
      setApplications((current) => current.map((item) => item._id === result._id ? result : item))
    } catch (error) {
      setDeletionRequestErrors((current) => ({
        ...current,
        [applicationRecord._id]: error.message || 'Unable to request application deletion.',
      }))
    } finally {
      setDeletionRequests((current) => ({ ...current, [applicationRecord._id]: false }))
    }
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
    setEditingSection(editing && applicationRecord.editRequestStatus === 'Approved' ? 'groom' : '')
    setEditError('')
    setEditRequestComment('')
    setEditForm(getEditableApplicationData(applicationRecord))
    setEditDocuments(applicationRecord.documents || {})
  }, [getEditableApplicationData])

  async function requestApplicationEdit(event) {
    event.preventDefault()
    const comment = editRequestComment.trim()
    if (!comment) {
      setEditError('Describe what you need to edit.')
      return
    }

    setIsRequestingEdit(true)
    setEditError('')
    try {
      const response = await apiFetch(`/api/applications/${selectedApplication._id}/edit-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to submit the edit request.')
      setApplications((current) => current.map((item) => item._id === result._id ? result : item))
      setSelectedApplication(result)
      setEditRequestComment('')
    } catch (error) {
      setEditError(error.message || 'Unable to submit the edit request.')
    } finally {
      setIsRequestingEdit(false)
    }
  }

  async function finishApplicationEdit() {
    setIsFinishingEdit(true)
    setEditError('')
    try {
      const response = await apiFetch(`/api/applications/${selectedApplication._id}/edit-request/complete`, {
        method: 'PUT',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to finish application edits.')
      setApplications((current) => current.map((item) => item._id === result._id ? result : item))
      setSelectedApplication(result)
      setEditingSection('')
    } catch (error) {
      setEditError(error.message || 'Unable to finish application edits.')
    } finally {
      setIsFinishingEdit(false)
    }
  }

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
    if (editingSection === 'appointment'
      && (appointmentSlotsStatus !== 'ready'
        || !appointmentSlots.some((slot) => slot.value === editForm.appointmentTime && slot.available))) {
      setEditError(appointmentSlotsStatus === 'error'
        ? appointmentSlotsError || 'Unable to verify appointment availability. Please try again.'
        : 'Choose an available appointment time.')
      return
    }
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
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        if (response.status === 409 && editingSection === 'appointment') {
          setAppointmentSlotsRefresh((current) => current + 1)
        }
        throw new Error(result?.message || 'Unable to save your changes.')
      }

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
    const previouslyMarriedMatch = /^(groom|bride)PreviouslyMarried$/.exec(field)
    if (field === 'appointmentDate' || field === 'appointmentTime') setEditError('')
    setEditForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [field]: value,
        ...(field === 'appointmentDate' && currentForm.appointmentDate !== value ? { appointmentTime: '' } : {}),
      }
      if (previouslyMarriedMatch && value === 'No') {
        const dissolutionPrefix = `${previouslyMarriedMatch[1]}Dissolution`
        Object.keys(nextForm).forEach((key) => {
          if (key.startsWith(dissolutionPrefix)) nextForm[key] = ''
        })
      }
      return nextForm
    })
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

  function getApplicantInfoItems(fields, person) {
    const visibleFields = getVisibleEditFields(fields)
    const visibleFieldSet = new Set(visibleFields)
    const groupedFields = new Set()
    const items = []
    const advisorAddressFields = [
      `${person}AdvisorResidenceHouseNo`,
      `${person}AdvisorResidenceStreet`,
      `${person}AdvisorResidenceBarangay`,
      `${person}AdvisorResidenceCity`,
      `${person}AdvisorResidenceProvince`,
      `${person}AdvisorResidenceCountry`,
    ]
    const getValue = (field) => String(editForm[field] ?? '').trim()
    const addGroup = (label, keys, fallbackKey, separator = ' ') => {
      keys.forEach((key) => groupedFields.add(key))
      const value = keys.map(getValue).filter(Boolean).join(separator) || (fallbackKey ? getValue(fallbackKey) : '')
      if (value && value.toLowerCase() !== 'not provided') items.push({ label, value })
    }

    addGroup('Full name', [
      `${person}FirstName`,
      `${person}MiddleName`,
      `${person}LastName`,
      `${person}Suffix`,
    ], `${person}FullName`)
    addGroup('Date of birth', [
      `${person}DobMonth`,
      `${person}DobDay`,
      `${person}DobYear`,
    ], `${person}Dob`, '/')
    addGroup('Place of birth', [
      `${person}BirthPlaceCity`,
      `${person}BirthPlaceProvince`,
      `${person}BirthPlaceCountry`,
    ], `${person}PlaceOfBirth`, ', ')
    addGroup('Address', [
      `${person}ResidenceHouseNo`,
      `${person}ResidenceStreet`,
      `${person}ResidenceBarangay`,
      `${person}ResidenceCity`,
      `${person}ResidenceProvince`,
      `${person}ResidenceCountry`,
    ], `${person}Residence`, ', ')
    addGroup("Father's name", [
      `${person}FatherFirstName`,
      `${person}FatherMiddleName`,
      `${person}FatherLastName`,
    ], `${person}FatherName`)
    addGroup("Father's address", [
      `${person}FatherResidenceHouseNo`,
      `${person}FatherResidenceStreet`,
      `${person}FatherResidenceBarangay`,
      `${person}FatherResidenceCity`,
      `${person}FatherResidenceProvince`,
      `${person}FatherResidenceCountry`,
    ], null, ', ')
    addGroup("Mother's maiden name", [
      `${person}MotherMaidenFirstName`,
      `${person}MotherMaidenMiddleName`,
      `${person}MotherMaidenLastName`,
    ], `${person}MotherMaidenName`)
    addGroup("Mother's address", [
      `${person}MotherResidenceHouseNo`,
      `${person}MotherResidenceStreet`,
      `${person}MotherResidenceBarangay`,
      `${person}MotherResidenceCity`,
      `${person}MotherResidenceProvince`,
      `${person}MotherResidenceCountry`,
    ], null, ', ')
    advisorAddressFields.forEach((field) => groupedFields.add(field))

    fields.forEach((field) => {
      if (!visibleFieldSet.has(field)) {
        if (field === `${person}AdvisorCitizenship`) {
          addGroup("Advisor's address", advisorAddressFields.filter((addressField) => visibleFieldSet.has(addressField)), null, ', ')
        }
        return
      }
      if (groupedFields.has(field)) return
      const label = formatEditFieldLabel(field.replace(new RegExp(`^${person}`, 'i'), ''))
      items.push({ label, value: getValue(field) })
      if (field === `${person}AdvisorCitizenship`) {
        addGroup("Advisor's address", advisorAddressFields.filter((addressField) => visibleFieldSet.has(addressField)), null, ', ')
      }
    })

    return items
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
        {fields
          .filter((field) => {
            const personMatch = /^(groom|bride)/.exec(field)
            return !personMatch
              || !/Dissolution/.test(field)
              || editForm[`${personMatch[1]}PreviouslyMarried`] === 'Yes'
          })
          .map((field) => (
          <label key={field}>
            {formatEditFieldLabel(field)}
            {/^(groom|bride)PreviouslyMarried$/.test(field) ? (
              <select
                value={String(editForm[field] ?? '')}
                onChange={(event) => updateEditField(field, event.target.value)}
              >
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            ) : field === 'appointmentTime' ? (
              <>
                <select
                  value={String(editForm[field] ?? '')}
                  onChange={(event) => updateEditField(field, event.target.value)}
                  disabled={appointmentSlotsStatus !== 'ready'}
                >
                  <option value="">
                    {appointmentSlotsStatus === 'loading'
                      ? 'Checking availability...'
                      : appointmentSlotsStatus === 'error'
                        ? 'Availability unavailable'
                        : 'Select a time'}
                  </option>
                  {appointmentTimeOptions.map(({ value, label }) => {
                    const isAvailable = appointmentSlots.some((slot) => slot.value === value && slot.available)
                    return (
                      <option key={value} value={value} disabled={!isAvailable}>
                        {isAvailable ? label : `${label} — Unavailable`}
                      </option>
                    )
                  })}
                </select>
                {appointmentSlotsStatus === 'error' && (
                  <small className="application-edit-error" role="alert">{appointmentSlotsError}</small>
                )}
                {appointmentSlotsStatus === 'ready' && appointmentSlots.every((slot) => !slot.available) && (
                  <small role="status">No appointment times are available on this date.</small>
                )}
              </>
            ) : (
              <input
                type={field === 'appointmentDate' ? 'date' : 'text'}
                value={String(editForm[field] ?? '')}
                onChange={(event) => updateEditField(field, event.target.value)}
              />
            )}
          </label>
          ))}
      </div>
    )
  }

  function renderSectionActions() {
    return (
      <>
        <button type="button" className="application-view-button" onClick={cancelSectionEdit}>Cancel</button>
        <button
          type="submit"
          className="application-edit-button"
          disabled={isSavingEdit || (editingSection === 'appointment' && appointmentSlotsStatus !== 'ready')}
        >
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
    && field !== 'paymentMethod'
    && field !== 'paymentAmount'
  ))
  const canEditApplication = selectedApplication?.editRequestStatus === 'Approved'
    && selectedApplication.deletionRequestStatus !== 'Pending'

  function getPersonAge(person) {
    const savedAge = Number(selectedApplication.applicationData?.[`${person}Age`])
    if (Number.isFinite(savedAge) && savedAge > 0) return savedAge
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(editForm[`${person}Dob`] || ''))
    if (!match) return null
    const [, monthText, dayText, yearText] = match
    const birthDate = new Date(Number(yearText), Number(monthText) - 1, Number(dayText))
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) return null
    const today = new Date()
    return today.getFullYear() - birthDate.getFullYear()
      - (today.getMonth() < birthDate.getMonth()
        || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
  }

  function getVisibleEditFields(fields) {
    return fields.filter((field) => {
      const value = editForm[field]
      if (value === undefined || value === null || String(value).trim() === '' || String(value).trim().toLowerCase() === 'not provided') return false
      const personMatch = /^(groom|bride)/.exec(field)
      if (!personMatch) return true
      const person = personMatch[1]
      if (/Dissolution/.test(field) && editForm[`${person}PreviouslyMarried`] !== 'Yes') return false
      if (/Advisor|Consent|Advice/i.test(field) && getPersonAge(person) >= 28) return false
      return true
    })
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
                      {item.deletionRequestStatus && (
                        <div>
                          <span className="application-label">Deletion request</span>
                          <strong>{item.deletionRequestStatus === 'Pending' ? 'Awaiting admin approval' : 'Not approved'}</strong>
                        </div>
                      )}
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
                            <button
                              type="button"
                              className="receipt-view-link"
                              aria-expanded={Boolean(receiptPreviewOpen[item._id])}
                              onClick={() => setReceiptPreviewOpen((current) => ({
                                ...current,
                                [item._id]: !current[item._id],
                              }))}
                            >
                              {receiptPreviewOpen[item._id] ? 'Hide receipt' : 'View uploaded receipt'}
                            </button>
                          )}
                        </div>
                        {item.paymentReceipt && receiptPreviewOpen[item._id] && (
                          <div className="application-receipt-preview">
                            <DocumentPreview label="Uploaded payment receipt" value={item.paymentReceipt} />
                          </div>
                        )}
                        <small className="application-receipt-hint">JPEG, PNG, or PDF · Maximum 5 MB</small>
                        {receiptErrors[item._id] && <p role="alert">{receiptErrors[item._id]}</p>}
                      </div>
                      <div className="application-actions">
                        <button type="button" className="application-view-button" onClick={() => openApplication(item)}>View submission</button>
                        <button type="button" className="application-view-button" onClick={() => printExcelForm(item._id)}>Print form</button>
                        {item.editRequestStatus && (
                          <span className="edit-request-status">
                            {item.editRequestStatus === 'Pending'
                              ? 'Edit request pending'
                              : item.editRequestStatus === 'Approved'
                                ? 'Editing approved'
                                : item.editRequestStatus === 'Rejected'
                                  ? 'Edit request not approved'
                                  : 'Previous edit completed'}
                          </span>
                        )}
                        <button
                          type="button"
                          className="application-deletion-request-button"
                          onClick={() => void requestApplicationDeletion(item)}
                          disabled={Boolean(deletionRequests[item._id]) || item.deletionRequestStatus === 'Pending'}
                        >
                          {deletionRequests[item._id]
                            ? 'Sending request...'
                            : item.deletionRequestStatus === 'Pending'
                              ? 'Deletion request pending'
                              : item.deletionRequestStatus === 'Rejected'
                                ? 'Request deletion again'
                                : 'Request deletion'}
                        </button>
                        {deletionRequestErrors[item._id] && (
                          <p className="application-deletion-request-error" role="alert">{deletionRequestErrors[item._id]}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {applications.length === 0 && applicationsStatus === 'ready' && (
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
          )}
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
                <details className="applicant-detail-card applicant-detail-disclosure">
                  <summary><h3>Groom information</h3></summary>
                  {editingSection === 'groom' ? (
                    <form onSubmit={saveApplicationEdit}>
                      {renderEditFields(groomEditFields)}
                      <div className="applicant-modal-actions">{renderSectionActions()}</div>
                      {editError && <p className="application-edit-error">{editError}</p>}
                    </form>
                  ) : (
                    <>
                      {canEditApplication && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('groom'); setEditError('') }}>Edit groom information</button>}
                      {getApplicantInfoItems(groomEditFields, 'groom').map(({ label, value }) => (
                    <p key={label}><strong>{label}:</strong> {value}</p>
                      ))}
                    </>
                  )}
                </details>

                <details className="applicant-detail-card applicant-detail-disclosure">
                  <summary><h3>Bride information</h3></summary>
                  {editingSection === 'bride' ? (
                    <form onSubmit={saveApplicationEdit}>
                      {renderEditFields(brideEditFields)}
                      <div className="applicant-modal-actions">{renderSectionActions()}</div>
                      {editError && <p className="application-edit-error">{editError}</p>}
                    </form>
                  ) : (
                    <>
                      {canEditApplication && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('bride'); setEditError('') }}>Edit bride information</button>}
                      {getApplicantInfoItems(brideEditFields, 'bride').map(({ label, value }) => (
                    <p key={label}><strong>{label}:</strong> {value}</p>
                      ))}
                    </>
                  )}
                </details>

                <details className="applicant-detail-card applicant-detail-disclosure">
                  <summary><h3>Appointment</h3></summary>
                  {editingSection === 'appointment' ? (
                    <form onSubmit={saveApplicationEdit}>
                      {renderEditFields(appointmentEditFields)}
                      <div className="applicant-modal-actions">{renderSectionActions()}</div>
                      {editError && <p className="application-edit-error">{editError}</p>}
                    </form>
                  ) : (
                    <>
                      {canEditApplication && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('appointment'); setEditError('') }}>Edit appointment information</button>}
                      {selectedApplication.preferredAppointmentDate && <p><strong>Preferred date:</strong> {formatNotificationDate(selectedApplication.preferredAppointmentDate)}</p>}
                      {selectedApplication.preferredAppointmentTime && <p><strong>Preferred time:</strong> {selectedApplication.preferredAppointmentTime}</p>}
                      {selectedApplication.appointmentDate && <p><strong>Scheduled date:</strong> {formatNotificationDate(selectedApplication.appointmentDate)}</p>}
                      {selectedApplication.appointmentTime && <p><strong>Scheduled time:</strong> {selectedApplication.appointmentTime}</p>}
                      {selectedApplication.appointmentLocation && <p><strong>Location:</strong> {selectedApplication.appointmentLocation}</p>}
                      <p><strong>Status:</strong> {selectedApplication.status || 'For Review'}</p>
                      {selectedApplication.secondAppointmentDate && <p><strong>Counseling appointment:</strong> {formatNotificationDate(selectedApplication.secondAppointmentDate, selectedApplication.secondAppointmentTime)}</p>}
                      {selectedApplication.licenseReleaseDate && <p><strong>Marriage license release:</strong> {formatNotificationDate(selectedApplication.licenseReleaseDate)}</p>}
                    </>
                  )}
                </details>

                {otherEditFields.length > 0 && (
                  <details className="applicant-detail-card applicant-detail-disclosure">
                    <summary><h3>Other submitted information</h3></summary>
                    {editingSection === 'other' ? (
                      <form onSubmit={saveApplicationEdit}>
                        {renderEditFields(otherEditFields)}
                        <div className="applicant-modal-actions">{renderSectionActions()}</div>
                        {editError && <p className="application-edit-error">{editError}</p>}
                      </form>
                    ) : (
                      <>
                        {canEditApplication && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('other'); setEditError('') }}>Edit other information</button>}
                        {getVisibleEditFields(otherEditFields).map((field) => (
                          <p key={field}><strong>{formatEditFieldLabel(field)}:</strong> {editForm[field]}</p>
                        ))}
                        <p><strong>Payment Method:</strong> {FIXED_PAYMENT_METHOD}</p>
                        <p><strong>Payment Amount:</strong> {FIXED_PAYMENT_AMOUNT}</p>
                      </>
                    )}
                  </details>
                )}

                {Object.keys(editDocuments).length > 0 && (
                  <details className="applicant-detail-card applicant-edit-documents applicant-detail-disclosure">
                    <summary><h3>Submitted documents</h3></summary>
                    {editingSection === 'documents' ? (
                      <form onSubmit={saveApplicationEdit}>
                        {Object.entries(editDocuments).map(([key, value]) => (
                          <label key={key}>{formatEditFieldLabel(key)}<input type="file" accept="image/*,.pdf" onChange={(event) => updateEditDocument(key, event)} /><small>{typeof value === 'string' ? 'Document saved' : value?.name || 'Choose a replacement file'}</small></label>
                        ))}
                        <div className="applicant-modal-actions">{renderSectionActions()}</div>
                        {editError && <p className="application-edit-error">{editError}</p>}
                      </form>
                    ) : (
                      <>
                        {canEditApplication && <button type="button" className="application-edit-button" onClick={() => { setEditingSection('documents'); setEditError('') }}>Edit documents</button>}
                        {Object.entries(editDocuments).filter(([key]) => selectedApplication.documents?.[key]).map(([key]) => (
                          <p key={key}><strong>{formatEditFieldLabel(key)}:</strong> Document saved</p>
                        ))}
                      </>
                    )}
                  </details>
                )}

                {Object.keys(selectedApplication.documents || {}).length > 0 && <details className="applicant-document-review applicant-detail-disclosure">
                  <summary><h3>Document review</h3></summary>
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
                </details>}

                <div className="applicant-modal-actions">
                  <button type="button" className="application-view-button" onClick={() => printExcelForm(selectedApplication._id)}>
                    Print form
                  </button>
                </div>
              </div>

              <section className="applicant-detail-card applicant-edit-request">
                <h3>Request to edit application</h3>
                {canEditApplication ? (
                  <>
                    <p>Your request was approved. You can edit and save information in multiple sections. Finish editing when you are done.</p>
                    {!editingSection && (
                      <button type="button" className="application-edit-button" onClick={() => void finishApplicationEdit()} disabled={isFinishingEdit}>
                        {isFinishingEdit ? 'Finishing...' : 'Finish editing'}
                      </button>
                    )}
                  </>
                ) : selectedApplication.editRequestStatus === 'Pending' ? (
                  <>
                    <p>Your edit request is awaiting admin review.</p>
                    <p><strong>Requested change:</strong> {selectedApplication.editRequestComment}</p>
                  </>
                ) : selectedApplication.deletionRequestStatus === 'Pending' ? (
                  <p>Editing is unavailable while a deletion request is pending.</p>
                ) : (
                  <form onSubmit={requestApplicationEdit}>
                    {selectedApplication.editRequestStatus === 'Rejected' && (
                      <p>Your previous edit request was not approved. You may submit a new request.</p>
                    )}
                    <label className="edit-request-comment">
                      What would you like to edit?
                      <textarea
                        rows="3"
                        maxLength="1000"
                        value={editRequestComment}
                        onChange={(event) => setEditRequestComment(event.target.value)}
                        placeholder="Describe the information you need to change."
                        required
                      />
                    </label>
                    <button type="submit" className="application-edit-button" disabled={isRequestingEdit}>
                      {isRequestingEdit ? 'Sending request...' : 'Submit edit request'}
                    </button>
                  </form>
                )}
                {editError && <p className="application-edit-error" role="alert">{editError}</p>}
              </section>
            </section>
          </div>
        )}

      </section>
  )
}
