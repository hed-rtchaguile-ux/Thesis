import { useState } from 'react'
import { apiFetch } from '../auth'

function getApplicantFields(application) {
  const data = application.applicationData && typeof application.applicationData === 'object'
    ? application.applicationData
    : {}
  const fields = Object.fromEntries(Object.entries(data).filter(([key, value]) => (
    /^(groom|bride)[A-Za-z0-9]*$/.test(key)
    && ['string', 'number', 'boolean'].includes(typeof value)
  )).map(([key, value]) => [key, String(value)]))

  for (const person of ['groom', 'bride']) {
    const rootFields = {
      [`${person}FullName`]: application[`${person}FullName`],
      [`${person}Dob`]: application[`${person}Dob`],
      [`${person}Gender`]: application[`${person}Gender`],
      [`${person}CivilStatus`]: application[`${person}CivilStatus`],
      [`${person}Mobile`]: application[`${person}Mobile`],
      [`${person}Email`]: application[`${person}Email`],
    }
    Object.entries(rootFields).forEach(([key, value]) => {
      if (!(key in fields) && value) fields[key] = String(value)
    })

    const hasNameParts = [`${person}FirstName`, `${person}LastName`].some((key) => key in fields)
    const hasDateParts = [`${person}DobDay`, `${person}DobMonth`, `${person}DobYear`].some((key) => key in fields)
    if (hasNameParts) delete fields[`${person}FullName`]
    if (hasDateParts) delete fields[`${person}Dob`]
    if (`${person}Age` in fields) delete fields[`${person}Age`]
    if ([`${person}ResidenceHouseNo`, `${person}ResidenceStreet`].some((key) => key in fields)) {
      delete fields[`${person}Residence`]
    }
    if ([`${person}BirthPlaceCity`, `${person}BirthPlaceProvince`].some((key) => key in fields)) {
      delete fields[`${person}PlaceOfBirth`]
    }
  }

  return fields
}

function formatFieldLabel(key) {
  return key.replace(/^(groom|bride)/, '$1 ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase())
}

export default function AdminApplicationEditor({ application, onSaved }) {
  const [values, setValues] = useState(() => getApplicantFields(application))
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function saveApplicantInformation(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const response = await apiFetch(`/api/applications/${application._id}/admin-information`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationData: values }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save applicant information.')
      setValues(getApplicantFields(result))
      setIsEditing(false)
      onSaved(result)
    } catch (saveError) {
      setError(saveError.message || 'Unable to save applicant information.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <details className="admin-application-editor" onToggle={(event) => {
      if (event.currentTarget.open) setValues(getApplicantFields(application))
    }}>
      <summary>Edit applicant information</summary>
      {isEditing ? (
        <form className="admin-application-editor-form" onSubmit={saveApplicantInformation}>
          {Object.entries(values).map(([key, value]) => (
            <label key={key}>
              {formatFieldLabel(key)}
              {key.endsWith('Declaration') ? (
                <textarea
                  rows="3"
                  value={value}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                />
              )}
            </label>
          ))}
          <div className="admin-application-editor-actions">
            <button type="button" className="admin-details-button" onClick={() => {
              setValues(getApplicantFields(application))
              setError('')
              setIsEditing(false)
            }}>Cancel</button>
            <button type="submit" className="admin-document-accept" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save applicant information'}
            </button>
          </div>
          {error && <p className="admin-appointment-error" role="alert">{error}</p>}
        </form>
      ) : (
        <button type="button" className="admin-details-button" onClick={() => setIsEditing(true)}>
          Edit information
        </button>
      )}
    </details>
  )
}
