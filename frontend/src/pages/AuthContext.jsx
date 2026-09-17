import { useState } from 'react'
import { AuthContext, demoAccounts } from './auth'

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem('wedrings-user'))
  } catch {
    return null
  }
}

function readRegisteredAccounts() {
  try {
    return JSON.parse(localStorage.getItem('wedrings-accounts')) || []
  } catch {
    return []
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)

  function login(email, password) {
    const normalizedEmail = email.trim().toLowerCase()
    const demoRole = Object.keys(demoAccounts).find((accountRole) => {
      const account = demoAccounts[accountRole]
      return account.email === normalizedEmail && account.password === password
    })
    const registeredAccount = readRegisteredAccounts().find((account) => (
      account.email === normalizedEmail && account.password === password
    ))
    const role = demoRole || registeredAccount?.role

    if (!role) {
      return { success: false, message: 'The email or password is incorrect.' }
    }

    const account = demoRole ? demoAccounts[demoRole] : registeredAccount
    const signedInUser = { name: account.name, email: account.email, role }
    sessionStorage.setItem('wedrings-user', JSON.stringify(signedInUser))
    setUser(signedInUser)
    return { success: true, role }
  }

  function registerAccount(name, email, password) {
    const normalizedEmail = email.trim().toLowerCase()
    const accounts = readRegisteredAccounts()
    const emailAlreadyUsed = Object.values(demoAccounts).some((account) => account.email === normalizedEmail)
      || accounts.some((account) => account.email === normalizedEmail)

    if (emailAlreadyUsed) {
      return { success: false, message: 'An account with this email already exists.' }
    }

    const account = { name: name.trim(), email: normalizedEmail, password, role: 'applicant' }
    localStorage.setItem('wedrings-accounts', JSON.stringify([...accounts, account]))
    return { success: true }
  }

  function logout() {
    sessionStorage.removeItem('wedrings-user')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout, registerAccount }}>{children}</AuthContext.Provider>
}
