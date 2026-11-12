import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from '../auth'

const actionLabels = {
  'application.information.updated': 'Applicant information updated',
  'application.status.updated': 'Application status updated',
  'appointment.first.approved': 'First appointment approved',
  'appointment.second.updated': 'Second appointment updated',
  'document.review.updated': 'Document review updated',
  'document.replaced': 'Application document replaced',
  'license.release-date.updated': 'License release date updated',
  'database.backup.downloaded': 'Database backup downloaded',
  'database.backup.restored': 'Database backup restored',
}
const MAX_DATABASE_BACKUP_BYTES = 100 * 1024 * 1024

function formatAuditDetails(details = {}) {
  return Object.entries(details)
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
      const formattedValue = Array.isArray(value) ? value.join(', ') : String(value)
      return `${label}: ${formattedValue}`
    })
    .join(' · ')
}

function getAuditDateKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AdminAccountMenu({ basePath, displayName }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const [auditRoleFilter, setAuditRoleFilter] = useState('')
  const [auditFromDate, setAuditFromDate] = useState('')
  const [auditToDate, setAuditToDate] = useState('')
  const [auditActionLoading, setAuditActionLoading] = useState(false)
  const [auditActionError, setAuditActionError] = useState('')
  const [auditActionMessage, setAuditActionMessage] = useState('')
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  const auditActions = [...new Set(auditLogs.map((entry) => entry.action).filter(Boolean))].sort()
  const normalizedAuditSearch = auditSearch.trim().toLowerCase()
  const filteredAuditLogs = auditLogs.filter((entry) => {
    const dateKey = getAuditDateKey(entry.createdAt)
    if (auditActionFilter && entry.action !== auditActionFilter) return false
    if (auditRoleFilter && entry.actorRole !== auditRoleFilter) return false
    if (auditFromDate && (!dateKey || dateKey < auditFromDate)) return false
    if (auditToDate && (!dateKey || dateKey > auditToDate)) return false
    if (!normalizedAuditSearch) return true

    const searchableText = [
      entry.actorName,
      entry.actorEmail,
      entry.actorRole,
      actionLabels[entry.action] || entry.action,
      entry.targetLabel,
      entry.targetType,
      entry.targetId,
      formatAuditDetails(entry.details),
    ].filter(Boolean).join(' ').toLowerCase()
    return searchableText.includes(normalizedAuditSearch)
  })

  async function openAuditLog() {
    setMenuOpen(false)
    setAuditOpen(true)
    setAuditLoading(true)
    setAuditError('')
    setAuditActionError('')
    setAuditActionMessage('')
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
    setAuditActionLoading(true)
    setAuditActionError('')
    setAuditActionMessage('')
    try {
      const response = await apiFetch('/api/admin/database-backup')
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
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
      setAuditActionMessage('Database backup downloaded.')
    } catch (error) {
      setAuditActionError(error.message || 'Unable to download the database backup.')
    } finally {
      setAuditActionLoading(false)
    }
  }

  async function restoreBackup(event) {
    const backupFile = event.target.files?.[0]
    event.target.value = ''
    if (!backupFile) return

    setAuditActionLoading(true)
    setAuditActionError('')
    setAuditActionMessage('')
    try {
      if (backupFile.size > MAX_DATABASE_BACKUP_BYTES) {
        throw new Error('Database backup files must be 100 MB or smaller.')
      }
      const backupText = await backupFile.text()
      const confirmed = window.confirm(
        `Restore "${backupFile.name}"? This replaces data in the collections included in the backup. Newer records may be lost. Account passwords are not stored in backups and will be preserved for matching existing accounts.`,
      )
      if (!confirmed) return

      const response = await apiFetch('/api/admin/database-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: backupText,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'Unable to restore the database backup.')
      setAuditActionMessage(`Database restored successfully (${result.recordCount} records). Reload the page to refresh the dashboard and audit history.`)
    } catch (error) {
      setAuditActionError(error.message || 'Unable to restore the database backup.')
    } finally {
      setAuditActionLoading(false)
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
            <div className="admin-audit-actions">
              <p>Restore replaces data in the collections included in the backup. Account passwords are excluded and preserved for matching existing accounts.</p>
              <div className="admin-audit-action-buttons">
                <button type="button" className="admin-audit-action-button" onClick={downloadBackup} disabled={auditActionLoading}>
                  {auditActionLoading ? 'Working...' : 'Backup database'}
                </button>
                <label className={`admin-audit-action-button restore${auditActionLoading ? ' disabled' : ''}`}>
                  Restore database
                  <input
                    type="file"
                    accept=".json,application/json"
                    aria-label="Select database backup to restore"
                    disabled={auditActionLoading}
                    onChange={restoreBackup}
                  />
                </label>
              </div>
              {auditActionError && <p className="admin-audit-action-feedback error" role="alert">{auditActionError}</p>}
              {auditActionMessage && <p className="admin-audit-action-feedback" role="status">{auditActionMessage}</p>}
            </div>
            {!auditLoading && !auditError && auditLogs.length > 0 && (
              <div className="admin-audit-filters" aria-label="Filter audit history">
                <label className="admin-audit-filter-field" htmlFor="admin-audit-search">
                  <span>Search</span>
                  <input id="admin-audit-search" type="search" value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Actor, action, target..." />
                </label>
                <label className="admin-audit-filter-field" htmlFor="admin-audit-action">
                  <span>Action</span>
                  <select id="admin-audit-action" value={auditActionFilter} onChange={(event) => setAuditActionFilter(event.target.value)}>
                    <option value="">All actions</option>
                    {auditActions.map((action) => <option key={action} value={action}>{actionLabels[action] || action}</option>)}
                  </select>
                </label>
                <label className="admin-audit-filter-field" htmlFor="admin-audit-role">
                  <span>Admin role</span>
                  <select id="admin-audit-role" value={auditRoleFilter} onChange={(event) => setAuditRoleFilter(event.target.value)}>
                    <option value="">All roles</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </label>
                <label className="admin-audit-filter-field" htmlFor="admin-audit-from">
                  <span>From</span>
                  <input id="admin-audit-from" type="date" value={auditFromDate} onChange={(event) => setAuditFromDate(event.target.value)} />
                </label>
                <label className="admin-audit-filter-field" htmlFor="admin-audit-to">
                  <span>To</span>
                  <input id="admin-audit-to" type="date" value={auditToDate} onChange={(event) => setAuditToDate(event.target.value)} />
                </label>
                <p className="admin-audit-filter-count" role="status">Showing {filteredAuditLogs.length} of {auditLogs.length} actions (latest 200).</p>
              </div>
            )}
            {auditLoading ? <p className="admin-empty-state">Loading audit history...</p>
              : auditError ? <p className="admin-empty-state" role="alert">{auditError}</p>
                : auditLogs.length === 0 ? <p className="admin-empty-state">No administrator actions have been recorded yet.</p>
                  : filteredAuditLogs.length === 0 ? <p className="admin-empty-state">No audit actions match these filters.</p>
                  : <div className="admin-audit-table-wrap">
                    <table className="admin-audit-table">
                      <thead>
                        <tr><th>Date and time</th><th>Who</th><th>Action</th><th>Target and details</th></tr>
                      </thead>
                      <tbody>
                        {filteredAuditLogs.map((entry) => (
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
