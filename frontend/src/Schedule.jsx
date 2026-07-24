/**
 * Schedule.jsx — Manager view: create shifts (POST) and list them (GET).
 *
 * POST /api/shifts creates a row; GET /api/shifts reloads the table.
 * Uses the same hardcoded employee_id = 1 for the MVP.
 */

import { useEffect, useState } from 'react'

const TEST_EMPLOYEE_ID = 1

/** Turn a datetime-local value into an ISO string Flask can parse. */
function toIso(localValue) {
  if (!localValue) return null
  // datetime-local is "YYYY-MM-DDTHH:MM" — append seconds
  return localValue.length === 16 ? `${localValue}:00` : localValue
}

export default function Schedule({ refreshKey, onChanged }) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadShifts() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/shifts')
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load shifts')
        }
        if (!cancelled) setShifts(data.shifts || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadShifts()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setStatus('')
    setError('')

    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: TEST_EMPLOYEE_ID,
          start_time: toIso(startTime),
          end_time: toIso(endTime),
          notes: notes.trim() || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create shift')
      }

      setStatus(`Shift created (#${data.shift.id})`)
      setStartTime('')
      setEndTime('')
      setNotes('')
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="panel">
      <h2>Shift Schedule</h2>
      <p className="hint">
        Manager tools: add a shift for employee {TEST_EMPLOYEE_ID}, then see it
        listed below.
      </p>

      <form className="schedule-form" onSubmit={handleSubmit}>
        <label>
          Start
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <label>
          End
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>
        <label className="notes-field">
          Notes (optional)
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Front desk, floor, etc."
            maxLength={255}
          />
        </label>
        <button type="submit" className="primary-btn" disabled={submitting}>
          {submitting ? 'Saving...' : 'Add Shift'}
        </button>
      </form>

      {status && <p className="status">{status}</p>}
      {error && <p className="status status--error">Error: {error}</p>}
      {loading && <p className="hint">Loading schedule...</p>}

      {!loading && !error && shifts.length === 0 && (
        <p className="hint">No shifts yet. Add one above.</p>
      )}

      {shifts.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Start</th>
              <th>End</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td>{shift.employee_name || `ID ${shift.employee_id}`}</td>
                <td>{new Date(shift.start_time).toLocaleString()}</td>
                <td>{new Date(shift.end_time).toLocaleString()}</td>
                <td>{shift.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
