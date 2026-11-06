export const appointmentTimeOptions = [
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
]

export function formatAppointmentTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return value

  const hour = Number(match[1])
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${match[2]} ${period}`
}
