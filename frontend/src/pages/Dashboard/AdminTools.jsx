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

