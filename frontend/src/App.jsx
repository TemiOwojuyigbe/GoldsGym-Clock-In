/**
 * App.jsx — Scheduling app router.
 *
 * Login → Manager schedule desk, or staff "My shifts" view.
 * Clock-in / clock-out is intentionally not part of this build.
 */

import { useState } from 'react'
import LoginPage from './LoginPage'
import EmployeePortal from './EmployeePortal'
import AdminPortal from './AdminPortal'
import { loadAuth } from './authStorage'
import './App.css'

function App() {
  const [session, setSession] = useState(() => loadAuth())

  function handleLoggedIn(data) {
    setSession({
      token: data.token,
      portal: data.portal,
      employee: data.employee,
    })
  }

  function handleLogout() {
    setSession(null)
  }

  if (!session?.token) {
    return <LoginPage onLoggedIn={handleLoggedIn} />
  }

  if (session.portal === 'admin') {
    return (
      <AdminPortal employee={session.employee} onLogout={handleLogout} />
    )
  }

  return (
    <EmployeePortal employee={session.employee} onLogout={handleLogout} />
  )
}

export default App
