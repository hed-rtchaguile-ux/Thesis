import { useState } from 'react'
import { apiFetch } from '../auth'

export default function LicenseReleaseControl({ application, onSaved }) {
  const [releaseDate, setReleaseDate] = useState(application.licenseReleaseDate || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function saveReleaseDate() {
    setError('')
    setMessage('')
    setIsSaving(true)
    try {
      const response = await apiFetch(`/api/applications/${application._id}/license-release-date`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseDate }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to notify the applicant.')
      onSaved(result)
      setMessage('Applicant notified.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="license-release-control">
      <label>
        License release date
        <input type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} required />
      </label>
      <button className="admin-verify-button" type="button" onClick={saveReleaseDate} disabled={!releaseDate || isSaving}>
        {isSaving ? 'Saving...' : 'Notify applicant'}
      </button>
      {error && <small className="license-release-error" role="alert">{error}</small>}
      {message && <small className="license-release-success" role="status">{message}</small>}
    </div>
  )
}
