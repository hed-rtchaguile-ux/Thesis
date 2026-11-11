import { useState } from 'react'
import { apiFetch } from '../auth'
import { getFirstAppointmentDate, getAppointmentTime } from './applicationSearch'

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
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`
}

export default function SecondAppointmentControl({ application, onSaved, canApproveFirstCounseling = false }) {
  const firstDate = dateKey(getFirstAppointmentDate(application))
  const today = todayKey()
  const firstAppointmentPassed = Boolean(firstDate && firstDate < today)
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function approveFirstCounseling(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch(`/api/applications/${application._id}/first-counseling/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to approve the first counseling.')
      onSaved(result)
      const emails = [
        result.notificationDelivery?.firstCounseling?.email,
        result.notificationDelivery?.secondAppointment?.email,
      ]
      setMessage(emails.some((email) => email?.status !== 'accepted')
        ? 'Counseling approved and scheduled, but an email could not be sent. Check the email configuration and server logs.'
        : 'First counseling approved. The second counseling was scheduled and emailed; a reminder will be sent three days before.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-second-appointment" aria-label="First appointment approval and second counseling">
      <div className="admin-second-appointment-heading">
        <h4>1st appointment · 2nd counseling</h4>
        {application.firstCounselingApprovedAt && <span>Approved</span>}
      </div>
      {!firstDate
        ? <p>Set the first appointment date before approving it.</p>
        : application.firstCounselingApprovedAt
          ? <p>Second counseling: {application.secondAppointmentDate} at {application.secondAppointmentTime}. An email reminder is scheduled for three days before.</p>
          : !firstAppointmentPassed
            ? <p>Approval is available after the first appointment ({firstDate}{getAppointmentTime(application) ? ` at ${getAppointmentTime(application)}` : ''}) has passed.</p>
            : canApproveFirstCounseling
              ? <form onSubmit={approveFirstCounseling}>
                <p className="admin-second-appointment-note">Approving confirms the first appointment and automatically schedules the second counseling on the next last Wednesday of the month.</p>
                <label>2nd counseling time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
                <button type="submit" disabled={!time || saving}>{saving ? 'Approving...' : 'Approve 1st Appointment & Schedule 2nd Counseling'}</button>
              </form>
              : <p>Waiting for an admin to approve the first appointment.</p>}
      {error && <p className="admin-appointment-error" role="alert">{error}</p>}
      {message && <p className="admin-second-appointment-success" role="status">{message}</p>}
    </section>
  )
}
