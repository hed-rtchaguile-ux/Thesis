import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import logoImage from './assets/wedrings-mark.png'
import { AuthProvider } from './pages/AuthContext'
import ApplicantDashboard from './pages/Dashboard/ApplicantDashboard'
import SuperAdminDashboard from './pages/Dashboard/SuperAdminDashboard'
import ApplicantProfile from './pages/ApplicantProfile'
import ApplicantRegistration from './pages/Registration/ApplicantRegistration'
import ApplicantSignup from './pages/Registration/ApplicantSignup'
import LoginPage from './pages/login/LoginPage'
import PasswordRecoveryPage from './pages/login/PasswordRecoveryPage'
import ProtectedRoute from './pages/ProtectedRoute'

function ApplicantLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [atlasStatus, setAtlasStatus] = useState('checking')

  useEffect(() => {
    fetch('/api/status')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to check backend status')
        return response.json()
      })
      .then(({ atlasConnected }) => setAtlasStatus(atlasConnected ? 'connected' : 'unavailable'))
      .catch(() => setAtlasStatus('unavailable'))
  }, [])

  const sidebarItems = [
    { label: 'My Appointment', route: '/applicant/dashboard', icon: '⌂' },
    { label: 'Notifications', route: '/applicant/dashboard#notifications', icon: '◉' },
    { label: 'New Application', route: '/applicant/registration', icon: '✎' },
  ]

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-row">
          <span className="brand-mark" aria-label="WedRings logo">
            <img src={logoImage} alt="WedRings logo" className="brand-logo" />
          </span>
          <span className="brand-name">WEDRINGS</span>
        </div>

        <nav className="sidebar-nav" aria-label="Applicant navigation">
          {sidebarItems.map((item) => {
            const active = item.label === 'Notifications'
              ? location.pathname === '/applicant/dashboard' && location.hash === '#notifications'
              : location.pathname === item.route && !location.hash

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

        <div className={`atlas-status atlas-status-${atlasStatus}`} role="status">
          <span className="atlas-status-dot" aria-hidden="true" />
          <span>
            <strong>Atlas Database</strong>
            <small>
              {atlasStatus === 'checking' && 'Checking connection...'}
              {atlasStatus === 'connected' && 'Connected'}
              {atlasStatus === 'unavailable' && 'Unavailable'}
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
          <Route path="/admin/dashboard" element={<SuperAdminDashboard isAdmin />} />
          <Route path="/admin/verified-records" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/all-applications" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/new-submissions" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/appointments" element={<SuperAdminDashboard isAdmin />} />
          <Route path="/admin/reports" element={<SuperAdminDashboard isAdmin />} />
        </Route>

        <Route element={<ProtectedRoute role="superadmin" />}>
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/appointments" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/reports" element={<SuperAdminDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
