import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

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
