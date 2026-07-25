/**
 * AdminPortal.jsx — Tabbed admin home: Activity, Schedule, Approvals.
 */

import { useEffect, useState } from 'react'
import Schedule from './Schedule'
import TeamActivity from './TeamActivity'
import Approvals from './Approvals'
import ThemeToggle from './ThemeToggle'
import { clearAuth, apiFetch } from './authStorage'

const TABS = [
  { id: 'activity', label: 'Activity' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'approvals', label: 'Approvals' },
]

export default function AdminPortal({ employee, onLogout }) {
  const [tab, setTab] = useState('activity')
  const [refreshKey, setRefreshKey] = useState(0)
  const [summary, setSummary] = useState({ punches_today: 0, pending_approvals: 0 })

  function bump() {
    setRefreshKey((k) => k + 1)
  }

  useEffect(() => {
    apiFetch('/api/admin/summary')
      .then(setSummary)
      .catch(() => {})
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
          <h1 className="topbar-title">Manager desk</h1>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <button type="button" className="ghost-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <p className="welcome-line">
        {employee.name} · clock in from Employee Login when you are on the floor
      </p>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-value">{summary.punches_today}</span>
          <span className="stat-label">Punches today</span>
        </div>
        <button
          type="button"
          className="stat-card stat-card--action"
          onClick={() => setTab('approvals')}
        >
          <span className="stat-value">{summary.pending_approvals}</span>
          <span className="stat-label">Pending approvals</span>
        </button>
      </div>

      {summary.pending_approvals > 0 && (
        <button
          type="button"
          className="reminder-banner"
          onClick={() => setTab('approvals')}
        >
          Reminder: you have {summary.pending_approvals} approval
          {summary.pending_approvals === 1 ? '' : 's'} pending.
        </button>
      )}

      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'admin-tab admin-tab--active' : 'admin-tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'approvals' && summary.pending_approvals > 0 && (
              <span className="tab-badge">{summary.pending_approvals}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'activity' && <TeamActivity refreshKey={refreshKey} />}
        {tab === 'schedule' && (
          <Schedule refreshKey={refreshKey} onChanged={bump} />
        )}
        {tab === 'approvals' && (
          <Approvals refreshKey={refreshKey} onChanged={bump} />
        )}
      </main>
    </div>
  )
}
