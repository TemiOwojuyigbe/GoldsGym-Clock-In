/**
 * EmployeePortal.jsx — Staff view: assigned shifts only (no clock-in).
 */

import MyShifts from './MyShifts'
import ThemeToggle from './ThemeToggle'
import { clearAuth } from './authStorage'

export default function EmployeePortal({ employee, onLogout }) {
  function handleLogout() {
    clearAuth()
    onLogout()
  }

  return (
    <div className="app app--phone">
      <header className="app-topbar">
        <div>
          <p className="brand">Gold&apos;s Gym</p>
          <h1 className="topbar-title">My Schedule</h1>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <button type="button" className="ghost-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <p className="welcome-line">Hi, {employee.name.split(' ')[0]}</p>

      <main className="app-main">
        <MyShifts />
      </main>
    </div>
  )
}
