/**
 * TeamActivity.jsx — Admin feed: who clocked in/out (default today).
 */

import { useEffect, useState } from 'react'
import { apiFetch } from './authStorage'
import { todayInputValue } from './dateHelpers'

export default function TeamActivity({ refreshKey }) {
  const [date, setDate] = useState(todayInputValue())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await apiFetch(`/api/admin/activity?date=${date}`)
        if (!cancelled) setEvents(data.events || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [date, refreshKey])

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Team activity</h2>
          <p className="hint panel-subhint">Live punch feed for your staff</p>
        </div>
        <label className="filter-label">
          Day
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {loading && <p className="hint">Loading activity…</p>}
      {error && <p className="status status--error">Error: {error}</p>}

      {!loading && !error && events.length === 0 && (
        <div className="empty-state">
          <p>No punches on this day yet.</p>
        </div>
      )}

      {events.length > 0 && (
        <ol className="activity-feed admin-feed">
          {events.map((event, index) => (
            <li key={event.id} className="activity-item">
              <div className="activity-rail">
                <span className={`activity-dot activity-dot--${event.type}`} />
                {index < events.length - 1 && <span className="activity-line" />}
              </div>
              <div className="activity-body">
                <div className="activity-row">
                  <p className="feed-title">
                    <strong>{event.employee_name || `Staff #${event.employee_id}`}</strong>
                    {event.type === 'in'
                      ? ' clocked in'
                      : event.type === 'out'
                        ? ' clocked out'
                        : event.type === 'break_start'
                          ? ' started break'
                          : event.type === 'break_end'
                            ? ' ended break'
                            : ` ${event.type}`}
                  </p>
                  <time className="activity-time">
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p className="activity-meta">
                  <span className={`badge badge--${event.type}`}>
                    {event.type}
                  </span>
                  {event.latitude != null
                    ? ` · ${event.latitude.toFixed(4)}, ${event.longitude.toFixed(4)}`
                    : ' · no GPS'}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
