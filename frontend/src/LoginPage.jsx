/**
 * LoginPage.jsx — Dual portal login with theme toggle.
 */

import { useState } from 'react'
import { saveAuth } from './authStorage'
import ThemeToggle from './ThemeToggle'

export default function LoginPage({ onLoggedIn }) {
  const [portal, setPortal] = useState('employee')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/login/${portal}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Login failed')

      saveAuth({
        token: data.token,
        portal: data.portal,
        employee: data.employee,
      })
      onLoggedIn(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app app--phone">
      <header className="app-topbar">
        <div>
          <p className="brand">Gold&apos;s Gym Bowie</p>
          <h1 className="topbar-title">Staff Portal</h1>
        </div>
        <ThemeToggle />
      </header>

      <section className="panel login-panel">
        <div className="portal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={portal === 'employee' ? 'tab tab--active' : 'tab'}
            aria-selected={portal === 'employee'}
            onClick={() => setPortal('employee')}
          >
            Employee Login
          </button>
          <button
            type="button"
            role="tab"
            className={portal === 'admin' ? 'tab tab--active' : 'tab'}
            aria-selected={portal === 'admin'}
            onClick={() => setPortal('admin')}
          >
            Admin Login
          </button>
        </div>

        <p className="hint">
          {portal === 'employee'
            ? 'Clock in near the gym with live map + Start / End.'
            : 'Managers only — manage the shift schedule.'}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="primary-btn primary-btn--block" disabled={loading}>
            {loading
              ? 'Signing in…'
              : `Sign in to ${portal === 'employee' ? 'Employee' : 'Admin'}`}
          </button>
        </form>

        {error && <p className="status status--error">Error: {error}</p>}

        <div className="demo-box">
          <p className="hint">
            <strong>Demo</strong> — password <code>password123</code>
          </p>
          <ul className="demo-list">
            <li>
              <code>alex@goldsgym.local</code> — employee
            </li>
            <li>
              <code>jordan@goldsgym.local</code> — manager (both portals)
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
