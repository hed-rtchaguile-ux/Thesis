import { useState } from 'react'
import { apiFetch } from '../auth'

export default function EditRequestReview({ application, onReviewed }) {
  const [actionInProgress, setActionInProgress] = useState('')
  const [error, setError] = useState('')

  if (application.editRequestStatus !== 'Pending') return null

  async function reviewRequest(action) {
    setActionInProgress(action)
    setError('')
    try {
      const response = await apiFetch(`/api/applications/${application._id}/edit-request/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to review the edit request.')
      onReviewed(result.application)
    } catch (requestError) {
      setError(requestError.message || 'Unable to review the edit request.')
    } finally {
      setActionInProgress('')
    }
  }

  return (
    <section className="admin-details-group deletion-request-review" aria-label="Application edit request">
      <h4>Applicant requested permission to edit</h4>
      <p>{application.editRequestComment}</p>
      {application.editRequestedAt && (
        <p>Requested {new Date(application.editRequestedAt).toLocaleString()}</p>
      )}
      <div className="deletion-request-review-actions">
        <button
          type="button"
          className="admin-document-accept"
          disabled={Boolean(actionInProgress)}
          onClick={() => void reviewRequest('approve')}
        >
          {actionInProgress === 'approve' ? 'Approving...' : 'Approve editing'}
        </button>
        <button
          type="button"
          className="admin-document-flag"
          disabled={Boolean(actionInProgress)}
          onClick={() => void reviewRequest('reject')}
        >
          {actionInProgress === 'reject' ? 'Rejecting...' : 'Reject request'}
        </button>
      </div>
      {error && <p className="admin-appointment-error" role="alert">{error}</p>}
    </section>
  )
}
