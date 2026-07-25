/**
 * Timesheet.jsx — "My day log" activity timeline (reference-style).
 */

import { useEffect, useState } from 'react'
import { apiFetch } from './authStorage'

export default function Timesheet({ refreshKey, compact }) {
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
        const data = await apiFetch('/api/timesheet')
        if (!cancelled) {
          setEmployee(data.employee)
          setEvents(data.events || [])
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

  const today = new Date()
  const todayEvents = events.filter((e) => {
    const d = new Date(e.timestamp)
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    )
  })

  const list = compact ? todayEvents : events

  return (
    <section className={`panel activity-panel ${compact ? 'activity-panel--compact' : ''}`}>
      <div className="panel-head">
        <h2>{compact ? 'My day log' : 'Activity'}</h2>
        <span className="date-pill">
          {today.toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
          })}{' '}
          Today
        </span>
      </div>

      {employee && !compact && (
        <p className="hint">
          {employee.name} · {employee.email}
        </p>
      )}

      {loading && <p className="hint">Loading…</p>}
      {error && <p className="status status--error">Error: {error}</p>}

      {!loading && !error && list.length === 0 && (
        <p className="hint">
          {compact
            ? 'No punches yet today. Tap Start when you arrive.'
            : 'No clock events yet.'}
        </p>
      )}

      {list.length > 0 && (
        <ol className="activity-feed">
          {list.map((event, index) => (
            <li key={event.id} className="activity-item">
              <div className="activity-rail">
                <span className={`activity-dot activity-dot--${event.type}`} />
                {index < list.length - 1 && <span className="activity-line" />}
              </div>
              <div className="activity-body">
                <div className="activity-row">
                  <span className={`badge badge--${event.type}`}>
                    {event.type === 'in'
                      ? 'Clocked in'
                      : event.type === 'out'
                        ? 'Clocked out'
                        : event.type === 'break_start'
                          ? 'Break started'
                          : event.type === 'break_end'
                            ? 'Break ended'
                            : event.type}
                  </span>
                  <time className="activity-time">
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p className="activity-meta">
                  {event.latitude != null
                    ? `${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`
                    : 'Location saved'}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
