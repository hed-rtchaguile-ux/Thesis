import { useEffect, useState } from 'react'
import { AuthContext } from './auth'

function readStoredUser() {
  try {
    if (!sessionStorage.getItem('wedrings-token')) {
      sessionStorage.removeItem('wedrings-user')
      return null
    }

    return JSON.parse(sessionStorage.getItem('wedrings-user'))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)

  useEffect(() => {
    function expireSession() {
      sessionStorage.removeItem('wedrings-token')
      sessionStorage.removeItem('wedrings-user')
      setUser(null)
    }

    window.addEventListener('wedrings:session-expired', expireSession)
    return () => window.removeEventListener('wedrings:session-expired', expireSession)
  }, [])

  async function login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()

      if (!response.ok) return { success: false, message: result.message || 'Unable to sign in.' }

      sessionStorage.setItem('wedrings-token', result.token)
      sessionStorage.setItem('wedrings-user', JSON.stringify(result.user))
      setUser(result.user)
      return { success: true, role: result.user.role }
    } catch {
      return { success: false, message: 'Unable to reach the sign-in service.' }
    }
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

      sessionStorage.setItem('wedrings-token', result.token)
      sessionStorage.setItem('wedrings-user', JSON.stringify(result.user))
      setUser(result.user)
      return { success: true, role: result.user.role }
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
