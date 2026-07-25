/**
 * ClockButton.jsx — Start / End + breaks, geofence-gated Start.
 *
 * Start stays disabled until the employee is inside the green gym zone.
 * Break length comes from the scheduled shift (≤4h → 10 min, longer → 30 min).
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

function applySession(session, setters) {
  const { setWorking, setOnBreak, setStartedAt, setBreakStartedAt, setBreakInfo } =
    setters
  if (!session) return
  setWorking(!!session.clocked_in)
  setOnBreak(!!session.on_break)
  setStartedAt(session.clock_in_at ? new Date(session.clock_in_at).getTime() : null)
  setBreakStartedAt(
    session.break_started_at ? new Date(session.break_started_at).getTime() : null
  )
  setBreakInfo(session.break || null)
}

export default function ClockButton({
  employee,
  gym,
  insideGeofence,
  locationReady,
  onClocked,
  onLocationUpdate,
}) {
  const [working, setWorking] = useState(false)
  const [onBreak, setOnBreak] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [breakStartedAt, setBreakStartedAt] = useState(null)
  const [breakInfo, setBreakInfo] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [lastLocationLabel, setLastLocationLabel] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const sessionSetters = {
    setWorking,
    setOnBreak,
    setStartedAt,
    setBreakStartedAt,
    setBreakInfo,
  }

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const data = await apiFetch('/api/session')
        if (!cancelled) applySession(data, sessionSetters)
      } catch {
        // still allow punching
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    hydrate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!working) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [working])

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
    if (nextAction === 'in' && !insideGeofence) {
      setStatus('Error: Move inside the green gym zone to Start.')
      return
    }

    setLoading(true)
    setStatus(
      gym?.testing_bypass
        ? 'Testing mode — sending punch…'
        : 'Getting your location…'
    )

    try {
      let location
      try {
        location = await getCurrentPosition()
      } catch (geoErr) {
        if (gym?.testing_bypass && gym.latitude != null) {
          location = { lat: gym.latitude, long: gym.longitude }
        } else {
          throw geoErr
        }
      }
      if (onLocationUpdate) onLocationUpdate(location)

      setStatus(nextAction === 'in' ? 'Checking gym zone…' : 'Ending shift…')

      const endpoint = nextAction === 'in' ? '/api/clock-in' : '/api/clock-out'
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          lat: location.lat,
          long: location.long,
        }),
      })

      setLastLocationLabel(
        gym?.address || `${location.lat.toFixed(4)}, ${location.long.toFixed(4)}`
      )
      applySession(data.session, sessionSetters)
      setStatus(
        `${data.message} · ${data.distance_meters ?? 0}m from gym` +
          (data.distance_meters != null && gym?.testing_bypass ? ' (testing bypass)' : '')
      )
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

  async function handleBreak(action) {
    setLoading(true)
    setStatus(action === 'start' ? 'Starting break…' : 'Ending break…')
    try {
      const endpoint = action === 'start' ? '/api/break-start' : '/api/break-end'
      const data = await apiFetch(endpoint, { method: 'POST', body: '{}' })
      applySession(data.session, sessionSetters)
      setStatus(data.message)
      if (onClocked) onClocked()
    } catch (err) {
      setStatus(`Error: ${err.message}`)
      if (err.data?.session) applySession(err.data.session, sessionSetters)
    } finally {
      setLoading(false)
    }
  }

  const shiftElapsed =
    working && startedAt != null ? formatElapsed(now - startedAt) : '00:00:00'
  const breakElapsed =
    onBreak && breakStartedAt != null
      ? formatElapsed(now - breakStartedAt)
      : '00:00:00'

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const canStart = insideGeofence && !loading
  const startHint = gym?.testing_bypass
    ? 'Testing mode: geofence bypass is ON — you can Start from anywhere to try breaks.'
    : !locationReady
      ? 'Finding your location… Start unlocks inside the green zone.'
      : insideGeofence
        ? `You're in the zone — tap Start at ${gym?.name || "Gold's Gym"}`
        : 'Start is locked until you are inside the green gym zone.'

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
            className={`start-btn ${!insideGeofence ? 'start-btn--locked' : ''}`}
            onClick={() => handlePunch('in')}
            disabled={!canStart}
            title={
              insideGeofence
                ? 'Clock in'
                : 'Move inside the green zone to enable Start'
            }
          >
            <span className="start-btn__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M12 7v5l3 2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="start-btn__label">
              {loading ? '…' : insideGeofence ? 'Start' : 'Locked'}
            </span>
          </button>
          <p className="start-caption">{startHint}</p>
        </div>
      ) : (
        <div className={`timer-card ${onBreak ? 'timer-card--break' : ''}`}>
          <div className="timer-card__top">
            <span className={`working-pill ${onBreak ? 'working-pill--break' : ''}`}>
              <span className="working-dot" />
              {onBreak ? 'On break' : 'Working'}
            </span>
            <p className="timer-card__who">{employee.name}</p>
          </div>
          <p className="timer-card__time">
            {onBreak ? breakElapsed : shiftElapsed}
          </p>
          <p className="timer-card__loc">
            {onBreak
              ? `Break timer · ${breakInfo?.entitled_minutes ?? '—'} min allowed`
              : lastLocationLabel || gym?.address || 'On site'}
          </p>
          <div className="timer-card__meta">
            <span>{todayLabel}</span>
            <span>
              {onBreak
                ? `Shift ${shiftElapsed}`
                : breakInfo
                  ? `Break ${breakInfo.used_minutes}/${breakInfo.entitled_minutes} min`
                  : 'Live shift'}
            </span>
          </div>
        </div>
      )}

      {working && breakInfo && (
        <p className="break-policy-hint">
          {breakInfo.shift
            ? `Scheduled ${breakInfo.shift_hours}h shift → ${breakInfo.entitled_minutes} min break`
            : `Break allowance: ${breakInfo.entitled_minutes} min (≤4h = 10, longer = 30)`}
          {` · ${breakInfo.remaining_minutes} min left`}
        </p>
      )}

      {working && (
        <div className="action-row">
          {!onBreak ? (
            <button
              type="button"
              className="break-btn"
              onClick={() => handleBreak('start')}
              disabled={loading || (breakInfo?.remaining_minutes ?? 0) <= 0}
            >
              Start break
            </button>
          ) : (
            <button
              type="button"
              className="break-btn break-btn--end"
              onClick={() => handleBreak('end')}
              disabled={loading}
            >
              End break
            </button>
          )}

          <button
            type="button"
            className="end-btn"
            onClick={() => handlePunch('out')}
            disabled={loading || onBreak}
            title={onBreak ? 'End break before clocking out' : 'Clock out'}
          >
            <span className="end-btn__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
              </svg>
            </span>
            {loading ? '…' : 'End'}
          </button>
        </div>
      )}

      {status && (
        <p className={status.startsWith('Error') ? 'status status--error' : 'status'}>
          {status}
        </p>
      )}
    </section>
  )
}
