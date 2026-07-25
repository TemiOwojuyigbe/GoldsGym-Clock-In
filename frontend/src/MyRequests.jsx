/**
 * MyRequests.jsx — Employee: submit punch fixes and track approval status.
 */

import { useEffect, useState } from 'react'
import { apiFetch } from './authStorage'
import { toDatetimeLocalValue, toIso } from './dateHelpers'

export default function MyRequests({ refreshKey, onChanged }) {
  const [requests, setRequests] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [requestType, setRequestType] = useState('add_punch')
  const [punchType, setPunchType] = useState('in')
  const [proposed, setProposed] = useState('')
  const [clockEventId, setClockEventId] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [reqData, sheet] = await Promise.all([
          apiFetch('/api/edit-requests'),
          apiFetch('/api/timesheet'),
        ])
        if (!cancelled) {
          setRequests(reqData.requests || [])
          setEvents(sheet.events || [])
          if (!clockEventId && sheet.events?.[0]) {
            setClockEventId(String(sheet.events[0].id))
          }
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setStatus('')
    setError('')
    try {
      const body = {
        request_type: requestType,
        punch_type: punchType,
        proposed_timestamp: toIso(proposed),
        reason: reason.trim(),
      }
      if (requestType === 'fix_time') {
        body.clock_event_id = Number(clockEventId)
      }
      await apiFetch('/api/edit-requests', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setStatus('Request sent — waiting for manager approval')
      setReason('')
      setProposed('')
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>My requests</h2>
          <p className="hint panel-subhint">
            Ask a manager to fix or add a punch
            {pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
          </p>
        </div>
      </div>

      <form className="schedule-form composer" onSubmit={handleSubmit}>
        <label>
          Request type
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
          >
            <option value="add_punch">Add missing punch</option>
            <option value="fix_time">Fix existing punch</option>
          </select>
        </label>
        <label>
          Punch type
          <select
            value={punchType}
            onChange={(e) => setPunchType(e.target.value)}
          >
            <option value="in">Clock in</option>
            <option value="out">Clock out</option>
          </select>
        </label>

        {requestType === 'fix_time' && (
          <label className="notes-field">
            Which punch?
            <select
              value={clockEventId}
              onChange={(e) => {
                setClockEventId(e.target.value)
                const ev = events.find((x) => String(x.id) === e.target.value)
                if (ev) {
                  setPunchType(ev.type)
                  setProposed(toDatetimeLocalValue(ev.timestamp))
                }
              }}
              required
            >
              {events.length === 0 && (
                <option value="">No punches yet</option>
              )}
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.type.toUpperCase()} ·{' '}
                  {new Date(ev.timestamp).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="notes-field">
          Correct time
          <input
            type="datetime-local"
            value={proposed}
            onChange={(e) => setProposed(e.target.value)}
            required
          />
        </label>
        <label className="notes-field">
          Reason
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Forgot to clock in on arrival"
            maxLength={255}
            required
          />
        </label>
        <button type="submit" className="primary-btn" disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit request'}
        </button>
      </form>

      {status && <p className="status">{status}</p>}
      {error && <p className="status status--error">Error: {error}</p>}
      {loading && <p className="hint">Loading…</p>}

      <div className="card-stack" style={{ marginTop: '1rem' }}>
        {requests.map((req) => (
          <article key={req.id} className="request-card">
            <div className="request-card__top">
              <div>
                <p className="feed-title">
                  {req.request_type === 'fix_time' ? 'Punch fix' : 'Add punch'} ·{' '}
                  {req.punch_type}
                </p>
                <p className="activity-meta">
                  {new Date(req.proposed_timestamp).toLocaleString()}
                </p>
              </div>
              <span className={`status-pill status-pill--${req.status}`}>
                {req.status}
              </span>
            </div>
            <p className="request-reason">“{req.reason}”</p>
            {req.status === 'pending' && (
              <p className="activity-meta">Your edit is pending manager approval.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
