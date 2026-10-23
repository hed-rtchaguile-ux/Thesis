import './AdminTools.css'
import { useState } from 'react'
import { getApplicationWorkflowStatus } from './applicationSearch'

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function ReportCards({ applications, showDateFilter = false }) {
  const today = new Date()
  const todayKey = localDateKey(today)
  const monthKey = todayKey.slice(0, 7)
  const yearKey = todayKey.slice(0, 4)
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'))
  const [selectedYear, setSelectedYear] = useState(yearKey)
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
  const availableYears = [...new Set([
    yearKey,
    ...applications.map((application) => {
      const created = new Date(application.createdAt)
      return Number.isNaN(created.getTime()) ? '' : String(created.getFullYear())
    }).filter(Boolean),
  ])].sort((first, second) => second.localeCompare(first))
  const selectedPeriodApplications = showDateFilter
    ? applications.filter((application) => {
      if (!application.createdAt) return false
      const created = new Date(application.createdAt)
      if (Number.isNaN(created.getTime()) || String(created.getFullYear()) !== selectedYear) return false
      return !selectedMonth || String(created.getMonth() + 1).padStart(2, '0') === selectedMonth
    })
    : []
  const selectedPeriodCounts = selectedPeriodApplications.reduce((result, application) => {
    result[getApplicationWorkflowStatus(application)] += 1
    return result
  }, { 'Under Review': 0, Verified: 0, Complete: 0, Rejected: 0 })

  return (
    <section className="admin-reports" aria-label="Applicant reports">
      <div className="admin-tools-heading"><div><span className="admin-review-kicker">Application activity</span><h2>Applicant reports</h2></div><span>Based on submission date</span></div>
      {showDateFilter ? <>
        <div className="admin-report-date-filter">
          <label htmlFor="admin-report-month">Month</label>
          <select id="admin-report-month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
            <option value="">All months</option>
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={String(index + 1).padStart(2, '0')}>{new Date(2000, index, 1).toLocaleString(undefined, { month: 'long' })}</option>)}
          </select>
          <label htmlFor="admin-report-year">Year</label>
          <select id="admin-report-year" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div className="admin-report-grid admin-report-period-grid">
          <article><span>Submissions</span><strong>{selectedPeriodApplications.length}</strong><small>for selected period</small></article>
          <article><span>Under review</span><strong>{selectedPeriodCounts['Under Review']}</strong><small>applications</small></article>
          <article><span>Verified</span><strong>{selectedPeriodCounts.Verified}</strong><small>applications</small></article>
          <article><span>Complete</span><strong>{selectedPeriodCounts.Complete}</strong><small>licenses released</small></article>
          <article><span>Rejected</span><strong>{selectedPeriodCounts.Rejected}</strong><small>applications</small></article>
        </div>
      </> : <div className="admin-report-grid">
        <article><span>Today</span><strong>{counts.today}</strong><small>applications submitted</small></article>
        <article><span>This month</span><strong>{counts.month}</strong><small>applications submitted</small></article>
        <article><span>This year</span><strong>{counts.year}</strong><small>applications submitted</small></article>
      </div>}
    </section>
  )
}

