/**
 * Timesheet.jsx — Punch history for the test employee.
 * Fetches GET /api/timesheet/:employee_id
 */

import { useEffect, useState } from 'react'

const TEST_EMPLOYEE_ID = 1

export default function Timesheet({ refreshKey }) {
  const [employee, setEmployee] = useState(null)
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadTimesheet() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/timesheet/${TEST_EMPLOYEE_ID}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load timesheet')
        }

        if (!cancelled) {
          setEmployee(data.employee)
          setEvents(data.events)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadTimesheet()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <section className="panel">
      <h2>Timesheet</h2>

      {employee && (
        <p className="hint">
          {employee.name} · {employee.email}
        </p>
      )}

      {loading && <p className="hint">Loading...</p>}
      {error && <p className="status status--error">Error: {error}</p>}

      {!loading && !error && events.length === 0 && (
        <p className="hint">No clock events yet. Clock in to create the first one.</p>
      )}

      {events.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Timestamp</th>
              <th>Latitude</th>
              <th>Longitude</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  <span className={`badge badge--${event.type}`}>
                    {event.type}
                  </span>
                </td>
                <td>{new Date(event.timestamp).toLocaleString()}</td>
                <td>
                  {event.latitude != null ? event.latitude.toFixed(5) : '—'}
                </td>
                <td>
                  {event.longitude != null ? event.longitude.toFixed(5) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
