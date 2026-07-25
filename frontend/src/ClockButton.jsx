/**
 * ClockButton.jsx — Time Clock UI inspired by modern Start / End screens.
 *
 * - Big blue Start when idle
 * - Live timer card + orange End while working
 * - Reads last timesheet event so a refresh keeps you "Working"
 */

import { useEffect, useState } from 'react'
import { apiFetch } from './authStorage'

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          long: position.coords.longitude,
        })
      },
      (error) => reject(new Error(error.message || 'Could not get location.')),
      { enableHighAccuracy: true, timeout: 12000 }
    )
  })
}

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function ClockButton({
  employee,
  gym,
  onClocked,
  onLocationUpdate,
}) {
  const [working, setWorking] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [lastLocationLabel, setLastLocationLabel] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Restore working state from last punch
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const data = await apiFetch('/api/timesheet')
        const last = data.events?.[0]
        if (!cancelled && last?.type === 'in') {
          setWorking(true)
          setStartedAt(new Date(last.timestamp).getTime())
          if (last.latitude != null && last.longitude != null) {
            setLastLocationLabel(
              `${last.latitude.toFixed(4)}, ${last.longitude.toFixed(4)}`
            )
          }
        }
      } catch {
        // ignore — user can still punch
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  // Tick the live timer while working
  useEffect(() => {
    if (!working) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [working])

  // Watch position for the map (optional UX)
  useEffect(() => {
    if (!navigator.geolocation || !onLocationUpdate) return undefined

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onLocationUpdate({
          lat: pos.coords.latitude,
          long: pos.coords.longitude,
        })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [onLocationUpdate])

  async function handlePunch(nextAction) {
    setLoading(true)
    setStatus('Getting your location…')

    try {
      const location = await getCurrentPosition()
      if (onLocationUpdate) onLocationUpdate(location)

      setStatus(
        nextAction === 'in'
          ? 'Checking gym zone…'
          : 'Ending shift…'
      )

      const endpoint = nextAction === 'in' ? '/api/clock-in' : '/api/clock-out'
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          lat: location.lat,
          long: location.long,
        }),
      })

      const label =
        gym?.address ||
        `${location.lat.toFixed(4)}, ${location.long.toFixed(4)}`
      setLastLocationLabel(label)

      if (nextAction === 'in') {
        setWorking(true)
        setStartedAt(new Date(data.event.timestamp).getTime())
        setStatus(`Clocked in · ${data.distance_meters ?? 0}m from gym`)
      } else {
        setWorking(false)
        setStartedAt(null)
        setStatus(`Clocked out · ${data.distance_meters ?? 0}m from gym`)
      }

      if (onClocked) onClocked()
    } catch (err) {
      const extra =
        err.data?.distance_meters != null
          ? ` (≈${Math.round(err.data.distance_meters)}m away)`
          : ''
      setStatus(`Error: ${err.message}${extra}`)
    } finally {
      setLoading(false)
    }
  }

  const elapsed =
    working && startedAt != null ? formatElapsed(now - startedAt) : '00:00:00'
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  if (!hydrated) {
    return (
      <section className="clock-stage">
        <p className="hint">Loading time clock…</p>
      </section>
    )
  }

  return (
    <section className="clock-stage">
      {!working ? (
        <div className="start-wrap">
          <button
            type="button"
            className="start-btn"
            onClick={() => handlePunch('in')}
            disabled={loading}
          >
            <span className="start-btn__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="start-btn__label">{loading ? '…' : 'Start'}</span>
          </button>
          <p className="start-caption">
            Clock in at {gym?.name || "Gold's Gym"} when you are inside the green zone
          </p>
        </div>
      ) : (
        <div className="timer-card">
          <div className="timer-card__top">
            <span className="working-pill">
              <span className="working-dot" /> Working
            </span>
            <p className="timer-card__who">{employee.name}</p>
          </div>
          <p className="timer-card__time">{elapsed}</p>
          <p className="timer-card__loc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="12" cy="10" r="2.5" fill="currentColor" />
            </svg>
            {lastLocationLabel || gym?.address || 'On site'}
          </p>
          <div className="timer-card__meta">
            <span>{todayLabel}</span>
            <span>Live shift</span>
          </div>
        </div>
      )}

      {working && (
        <button
          type="button"
          className="end-btn"
          onClick={() => handlePunch('out')}
          disabled={loading}
        >
          <span className="end-btn__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
            </svg>
          </span>
          {loading ? 'Ending…' : 'End'}
        </button>
      )}

      {status && (
        <p className={status.startsWith('Error') ? 'status status--error' : 'status'}>
          {status}
        </p>
      )}
    </section>
  )
}
