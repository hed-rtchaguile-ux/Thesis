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

async function readApiResponse(response, fallbackMessage) {
  const responseText = await response.text()
  let result
  try {
    result = responseText ? JSON.parse(responseText) : {}
  } catch {
    const message = responseText.trimStart().startsWith('<')
      ? `The backend returned an HTML page (HTTP ${response.status}) instead of API JSON. The latest backend route may not be deployed.`
      : `The backend returned an invalid response (HTTP ${response.status}).`
    throw new Error(message)
  }
  if (!response.ok) throw new Error(result.message || fallbackMessage)
  return result
}

function getRequestErrorMessage(error) {
  if (error instanceof TypeError) return 'Could not reach the backend. Check that the Render service is available.'
  return error.message || 'The request could not be completed.'
}

export default function SecondAppointmentControl({ application, onSaved, canApproveFirstCounseling = false }) {
  const firstDate = dateKey(getFirstAppointmentDate(application))
  const firstCounselingDate = dateKey(getFirstCounselingDate(application))
  const firstCounselingTime = getFirstCounselingTime(application)
  const attendanceStatus = getFirstAppointmentAttendanceStatus(application)
  const [now, setNow] = useState(() => new Date())
  const [timeDraft, setTimeDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const time = timeDraft?.applicationId === application._id && timeDraft.savedTime === firstCounselingTime
    ? timeDraft.value
    : firstCounselingTime

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
        body: JSON.stringify({ attendanceStatus: status }),
      })
      const result = await readApiResponse(response, 'Unable to record first appointment attendance.')
      onSaved(result)
      setMessage(result.notificationDelivery?.email?.status === 'accepted'
        ? status === 'attended'
          ? 'First appointment approved and complete. The applicant was emailed; schedule the 1st Counseling time below.'
          : 'Marked as not attended. The application remains active; the applicant was asked to contact the office to reschedule.'
        : status === 'attended'
          ? 'First appointment approved and complete, but the applicant email could not be sent.'
          : 'Marked as not attended, but the applicant email could not be sent.')
    } catch (saveError) {
      setError(getRequestErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function scheduleFirstCounseling(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiFetch(`/api/applications/${application._id}/first-counseling/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time }),
      })
      const result = await readApiResponse(response, 'Unable to schedule the first counseling.')
      onSaved(result)
      setMessage(result.notificationDelivery?.email?.status === 'accepted'
        ? '1st Counseling time saved and the applicant was emailed.'
        : '1st Counseling time saved, but the applicant email could not be sent.')
    } catch (saveError) {
      setError(getRequestErrorMessage(saveError))
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
      const result = await readApiResponse(response, 'Unable to start the 10-day posting.')
      onSaved(result)
      setMessage(result.notificationDelivery?.email?.status === 'accepted'
        ? 'First counseling approved. The 10-day posting started and the applicant was emailed.'
        : 'First counseling approved and posting started, but the applicant email could not be sent.')
    } catch (saveError) {
      setError(getRequestErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-second-appointment" aria-label="First appointment and counseling workflow">
      <div className="admin-second-appointment-heading">
        <h4>{application.postingStartDate ? '10-day posting' : attendanceStatus === 'attended' ? '1st Counseling' : 'First appointment'}</h4>
        {attendanceStatus === 'attended' && <span>First appointment complete</span>}
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
                <p><strong>First appointment is approved and complete.</strong></p>
                {!firstCounselingDate
                  ? <p>First counseling has not been scheduled.</p>
                  : !firstCounselingTime
                    ? canApproveFirstCounseling
                      ? <form onSubmit={scheduleFirstCounseling}>
                        <p className="admin-second-appointment-note">1st Counseling date: {firstCounselingDate}. Choose a time to finish scheduling.</p>
                        <label>1st counseling time<input type="time" value={time} onChange={(event) => setTimeDraft({ applicationId: application._id, savedTime: firstCounselingTime, value: event.target.value })} required /></label>
                        <button type="submit" disabled={!time || saving}>{saving ? 'Saving...' : 'Schedule 1st Counseling'}</button>
                      </form>
                      : <p>Waiting for an admin to schedule the first counseling.</p>
                    : <div>
                      <p>1st Counseling: {firstCounselingDate} at {firstCounselingTime}.</p>
                      {application.firstCounselingCompletedAt
                        ? <p>First counseling is approved.</p>
                        : !firstCounselingPassed
                          ? <p>Approval is available after the first counseling date and time have passed.</p>
                          : canApproveFirstCounseling
                            ? <button type="button" className="admin-posting-approve" onClick={approveFirstCounseling} disabled={saving}>{saving ? 'Approving...' : 'Approve 1st Counseling & Start 10-Day Posting'}</button>
                            : <p>Waiting for an admin to approve the first counseling.</p>}
                    </div>}
              </div>
            : !firstAppointmentPassed
              ? <p>Approval is available after the first appointment ({firstDate}{getAppointmentTime(application) ? ` at ${getAppointmentTime(application)}` : ''}) has passed.</p>
            : canApproveFirstCounseling
              ? <div>
                <p className="admin-second-appointment-note">Confirm attendance at the first appointment to continue.</p>
                <div className="admin-appointment-workflow-actions">
                  <button type="button" onClick={() => updateAttendance('attended')} disabled={saving}>{saving ? 'Saving...' : 'Approve First Appointment'}</button>
                  <button type="button" className="admin-appointment-decline" onClick={() => updateAttendance('no-show')} disabled={saving}>{saving ? 'Saving...' : 'Decline (no-show)'}</button>
                </div>
              </div>
              : <p>Waiting for an admin to record first appointment attendance.</p>}
      {error && <p className="admin-appointment-error" role="alert">{error}</p>}
      {message && <p className="admin-second-appointment-success" role="status">{message}</p>}
    </section>
  )
}
