import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth'

export default function ProtectedRoute({ role, roles }) {
  const { user } = useAuth()
  const location = useLocation()
  const allowedRoles = roles || (role ? [role] : [])

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}/dashboard`} replace />
  }

  return <Outlet />
}
