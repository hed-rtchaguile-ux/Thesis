import { useEffect, useRef, useState } from 'react'
import './AdminTools.css'

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function ReportCards({ applications }) {
  const today = new Date()
  const todayKey = localDateKey(today)
  const monthKey = todayKey.slice(0, 7)
  const yearKey = todayKey.slice(0, 4)
  const counts = applications.reduce((result, application) => {
    if (!application.createdAt) return result
    const created = new Date(application.createdAt)
    if (Number.isNaN(created.getTime())) return result
    const createdKey = localDateKey(created)
    if (createdKey === todayKey) result.today += 1
    if (createdKey.startsWith(monthKey)) result.month += 1
    if (createdKey.startsWith(yearKey)) result.year += 1
    return result
  }, { today: 0, month: 0, year: 0 })

  return (
    <section className="admin-reports" aria-label="Applicant reports">
      <div className="admin-tools-heading"><div><span className="admin-review-kicker">Application activity</span><h2>Applicant reports</h2></div><span>Based on submission date</span></div>
      <div className="admin-report-grid">
        <article><span>Today</span><strong>{counts.today}</strong><small>applications submitted</small></article>
        <article><span>This month</span><strong>{counts.month}</strong><small>applications submitted</small></article>
        <article><span>This year</span><strong>{counts.year}</strong><small>applications submitted</small></article>
      </div>
    </section>
  )
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read the selected image.'))
    reader.readAsDataURL(file)
  })
}

export function NoticeManager() {
  const [notices, setNotices] = useState([])
  const [groomFullName, setGroomFullName] = useState('')
  const [brideFullName, setBrideFullName] = useState('')
  const [ceremonyDate, setCeremonyDate] = useState('')
  const [message, setMessage] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formRef = useRef(null)

  useEffect(() => {
    fetch('/api/notices')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load published notices.')
        return response.json()
      })
      .then(setNotices)
      .catch((loadError) => setError(loadError.message))
  }, [])

  async function publishNotice(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!imageFile) {
      setError('Choose a couple photo to publish.')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 7 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP image under 7 MB.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groomFullName, brideFullName, ceremonyDate, message, imageData: await readImage(imageFile) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to publish notice.')
      setNotices((currentNotices) => [result, ...currentNotices])
      setGroomFullName('')
      setBrideFullName('')
      setCeremonyDate('')
      setMessage('')
      setImageFile(null)
      formRef.current?.reset()
      setNotice('The couple notice is now public for 10 days.')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function removeNotice(noticeId) {
    setError('')
    try {
      const response = await fetch(`/api/notices/${noticeId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to remove notice.')
      setNotices((currentNotices) => currentNotices.filter((item) => item._id !== noticeId))
    } catch (removeError) {
      setError(removeError.message)
    }
  }

  return (
    <div className="notice-manager">
      <section className="notice-editor">
        <div className="admin-tools-heading"><div><span className="admin-review-kicker">Public notice board</span><h2>Publish a 10-day notice</h2></div><span>Visible before sign-in</span></div>
        <form ref={formRef} className="notice-form" onSubmit={publishNotice}>
          <label>Groom's full name<input value={groomFullName} onChange={(event) => setGroomFullName(event.target.value)} required maxLength="120" /></label>
          <label>Bride's full name<input value={brideFullName} onChange={(event) => setBrideFullName(event.target.value)} required maxLength="120" /></label>
          <label>Ceremony date<input type="date" value={ceremonyDate} onChange={(event) => setCeremonyDate(event.target.value)} required /></label>
          <label className="notice-photo-field">Couple photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} required /></label>
          <label className="notice-message-field">Public message<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength="500" rows="3" placeholder="Optional announcement" /></label>
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Publishing...' : 'Publish notice'}</button>
        </form>
        {error && <p className="notice-feedback notice-error" role="alert">{error}</p>}
        {notice && <p className="notice-feedback" role="status">{notice}</p>}
      </section>

      <section className="notice-list" aria-label="Published couple notices">
        <div className="admin-tools-heading"><div><span className="admin-review-kicker">Active posts</span><h2>Published notices</h2></div><span>{notices.length} active</span></div>
        {notices.length === 0 && <p className="notice-empty">No active notices.</p>}
        {notices.map((item) => (
          <article className="notice-list-item" key={item._id}>
            <img src={item.imageData} alt={`${item.groomFullName} and ${item.brideFullName}`} />
            <div><h3>{item.groomFullName} &amp; {item.brideFullName}</h3><p>Ceremony {new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(`${item.ceremonyDate}T00:00:00`))}</p><small>Expires {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(item.expiresAt))}</small></div>
            <button type="button" className="admin-details-button" onClick={() => removeNotice(item._id)}>Remove</button>
          </article>
        ))}
      </section>
    </div>
  )
}