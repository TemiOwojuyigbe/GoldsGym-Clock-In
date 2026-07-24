/**
 * ClockButton.jsx — Clock in / out with browser Geolocation.
 *
 * Flow:
 * 1. Ask for GPS (navigator.geolocation)
 * 2. POST to /api/clock-in or /api/clock-out
 * 3. Show feedback and flip the button mode
 *
 * No auth yet — hardcoded employee_id = 1 (Alex Trainer).
 */

import { useState } from 'react'

const TEST_EMPLOYEE_ID = 1

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
      (error) => {
        reject(new Error(error.message || 'Could not get location.'))
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

export default function ClockButton({ onClocked }) {
  const [mode, setMode] = useState('in')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    setStatus('Getting your location...')

    try {
      const location = await getCurrentPosition()
      setStatus(`Location found. Sending clock-${mode}...`)

      const endpoint = mode === 'in' ? '/api/clock-in' : '/api/clock-out'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: TEST_EMPLOYEE_ID,
          lat: location.lat,
          long: location.long,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Request failed')
      }

      setMode(mode === 'in' ? 'out' : 'in')
      setStatus(
        `${data.message} at ${new Date(data.event.timestamp).toLocaleString()} ` +
          `(${location.lat.toFixed(4)}, ${location.long.toFixed(4)})`
      )

      if (onClocked) onClocked()
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <h2>Clock {mode === 'in' ? 'In' : 'Out'}</h2>
      <p className="hint">
        Employee ID: {TEST_EMPLOYEE_ID} (Alex Trainer — no login yet)
      </p>

      <button
        className={`clock-btn clock-btn--${mode}`}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Working...' : `Clock ${mode === 'in' ? 'In' : 'Out'}`}
      </button>

      {status && <p className="status">{status}</p>}
    </section>
  )
}
