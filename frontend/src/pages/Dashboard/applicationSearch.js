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

export function getAppointmentDate(application) {
  return application.appointmentDate && application.appointmentDate !== 'To be assigned by office'
    ? application.appointmentDate
    : ''
}

export function getAppointmentTime(application) {
  return getAppointmentDate(application) ? application.appointmentTime || '' : ''
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