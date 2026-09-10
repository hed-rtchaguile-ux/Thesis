import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './pages/AuthContext'
import AdminDashboard from './pages/AdminDashboard'
import ApplicantDashboard from './pages/ApplicantDashboard'
import LoginPage from './pages/login/LoginPage'
import ProtectedRoute from './pages/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/applicant/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route element={<ProtectedRoute role="applicant" />}>
          <Route path="/applicant/dashboard" element={<ApplicantDashboard />} />
        </Route>
        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
