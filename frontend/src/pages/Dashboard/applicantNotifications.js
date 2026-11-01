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

    function addNotification(notificationKey, title, message, editing, action) {
      const isRead = Boolean(notificationReads[notificationKey])
      if (unreadOnly && isRead) return
      notifications.push({
        id: `${application._id}-${notificationKey}`,
        application,
        notificationKey,
        title,
        message,
        editing,
        action,
        isRead,
      })
    }

    if (application._id && application.createdAt) {
      addNotification(
        'submitted',
        'Application received',
        `We received the marriage license application for ${coupleNames}. You can follow updates in your WedRings account.`,
        false,
        'View application',
      )
    }

    if (application.deletionRequestStatus === 'Pending') {
      addNotification(
        'deletionRequest',
        'Deletion request submitted',
        'Your request to delete this application is awaiting admin approval. You can apply again after it is approved.',
        false,
        'View application',
      )
    }

    if (application.deletionRequestStatus === 'Rejected') {
      addNotification(
        'deletionRequest',
        'Deletion request not approved',
        'Your application remains active. Contact the office if you have questions.',
        false,
        'View application',
      )
    }

    if (application.appointmentDate && application.appointmentDate !== 'To be assigned by office') {
      addNotification(
        'appointment',
        'Appointment scheduled',
        `Your appointment for ${coupleNames} is scheduled for ${formatNotificationDate(application.appointmentDate, application.appointmentTime)}.`,
        false,
        'View appointment',
      )
    }

    if (application.secondAppointmentDate) {
      addNotification(
        'secondAppointment',
        'Counseling appointment scheduled',
        `Your second appointment for counseling is set for ${formatNotificationDate(application.secondAppointmentDate, application.secondAppointmentTime)}.`,
        false,
        'View counseling appointment',
      )
    }

    if (application.status === 'Rejected') {
      addNotification(
        'rejected',
        'Application needs updating',
        `Your application for ${coupleNames} was rejected. Please review and update it before submitting again.`,
        true,
        'Update application',
      )
    }

    if (application.licenseReleaseDate) {
      addNotification(
        'licenseRelease',
        'Marriage license release',
        `Your marriage license is scheduled for release on ${formatNotificationDate(application.licenseReleaseDate)}.`,
        false,
        'View release date',
      )
    }

    Object.entries(application.documentReviews || {}).forEach(([documentKey, status]) => {
      if (status !== 'Needs Redo') return
      const notificationKey = `redo-${documentKey}`
      const reviewNote = application.documentReviewNotes?.[documentKey]
      addNotification(
        notificationKey,
        'Document needs replacement',
        reviewNote
          ? `${formatDocumentName(documentKey)} needs to be replaced for ${coupleNames}. Reviewer note: ${reviewNote}`
          : `${formatDocumentName(documentKey)} needs to be replaced for ${coupleNames}.`,
        true,
        'Update document',
      )
    })

    return notifications
  })
}
