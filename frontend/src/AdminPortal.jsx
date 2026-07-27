/**
 * AdminPortal.jsx — Scheduling-only manager desk.
 */

import { useEffect, useState } from 'react'
import Schedule from './Schedule'
import ThemeToggle from './ThemeToggle'
import { clearAuth, apiFetch } from './authStorage'
import { todayInputValue, toDatetimeLocalValue } from './dateHelpers'

export default function AdminPortal({ employee, onLogout }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  function bump() {
    setRefreshKey((k) => k + 1)
  }

  useEffect(() => {
    let cancelled = false
    async function loadCounts() {
      try {
        const data = await apiFetch('/api/shifts')
        const shifts = data.shifts || []
        const today = todayInputValue()
        const todayShifts = shifts.filter(
          (s) => toDatetimeLocalValue(s.start_time).slice(0, 10) === today
        )
        if (!cancelled) {
          setTotalCount(shifts.length)
          setTodayCount(todayShifts.length)
        }
      } catch {
        // ignore — schedule panel will show errors
      }
    }
    loadCounts()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  function handleLogout() {
    clearAuth()
    onLogout()
  }

  return (
    <div className="app app--admin">
      <header className="app-topbar">
        <div>
          <p className="brand">Gold&apos;s Gym · Admin</p>
          <h1 className="topbar-title">Staff Schedule</h1>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <button type="button" className="ghost-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <p className="welcome-line">
        {employee.name} · build and adjust the week&apos;s shifts
      </p>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-value">{todayCount}</span>
          <span className="stat-label">Shifts today</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalCount}</span>
          <span className="stat-label">Shifts on file</span>
        </div>
      </div>

      <main className="app-main">
        <Schedule refreshKey={refreshKey} onChanged={bump} />
      </main>
    </div>
  )
}
