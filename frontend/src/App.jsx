import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import logoImage from './assets/log.png'
import { AuthProvider } from './pages/AuthContext'
import { apiFetch } from './pages/auth'
import { useAuth } from './pages/auth'
import AdminDashboard from './pages/Dashboard/AdminDashboard'
import ApplicantDashboard from './pages/Dashboard/ApplicantDashboard'
import SuperAdminDashboard from './pages/Dashboard/SuperAdminDashboard'
import ApplicantProfile from './pages/ApplicantProfile'
import ApplicantRegistration from './pages/Registration/ApplicantRegistration'
import ApplicantSignup from './pages/Registration/ApplicantSignup'
import PasswordRecoveryPage from './pages/login/PasswordRecoveryPage'
import LoginPage from './pages/login/LoginPage'
import ProtectedRoute from './pages/ProtectedRoute'

function ApplicantLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [databaseStatus, setDatabaseStatus] = useState('checking')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const displayName = user?.name || 'User'
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    apiFetch('/api/status')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to check backend status')
        return response.json()
      })
      .then(({ databaseConnected }) => setDatabaseStatus(databaseConnected ? 'connected' : 'unavailable'))
      .catch(() => setDatabaseStatus('unavailable'))
  }, [])

  const sidebarItems = [
    { label: 'My Appointment', route: '/applicant/dashboard', icon: '⌂' },
    { label: 'New Application', route: '/applicant/registration', icon: '✎' },
  ]

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-row">
          <div className="app-brand-lockup">
            <span className="brand-mark" aria-label="WedRings logo">
              <img src={logoImage} alt="WedRings logo" className="brand-logo" />
            </span>
            <span className="brand-name">WEDRINGS</span>
          </div>
          <div className="applicant-header-account">
            <button
              type="button"
              className="applicant-header-account-trigger"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((isOpen) => !isOpen)}
            >
              <span className="applicant-header-avatar">{initials}</span>
              <span>{displayName}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {accountMenuOpen && (
              <div className="applicant-header-account-menu" role="menu" aria-label="Account actions">
                <button type="button" role="menuitem" onClick={() => {
                  setAccountMenuOpen(false)
                  navigate('/applicant/profile')
                }}>Profile</button>
                <button type="button" role="menuitem" onClick={handleLogout}>Logout</button>
              </div>
            )}
            </div>
        </div>

        <nav className="sidebar-nav" aria-label="Applicant navigation">
          {sidebarItems.map((item) => {
            const active = location.pathname === item.route || (item.label === 'Dashboard' && location.pathname.startsWith('/applicant'))

            return (
              <button
                key={item.label}
                type="button"
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.route)}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className={`atlas-status atlas-status-${databaseStatus}`} role="status">
          <span className="atlas-status-dot" aria-hidden="true" />
          <span>
            <strong>MongoDB</strong>
            <small>
              {databaseStatus === 'checking' && 'Checking connection...'}
              {databaseStatus === 'connected' && 'Connected'}
              {databaseStatus === 'unavailable' && 'Unavailable'}
            </small>
          </span>
        </div>

      </aside>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<PasswordRecoveryPage mode="request" />} />
        <Route path="/reset-password" element={<PasswordRecoveryPage mode="reset" />} />
        <Route path="/register" element={<ApplicantSignup />} />
        <Route path="/applicant/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/superadmin/login" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute role="applicant" />}>
          <Route element={<ApplicantLayout />}>
            <Route path="/applicant/dashboard" element={<ApplicantDashboard />} />
            <Route path="/applicant/profile" element={<ApplicantProfile />} />
            <Route path="/applicant/registration" element={<ApplicantRegistration />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['admin', 'superadmin']} />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/verified-records" element={<AdminDashboard view="verified" />} />
          <Route path="/admin/all-applications" element={<AdminDashboard view="all" />} />
          <Route path="/admin/new-submissions" element={<AdminDashboard view="new" />} />
          <Route path="/admin/appointments" element={<AdminDashboard view="appointments" />} />
        </Route>

        <Route element={<ProtectedRoute role="superadmin" />}>
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/appointments" element={<SuperAdminDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
