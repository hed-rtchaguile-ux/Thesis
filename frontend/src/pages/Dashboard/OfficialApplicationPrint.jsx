import { useEffect, useState } from 'react'
import { apiFetch } from '../auth'
import './OfficialApplicationForm.css'

export default function OfficialApplicationPrint({ application }) {
  const [preview, setPreview] = useState({ applicationId: '', html: '', error: '' })

  useEffect(() => {
    let isCurrent = true

    async function loadPreview() {
      try {
        const response = await apiFetch(`/api/applications/${application._id}/print/preview`)
        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.message || 'Unable to prepare the application preview.')
        }

        const html = await response.text()
        if (isCurrent) setPreview({ applicationId: application._id, html, error: '' })
      } catch (previewError) {
        if (isCurrent) setPreview({ applicationId: application._id, html: '', error: previewError.message })
      }
    }

    loadPreview()
    return () => { isCurrent = false }
  }, [application._id])

  return (
    <div className="excel-print-sheet">
      {preview.error && <p className="excel-form-error" role="alert">{preview.error}</p>}
      {(preview.applicationId !== application._id || !preview.html) && !preview.error && (
        <p className="excel-form-loading" role="status">Preparing application form...</p>
      )}
      {preview.applicationId === application._id && preview.html && (
        <div className="excel-form-preview" dangerouslySetInnerHTML={{ __html: preview.html }} />
      )}
    </div>
  )
}
