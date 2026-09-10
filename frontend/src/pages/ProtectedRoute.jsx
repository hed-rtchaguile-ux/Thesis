import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth'

export default function ProtectedRoute({ role }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to={`/${role}/login`} replace state={{ from: location }} />
  }

  if (user.role !== role) {
    return <Navigate to={`/${user.role}/dashboard`} replace />
  }

  return <Outlet />
}
