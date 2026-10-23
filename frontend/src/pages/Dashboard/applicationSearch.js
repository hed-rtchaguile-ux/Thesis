export function filterApplications(applications, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase()
  if (!normalizedSearch) return applications
  return applications.filter((application) => [
    application.groomFullName,
    application.brideFullName,
    application.applicantEmail,
    application.groomEmail,
    application.brideEmail,
    application.groomMobile,
    application.brideMobile,
  ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch)))
}

export function getApplicationWorkflowStatus(application) {
  if (application.status === 'Rejected') return 'Rejected'
  if (application.status === 'Verified' && application.licenseReleaseDate) return 'Complete'
  if (application.status === 'Verified') return 'Verified'
  return 'Under Review'
}

export function filterApplicationsByStatus(applications, status) {
  if (!status || status === 'All') return applications
  return applications.filter((application) => getApplicationWorkflowStatus(application) === status)
}

export function getAppointmentDate(application) {
  if (application.appointmentDate && application.appointmentDate !== 'To be assigned by office') return application.appointmentDate
  return application.preferredAppointmentDate || ''
}

export function getFirstAppointmentDate(application) {
  return getAppointmentDate(application)
}

export function getFirstAppointmentTime(application) {
  if (application.appointmentDate && application.appointmentDate !== 'To be assigned by office') return application.appointmentTime || ''
  return application.preferredAppointmentTime || application.appointmentTime || ''
}

export function getAppointmentTime(application) {
  return getAppointmentDate(application) ? getFirstAppointmentTime(application) : ''
}

function getAppointmentTimeValue(value) {
  const normalizedValue = String(value || '').trim()
  const twelveHourTime = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(normalizedValue)
  if (twelveHourTime) {
    const [, hourText, minuteText, meridiem] = twelveHourTime
    const hour = Number(hourText) % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0)
    return hour * 60 + Number(minuteText)
  }

  const twentyFourHourTime = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalizedValue)
  if (twentyFourHourTime) return Number(twentyFourHourTime[1]) * 60 + Number(twentyFourHourTime[2])
  return Number.POSITIVE_INFINITY
}

export function sortAppointments(applications, getDateKey) {
  return [...applications].sort((firstApplication, secondApplication) => {
    const firstDate = getDateKey(getAppointmentDate(firstApplication))
    const secondDate = getDateKey(getAppointmentDate(secondApplication))
    if (firstDate && !secondDate) return -1
    if (!firstDate && secondDate) return 1
    if (firstDate !== secondDate) return firstDate.localeCompare(secondDate)

    const firstTime = getAppointmentTime(firstApplication)
    const secondTime = getAppointmentTime(secondApplication)
    const timeDifference = getAppointmentTimeValue(firstTime) - getAppointmentTimeValue(secondTime)
    if (timeDifference) return timeDifference

    const firstNames = `${firstApplication.groomFullName || ''} ${firstApplication.brideFullName || ''}`
    const secondNames = `${secondApplication.groomFullName || ''} ${secondApplication.brideFullName || ''}`
    return firstNames.localeCompare(secondNames)
  })
}
