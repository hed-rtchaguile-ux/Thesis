import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './PublicNotices.css'

function formatDate(value, options = { dateStyle: 'long' }) {
  return new Intl.DateTimeFormat('en-US', options).format(new Date(value))
}

export default function PublicNotices() {
  const [notices, setNotices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/notices')
      .then((response) => {
        if (!response.ok) throw new Error('The public notice board is unavailable right now.')
        return response.json()
      })
      .then(setNotices)
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <main className="public-notices-page">
      <header className="public-notices-header">
        <Link className="public-notices-brand" to="/" aria-label="WedRings notice board">
          <span className="public-brand-seal">W</span>
          <span>WEDRINGS <small>CIVIL REGISTRY</small></span>
        </Link>
        <Link className="public-login-link" to="/login">Staff and applicant login</Link>
      </header>

      <section className="public-notices-intro">
        <span className="public-notices-eyebrow">Marriage application notices</span>
        <h1>Ten-day public notices</h1>
        <p>Current couple notices published by the civil registry.</p>
      </section>

      <section className="public-notice-board" aria-label="Current marriage notices">
        {isLoading && <p className="public-notice-state">Loading current notices...</p>}
        {!isLoading && error && <p className="public-notice-state" role="alert">{error}</p>}
        {!isLoading && !error && notices.length === 0 && <p className="public-notice-state">There are no active couple notices at this time.</p>}
        {!isLoading && !error && notices.length > 0 && notices.map((notice) => (
          <article className="public-notice-card" key={notice._id}>
            <img src={notice.imageData} alt={`${notice.groomFullName} and ${notice.brideFullName}`} />
            <div className="public-notice-copy">
              <span className="public-notice-label">Notice published {formatDate(notice.publishedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <h2>{notice.groomFullName} <span>&amp;</span> {notice.brideFullName}</h2>
              <p className="public-notice-date">Ceremony date <strong>{formatDate(`${notice.ceremonyDate}T00:00:00`)}</strong></p>
              {notice.message && <p className="public-notice-message">{notice.message}</p>}
              <p className="public-notice-expiry">Public notice ends {formatDate(notice.expiresAt)}</p>
            </div>
          </article>
        ))}
      </section>

      <footer className="public-notices-footer">WedRings Civil Registry <span>Public notice board</span></footer>
    </main>
  )
}