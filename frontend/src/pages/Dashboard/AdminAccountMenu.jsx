import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from '../auth'

const actionLabels = {
  'application.information.updated': 'Applicant information updated',
  'application.status.updated': 'Application status updated',
  'appointment.first.approved': 'First appointment approved',
  'appointment.second.updated': 'Second appointment updated',
  'document.review.updated': 'Document review updated',
  'license.release-date.updated': 'License release date updated',
  'database.backup.downloaded': 'Database backup downloaded',
}

function formatAuditDetails(details = {}) {
  return Object.entries(details)
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
      const formattedValue = Array.isArray(value) ? value.join(', ') : String(value)
      return `${label}: ${formattedValue}`
    })
    .join(' · ')
}

export default function AdminAccountMenu({ basePath, displayName }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [menuError, setMenuError] = useState('')
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  async function openAuditLog() {
    setMenuOpen(false)
    setAuditOpen(true)
    setAuditLoading(true)
    setAuditError('')
    try {
      const response = await apiFetch('/api/admin/audit-logs')
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load audit history.')
      if (!Array.isArray(result)) throw new Error('The audit history response is invalid.')
      setAuditLogs(result)
    } catch (error) {
      setAuditError(error.message || 'Unable to load audit history.')
    } finally {
      setAuditLoading(false)
    }
  }

  async function downloadBackup() {
    setMenuError('')
    try {
      const response = await apiFetch('/api/admin/database-backup')
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Unable to download the database backup.')
      }

      const backupFile = await response.blob()
      if (!backupFile.size) throw new Error('The database backup file is empty.')
      const filename = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1]
        || 'wedrings-database-backup.json'
      const downloadUrl = window.URL.createObjectURL(backupFile)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000)
      setMenuOpen(false)
    } catch (error) {
      setMenuError(error.message || 'Unable to download the database backup.')
    }
  }

  function signOut() {
    setMenuOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <div className="user-menu-wrapper">
        <button
          type="button"
          className="admin-account-trigger"
          aria-label={`Open account menu for ${displayName}`}
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuError('')
            setMenuOpen((open) => !open)
          }}
        >
          <span className="user-avatar">{initials}</span>
          <span>{displayName}</span>
          <span className="admin-user-caret" aria-hidden="true">▾</span>
        </button>
        {menuOpen && (
          <div className="user-dropdown" role="menu" aria-label="Account actions">
            <button type="button" className="dropdown-item" role="menuitem" onClick={() => {
              setMenuOpen(false)
              navigate(`${basePath}/profile`)
            }}>Profile</button>
            <button type="button" className="dropdown-item" role="menuitem" onClick={openAuditLog}>Audit log</button>
            <button type="button" className="dropdown-item" role="menuitem" onClick={downloadBackup}>Backup database</button>
            {menuError && <p className="admin-account-menu-error" role="alert">{menuError}</p>}
            <button type="button" className="dropdown-item danger" role="menuitem" onClick={signOut}>Logout</button>
          </div>
        )}
      </div>
      {auditOpen && (
        <div className="review-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAuditOpen(false)
        }}>
          <section className="review-modal admin-audit-modal" role="dialog" aria-modal="true" aria-labelledby="admin-audit-title">
            <div className="review-modal-header">
              <div>
                <span className="admin-review-kicker">System activity</span>
                <h2 id="admin-audit-title">Audit log</h2>
                <p className="admin-audit-description">Latest 200 administrator actions.</p>
              </div>
              <button type="button" className="review-modal-close" aria-label="Close audit log" onClick={() => setAuditOpen(false)}>×</button>
            </div>
            {auditLoading ? <p className="admin-empty-state">Loading audit history...</p>
              : auditError ? <p className="admin-empty-state" role="alert">{auditError}</p>
                : auditLogs.length === 0 ? <p className="admin-empty-state">No administrator actions have been recorded yet.</p>
                  : <div className="admin-audit-table-wrap">
                    <table className="admin-audit-table">
                      <thead>
                        <tr><th>Date and time</th><th>Who</th><th>Action</th><th>Target and details</th></tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((entry) => (
                          <tr key={entry._id}>
                            <td>{new Date(entry.createdAt).toLocaleString()}</td>
                            <td><strong>{entry.actorName}</strong><small>{entry.actorRole} · {entry.actorEmail}</small></td>
                            <td>{actionLabels[entry.action] || entry.action}</td>
                            <AuditTarget entry={entry} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
          </section>
        </div>
      )}
    </>
  )
}

function AuditTarget({ entry }) {
  const details = formatAuditDetails(entry.details)

  return (
    <td>
      <strong>{entry.targetLabel || entry.targetType}</strong>
      {details && <small>{details}</small>}
    </td>
  )
}
