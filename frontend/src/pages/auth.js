import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export const AUTH_SESSION_EXPIRED_EVENT = 'wedrings:session-expired'

export function useAuth() {
  return useContext(AuthContext)
}

export const demoAccounts = {
  applicant: {
    email: 'applicant@wedrings.test',
    password: 'Applicant123!',
    name: 'Jamie Applicant',
  },
  admin: {
    email: 'admin@wedrings.test',
    password: 'Admin123!',
    name: 'Portal Administrator',
  },
  superadmin: {
    email: 'superadmin@wedrings.test',
    password: 'SuperAdmin123!',
    name: 'Super Administrator',
  },
}

export async function apiFetch(resource, options = {}) {
  const headers = new Headers(options.headers)
  const token = sessionStorage.getItem('wedrings-token')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(resource, { ...options, headers })
  if (response.status === 401 && token && sessionStorage.getItem('wedrings-token') === token) {
    sessionStorage.removeItem('wedrings-token')
    sessionStorage.removeItem('wedrings-user')
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT))
  }

  return response
}
