import { useState } from 'react'
import { apiFetch } from '../auth'

export default function DeletionRequestReview({ application, onReviewed }) {
  const [actionInProgress, setActionInProgress] = useState('')
  const [error, setError] = useState('')

  if (application.deletionRequestStatus !== 'Pending') return null

  async function reviewRequest(action) {
    if (action === 'approve' && !window.confirm('Approve this request and permanently delete the application?')) return

    setActionInProgress(action)
    setError('')
    try {
      const response = await apiFetch(`/api/applications/${application._id}/deletion-request/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to review the deletion request.')
      onReviewed(result)
    } catch (requestError) {
      setError(requestError.message || 'Unable to review the deletion request.')
    } finally {
      setActionInProgress('')
    }
  }

  return (
    <section className="admin-details-group deletion-request-review" aria-label="Application deletion request">
      <h4>Applicant requested deletion</h4>
      {application.deletionRequestedAt && (
        <p>Requested {new Date(application.deletionRequestedAt).toLocaleString()}</p>
      )}
      <div className="deletion-request-review-actions">
        <button
          type="button"
          className="admin-document-accept"
          disabled={Boolean(actionInProgress)}
          onClick={() => void reviewRequest('approve')}
        >
          {actionInProgress === 'approve' ? 'Approving...' : 'Approve deletion'}
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
