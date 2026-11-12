import { useEffect, useState } from 'react'
import { apiFetch } from '../auth'
import {
  getAppointmentTime,
  getFirstAppointmentAttendanceStatus,
  getFirstAppointmentDate,
  getFirstCounselingDate,
  getFirstCounselingTime,
  hasAppointmentPassed,
} from './applicationSearch'

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

export default function SecondAppointmentControl({ application, onSaved, canApproveFirstCounseling = false }) {
  const firstDate = dateKey(getFirstAppointmentDate(application))
  const firstCounselingDate = dateKey(getFirstCounselingDate(application))
  const firstCounselingTime = getFirstCounselingTime(application)
  const attendanceStatus = getFirstAppointmentAttendanceStatus(application)
  const [now, setNow] = useState(() => new Date())
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(clock)
  }, [])

  const firstAppointmentPassed = hasAppointmentPassed(firstDate, getAppointmentTime(application), now)
  const firstCounselingPassed = hasAppointmentPassed(firstCounselingDate, firstCounselingTime, now)

  async function updateAttendance(status, event) {
    if (event) event.preventDefault()
    if (status === 'no-show' && !window.confirm('Mark this appointment as not attended? This will not reject the application.')) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch(`/api/applications/${application._id}/first-appointment/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceStatus: status, time }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to record first appointment attendance.')
      onSaved(result)
      setMessage(result.notificationDelivery?.email?.status === 'accepted'
        ? status === 'attended'
          ? 'Attendance confirmed. First counseling was scheduled and the applicant was emailed.'
          : 'Marked as not attended. The application remains active; the applicant was asked to contact the office to reschedule.'
        : status === 'attended'
          ? 'Attendance confirmed and first counseling scheduled, but the applicant email could not be sent.'
          : 'Marked as not attended, but the applicant email could not be sent.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function approveFirstCounseling() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch(`/api/applications/${application._id}/first-counseling/approve`, {
        method: 'PUT',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to start the 10-day posting.')
      onSaved(result)
      setMessage(result.notificationDelivery?.email?.status === 'accepted'
        ? 'First counseling approved. The 10-day posting started and the applicant was emailed.'
        : 'First counseling approved and posting started, but the applicant email could not be sent.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-second-appointment" aria-label="First appointment and counseling workflow">
      <div className="admin-second-appointment-heading">
        <h4>First appointment and counseling</h4>
        {attendanceStatus === 'attended' && <span>Attendance confirmed</span>}
        {attendanceStatus === 'no-show' && <span>No-show</span>}
      </div>
      {!firstDate
        ? <p>Set the first appointment date before recording attendance.</p>
        : application.postingStartDate
          ? <p>The 10-day posting started on {application.postingStartDate}. The marriage license is scheduled for release on {application.licenseReleaseDate}.</p>
          : attendanceStatus === 'no-show'
            ? <p>The appointment was marked as not attended. The application remains active; contact the applicant to arrange rescheduling.</p>
            : attendanceStatus === 'attended'
              ? <div>
                <p>First counseling: {getFirstCounselingDate(application) || 'Not scheduled'}{firstCounselingTime ? ` at ${firstCounselingTime}` : ''}.</p>
                {application.firstCounselingCompletedAt
                  ? <p>First counseling is approved.</p>
                  : !firstCounselingDate
                    ? <p>First counseling has not been scheduled.</p>
                    : !firstCounselingPassed
                      ? <p>Approval is available after the first counseling date and time have passed.</p>
                      : canApproveFirstCounseling
                        ? <button type="button" className="admin-posting-approve" onClick={approveFirstCounseling} disabled={saving}>{saving ? 'Approving...' : 'Approve 1st Counseling & Start 10-Day Posting'}</button>
                        : <p>Waiting for an admin to approve the first counseling.</p>}
              </div>
          : !firstAppointmentPassed
            ? <p>Approval is available after the first appointment ({firstDate}{getAppointmentTime(application) ? ` at ${getAppointmentTime(application)}` : ''}) has passed.</p>
            : canApproveFirstCounseling
              ? <form onSubmit={(event) => updateAttendance('attended', event)}>
                <p className="admin-second-appointment-note">Confirm attendance to schedule the 1st Counseling on the next last Wednesday of the month.</p>
                <label>1st counseling time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
                <div className="admin-appointment-workflow-actions">
                  <button type="submit" disabled={!time || saving}>{saving ? 'Saving...' : 'Approve attendance'}</button>
                  <button type="button" className="admin-appointment-decline" onClick={() => updateAttendance('no-show')} disabled={saving}>{saving ? 'Saving...' : 'Decline (no-show)'}</button>
                </div>
              </form>
              : <p>Waiting for an admin to record first appointment attendance.</p>}
      {error && <p className="admin-appointment-error" role="alert">{error}</p>}
      {message && <p className="admin-second-appointment-success" role="status">{message}</p>}
    </section>
  )
}
