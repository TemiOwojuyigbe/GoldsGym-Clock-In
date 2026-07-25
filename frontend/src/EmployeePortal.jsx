/**
 * EmployeePortal.jsx — Time clock + timesheet + punch edit requests.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import ClockButton from './ClockButton'
import GeofenceMap from './GeofenceMap'
import Timesheet from './Timesheet'
import MyRequests from './MyRequests'
import ThemeToggle from './ThemeToggle'
import { clearAuth, apiFetch } from './authStorage'

function roughDistanceMeters(lat1, lon1, lat2, lon2) {
  const r = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function EmployeePortal({ employee, onLogout }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [gym, setGym] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [view, setView] = useState('clock') // clock | timesheet | requests

  useEffect(() => {
    apiFetch('/api/gym')
      .then(setGym)
      .catch(() => setGym(null))
  }, [])

  const onLocationUpdate = useCallback((loc) => {
    setUserLocation(loc)
  }, [])

  const insideGeofence = useMemo(() => {
    // Tester branch: unlock Start from home when backend testing bypass is on
    if (gym?.testing_bypass) return true
    if (!gym || !userLocation) return false
    const d = roughDistanceMeters(
      userLocation.lat,
      userLocation.long,
      gym.latitude,
      gym.longitude
    )
    return d <= gym.radius_meters
  }, [gym, userLocation])

  const locationReady = !!userLocation || !!gym?.testing_bypass

  function handleLogout() {
    clearAuth()
    onLogout()
  }

  function bump() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="app app--phone">
      <header className="app-topbar">
        <div>
          <p className="brand">Gold&apos;s Gym</p>
          <h1 className="topbar-title">Time Clock</h1>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <button type="button" className="ghost-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <p className="welcome-line">Hi, {employee.name.split(' ')[0]}</p>

      {view === 'clock' && (
        <main className="app-main">
          <GeofenceMap
            gym={gym}
            userLocation={userLocation}
            insideGeofence={insideGeofence}
          />

          <ClockButton
            employee={employee}
            gym={gym}
            insideGeofence={insideGeofence}
            locationReady={locationReady}
            onLocationUpdate={onLocationUpdate}
            onClocked={bump}
          />

          <div className="shortcut-row">
            <button
              type="button"
              className="shortcut-card"
              onClick={() => setView('timesheet')}
            >
              <span className="shortcut-icon shortcut-icon--teal" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              My timesheet
            </button>
            <button
              type="button"
              className="shortcut-card"
              onClick={() => setView('requests')}
            >
              <span className="shortcut-icon shortcut-icon--orange" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 11l3 3L22 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              My requests
            </button>
          </div>

          <Timesheet refreshKey={refreshKey} compact />
        </main>
      )}

      {view === 'timesheet' && (
        <main className="app-main">
          <button type="button" className="back-link" onClick={() => setView('clock')}>
            ← Back to Time Clock
          </button>
          <Timesheet refreshKey={refreshKey} />
        </main>
      )}

      {view === 'requests' && (
        <main className="app-main">
          <button type="button" className="back-link" onClick={() => setView('clock')}>
            ← Back to Time Clock
          </button>
          <MyRequests refreshKey={refreshKey} onChanged={bump} />
        </main>
      )}
    </div>
  )
}
