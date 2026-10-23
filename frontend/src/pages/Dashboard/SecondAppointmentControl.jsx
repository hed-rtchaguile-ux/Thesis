import { useState } from 'react'
import { apiFetch } from '../auth'
import { getFirstAppointmentDate } from './applicationSearch'

function dateKey(value) {
  const normalized = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized)
  if (!match) return ''
  const [, first, second, year] = match
  const month = Number(first) > 12 ? Number(second) : Number(first)
  const day = Number(first) > 12 ? Number(first) : Number(second)
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : ''
}

function todayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function SecondAppointmentControl({ application, onSaved }) {
  const firstDate = dateKey(getFirstAppointmentDate(application))
  const firstAppointmentPassed = Boolean(firstDate && firstDate < todayKey())
  const [date, setDate] = useState(application.secondAppointmentDate || '')
  const [time, setTime] = useState(application.secondAppointmentTime || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function saveAppointment(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch(`/api/applications/${application._id}/second-appointment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to schedule the counseling appointment.')
      onSaved(result)
      setMessage('Counseling appointment saved.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-second-appointment" aria-label="Second counseling appointment">
      <div className="admin-second-appointment-heading">
        <h4>Second appointment · Counseling</h4>
        {application.secondAppointmentDate && <span>Scheduled: {application.secondAppointmentDate}{application.secondAppointmentTime ? ` at ${application.secondAppointmentTime}` : ''}</span>}
      </div>
      {!firstDate ? <p>Set the first appointment date before scheduling counseling.</p>
        : !firstAppointmentPassed ? <p>Counseling can be scheduled after the first appointment date ({firstDate}) has passed.</p>
          : <form onSubmit={saveAppointment}>
            <label>Date<input type="date" value={date} min={todayKey()} onChange={(event) => setDate(event.target.value)} required /></label>
            <label>Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
            <button type="submit" disabled={!date || !time || saving}>{saving ? 'Saving...' : application.secondAppointmentDate ? 'Update counseling appointment' : 'Set counseling appointment'}</button>
          </form>}
      {error && <p className="admin-appointment-error" role="alert">{error}</p>}
      {message && <p className="admin-second-appointment-success" role="status">{message}</p>}
    </section>
  )
}
