import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, useAuth } from '../auth'
import { getApplicantNotifications } from './applicantNotifications'
import './ApplicantDashboard.css'

export default function NotificationsInbox() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.name || 'User'
  const initials = displayName.split(' ').map((namePart) => namePart[0]).join('').slice(0, 2).toUpperCase()
  const [applications, setApplications] = useState([])
  const [loadStatus, setLoadStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('All')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true

    apiFetch('/api/applications')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load your notifications.')
        return response.json()
      })
      .then((records) => {
        if (!active) return
        setApplications(records)
        setLoadStatus('ready')
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error.message)
        setLoadStatus('error')
      })

    return () => {
      active = false
    }
  }, [])

  const notifications = useMemo(() => getApplicantNotifications(applications), [applications])
  const unreadCount = notifications.filter((notification) => !notification.isRead).length
  const visibleNotifications = notifications.filter((notification) => (
    filter === 'All' || (filter === 'Unread' ? !notification.isRead : notification.isRead)
  ))

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  function openNotification(notification) {
    navigate('/applicant/dashboard', {
      state: {
        notificationToOpen: {
          applicationId: notification.application._id,
          notificationKey: notification.notificationKey,
        },
      },
    })
  }

  return (
    <section className="applicant-main">
      <header className="topbar">
        <div className="topbar-main">
          <h1>Notifications</h1>
          <p>Your application updates and reminders.</p>
        </div>
        <div className="topbar-user">
          <div className="user-avatar">{initials}</div>
          <span>{displayName}</span>
          <div className="user-menu-wrapper">
            <button
              type="button"
              className="mini-button"
              aria-label="Open user menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ▾
            </button>
            {menuOpen && (
              <div className="user-dropdown" role="menu" aria-label="User actions">
                <button type="button" className="dropdown-item" onClick={() => navigate('/applicant/profile')}>Profile</button>
                <button type="button" className="dropdown-item" onClick={() => {
                  setMenuOpen(false)
                  navigate('/applicant/notifications')
                }}>Notifications</button>
                <button type="button" className="dropdown-item danger" onClick={signOut}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="notification-inbox">
        <div className="notification-inbox-heading">
          <div>
            <h2>Inbox</h2>
            <p>{unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}</p>
          </div>
          <button type="button" className="application-view-button" onClick={() => navigate('/applicant/dashboard')}>
            Back to dashboard
          </button>
        </div>

        <div className="notification-inbox-filters" aria-label="Filter inbox">
          {['All', 'Unread', 'Read'].map((filterOption) => (
            <button
              key={filterOption}
              type="button"
              className={filter === filterOption ? 'active' : ''}
              aria-pressed={filter === filterOption}
              onClick={() => setFilter(filterOption)}
            >
              {filterOption}
            </button>
          ))}
        </div>

        {loadStatus === 'loading' && <p role="status">Loading your inbox...</p>}
        {loadStatus === 'error' && <p className="notification-inbox-error" role="alert">{loadError}</p>}
        {loadStatus === 'ready' && visibleNotifications.length === 0 && (
          <p className="notification-inbox-empty">
            {notifications.length === 0 ? 'You have no application updates yet.' : `No ${filter.toLowerCase()} messages.`}
          </p>
        )}
        {visibleNotifications.length > 0 && (
          <div className="notification-inbox-list">
            {visibleNotifications.map((notification) => (
              <article
                className={`notification-inbox-item ${notification.isRead ? 'read' : 'unread'}`}
                key={notification.id}
              >
                <span className="notification-inbox-indicator" aria-hidden="true" />
                <div className="notification-inbox-copy">
                  <div className="notification-inbox-item-heading">
                    <h3>{notification.title}</h3>
                    <span>{notification.isRead ? 'Read' : 'Unread'}</span>
                  </div>
                  <p>{notification.message}</p>
                  <small>Application: {[notification.application.groomFullName, notification.application.brideFullName].filter(Boolean).join(' & ') || 'Couple'}</small>
                </div>
                <button
                  type="button"
                  className="application-view-button"
                  onClick={() => openNotification(notification)}
                >
                  {notification.action}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
