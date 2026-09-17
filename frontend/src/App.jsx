import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import logoImage from './assets/log.png'
import { AuthProvider } from './pages/AuthContext'
import { useAuth } from './pages/auth'
import AdminDashboard from './pages/Dashboard/AdminDashboard'
import ApplicantDashboard from './pages/Dashboard/ApplicantDashboard'
import SuperAdminDashboard from './pages/Dashboard/SuperAdminDashboard'
import ApplicantProfile from './pages/ApplicantProfile'
import ApplicantRegistration from './pages/Registration/ApplicantRegistration'
import LoginPage from './pages/login/LoginPage'
import ProtectedRoute from './pages/ProtectedRoute'

function ApplicantLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const sidebarItems = [
    { label: 'My Appointment', route: '/applicant/dashboard', icon: '⌂' },
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
        </Route>

        <Route element={<ProtectedRoute role="superadmin" />}>
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
