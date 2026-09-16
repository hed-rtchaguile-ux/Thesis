import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './pages/AuthContext'
import { useAuth } from './pages/auth'
import AdminDashboard from './pages/Dashboard/AdminDashboard'
import ApplicantDashboard from './pages/Dashboard/ApplicantDashboard'
import ApplicantRegistration from './pages/Registration/ApplicantRegistration'
import LoginPage from './pages/login/LoginPage'
import ProtectedRoute from './pages/ProtectedRoute'

function ApplicantLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const sidebarItems = [
    { label: 'Dashboard', route: '/applicant/dashboard', icon: '⌂' },
    { label: 'New Application', route: '/applicant/registration', icon: '✎' },
    { label: 'My Appointments', route: '/applicant/dashboard', icon: '🗓' },
    { label: 'Profile', route: '/applicant/dashboard', icon: '◉' },
  ]

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-row">
          <span className="brand-mark" aria-label="WedRings logo">
            <svg viewBox="0 0 90 78" aria-hidden="true">
              <path className="logo-heart" d="M45 66 C25 52, 6 40, 6 22 C6 12, 14 6, 22 6 C30 6, 36 11, 41 18 C46 11, 52 6, 60 6 C68 6, 76 12, 76 22 C76 40, 57 52, 45 66Z" />
              <path className="logo-ring" d="M28 40 C28 29, 35 22, 45 22 C55 22, 62 29, 62 40 C62 50, 54 58, 45 58 C35 58, 28 50, 28 40Z" />
              <path className="logo-ring" d="M17 38 C17 18, 30 10, 45 10 C60 10, 73 18, 73 38 C73 50, 62 60, 45 60 C28 60, 17 50, 17 38Z" opacity="0.65" />
              <path className="logo-heart" d="M45 64 C41 60, 37 57, 32 53 C24 47, 18 41, 18 31 C18 24, 23 18, 30 18 C35 18, 39 20, 43 24 C45 26, 47 26, 49 24 C53 20, 57 18, 62 18 C69 18, 74 24, 74 31 C74 41, 68 47, 60 53 C55 57, 51 60, 45 64Z" opacity="0.12" />
              <path className="logo-crown" d="M26 15 L34 8 L42 15 L50 8 L58 15 L64 13 L66 24 L24 24 L26 15Z" />
              <circle className="logo-crown" cx="28" cy="13" r="2.1" />
              <circle className="logo-crown" cx="45" cy="8" r="2.1" />
              <circle className="logo-crown" cx="62" cy="13" r="2.1" />
            </svg>
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

        <button type="button" className="logout-button" onClick={() => {
          logout()
          navigate('/login')
        }}>
          <span className="nav-icon" aria-hidden="true">⎋</span>
          <span>Logout</span>
        </button>
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

        <Route element={<ProtectedRoute role="applicant" />}>
          <Route element={<ApplicantLayout />}>
            <Route path="/applicant/dashboard" element={<ApplicantDashboard />} />
            <Route path="/applicant/registration" element={<ApplicantRegistration />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/verified-records" element={<AdminDashboard view="verified" />} />
          <Route path="/admin/all-applications" element={<AdminDashboard view="all" />} />
          <Route path="/admin/new-submissions" element={<AdminDashboard view="new" />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
