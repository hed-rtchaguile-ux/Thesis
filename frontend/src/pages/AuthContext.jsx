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

  function login(email, password) {
    const normalizedEmail = email.trim().toLowerCase()
    const role = Object.keys(demoAccounts).find((accountRole) => {
      const account = demoAccounts[accountRole]
      return account.email === normalizedEmail && account.password === password
    })

    if (!role) {
      return { success: false, message: 'The email or password is incorrect.' }
    }

    const account = demoAccounts[role]
    const signedInUser = { name: account.name, email: account.email, role }
    sessionStorage.setItem('wedrings-user', JSON.stringify(signedInUser))
    setUser(signedInUser)
    return { success: true }
  }

  function logout() {
    sessionStorage.removeItem('wedrings-user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}
