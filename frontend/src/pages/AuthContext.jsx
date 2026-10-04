import { useState } from 'react'
import { AuthContext, demoAccounts } from './auth'

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem('wedrings-user'))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)

  function saveUser(signedInUser) {
    sessionStorage.setItem('wedrings-user', JSON.stringify(signedInUser))
    setUser(signedInUser)
  }

  async function login(email, password) {
    const normalizedEmail = email.trim().toLowerCase()
    const staffRole = ['admin', 'superadmin'].find((accountRole) => demoAccounts[accountRole].email === normalizedEmail)

    if (staffRole) {
      const account = demoAccounts[staffRole]
      if (account.password !== password) return { success: false, message: 'The email or password is incorrect.' }
      const signedInUser = { name: account.name, email: account.email, role: staffRole }
      saveUser(signedInUser)
      return { success: true, role: staffRole }
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      })
      const result = await response.json()
      if (response.ok) {
        saveUser(result.user)
        return { success: true, role: result.user.role }
      }
    } catch {
      // Keep the local applicant demo available if the backend is offline.
    }

    const demoApplicant = demoAccounts.applicant
    if (demoApplicant.email === normalizedEmail && demoApplicant.password === password) {
      const signedInUser = { name: demoApplicant.name, email: demoApplicant.email, role: 'applicant' }
      saveUser(signedInUser)
      return { success: true, role: 'applicant' }
    }
    return { success: false, message: 'The email or password is incorrect.' }
  }

  async function register(name, email, password) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const result = await response.json()
      if (!response.ok) return { success: false, message: result.message || 'Unable to create the account.' }
      saveUser(result.user)
      return { success: true, role: 'applicant' }
    } catch {
      return { success: false, message: 'Unable to reach the registration service.' }
    }
  }

  function logout() {
    sessionStorage.removeItem('wedrings-token')
    sessionStorage.removeItem('wedrings-user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>
}
