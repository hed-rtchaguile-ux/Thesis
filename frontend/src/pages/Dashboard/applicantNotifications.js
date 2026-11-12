import { isHiddenMarriageLicenseDocument } from './documentLabels'
import {
  getFirstAppointmentAttendanceStatus,
  getFirstCounselingDate,
  getFirstCounselingTime,
} from './applicationSearch'

export function formatNotificationDate(value, time = '') {
  if (!value || value === 'To be assigned by office') return 'None'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
  return time ? `${formattedDate} at ${time}` : formattedDate
}

function formatDocumentName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
}

export function getApplicantNotifications(applications, unreadOnly = false) {
  return applications.flatMap((application) => {
    const coupleNames = [application.groomFullName, application.brideFullName].filter(Boolean).join(' & ') || 'your application'
    const notificationReads = application.notificationReads || {}
    const notifications = []

    function addNotification(notificationKey, title, message, action) {
      const isRead = Boolean(notificationReads[notificationKey])
      if (unreadOnly && isRead) return
      notifications.push({
        id: `${application._id}-${notificationKey}`,
        application,
        notificationKey,
        title,
        message,
        action,
        isRead,
      })
    }

    if (application._id && application.createdAt) {
      addNotification(
        'submitted',
        'Application received',
        `We received the marriage license application for ${coupleNames}. You can follow updates in your WedRings account.`,
        'View application',
      )
    }

    if (application.appointmentDate && application.appointmentDate !== 'To be assigned by office') {
      addNotification(
        'appointment',
        'Appointment scheduled',
        `Your appointment for ${coupleNames} is scheduled for ${formatNotificationDate(application.appointmentDate, application.appointmentTime)}.`,
        'View appointment',
      )
    }

    const attendanceStatus = getFirstAppointmentAttendanceStatus(application)
    if (attendanceStatus === 'no-show') {
      addNotification(
        'firstAppointmentNoShow',
        'First appointment not attended',
        `The first appointment for ${coupleNames} was marked as not attended. Your application remains active. Please contact the office to reschedule.`,
        'View application',
      )
    }

    if (attendanceStatus === 'attended' && getFirstCounselingDate(application)) {
      addNotification(
        'firstCounselingScheduled',
        'First counseling scheduled',
        `Your first counseling is scheduled for ${formatNotificationDate(getFirstCounselingDate(application), getFirstCounselingTime(application))}.`,
        'View counseling appointment',
      )
    }

    if (application.postingStartDate) {
      addNotification(
        'postingStarted',
        '10-day posting started',
        `The 10-day posting for ${coupleNames} began on ${formatNotificationDate(application.postingStartDate)}. Your marriage license is scheduled for release on ${formatNotificationDate(application.licenseReleaseDate)}.`,
        'View application',
      )
    }

    if (application.status === 'Rejected') {
      addNotification(
        'rejected',
        'Application needs updating',
        `Your application for ${coupleNames} was not approved. Please contact the office for assistance.`,
        'View application',
      )
    }

    if (application.licenseReleaseDate) {
      addNotification(
        'licenseRelease',
        'Marriage license release',
        `Your marriage license is scheduled for release on ${formatNotificationDate(application.licenseReleaseDate)}.`,
        'View release date',
      )
    }

    Object.entries(application.documentReviews || {}).forEach(([documentKey, status]) => {
      if (status !== 'Needs Redo' || isHiddenMarriageLicenseDocument(documentKey)) return
      const notificationKey = `redo-${documentKey}`
      const reviewNote = application.documentReviewNotes?.[documentKey]
      addNotification(
        notificationKey,
        'Document needs replacement',
        reviewNote
          ? `${formatDocumentName(documentKey)} needs to be replaced for ${coupleNames}. Reviewer note: ${reviewNote}`
          : `${formatDocumentName(documentKey)} needs to be replaced for ${coupleNames}.`,
        'View document status',
      )
    })

    return notifications
  })
}
