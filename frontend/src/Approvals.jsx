/**
 * Approvals.jsx — Admin reviews pending punch edit requests.
 */

import { useEffect, useState } from 'react'
import { apiFetch } from './authStorage'

export default function Approvals({ refreshKey, onChanged }) {
  const [filter, setFilter] = useState('pending')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await apiFetch(`/api/admin/edit-requests?status=${filter}`)
        if (!cancelled) setRequests(data.requests || [])
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
  }, [filter, refreshKey])

  async function review(id, action) {
    setBusyId(id)
    setError('')
    try {
      await apiFetch(`/api/admin/edit-requests/${id}/${action}`, { method: 'POST' })
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Approvals</h2>
          <p className="hint panel-subhint">
            Staff punch fixes wait here until you approve or reject
          </p>
        </div>
        <div className="chip-row">
          {['pending', 'approved', 'rejected', 'all'].map((s) => (
            <button
              key={s}
              type="button"
              className={filter === s ? 'chip chip--active' : 'chip'}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="hint">Loading requests…</p>}
      {error && <p className="status status--error">Error: {error}</p>}

      {!loading && requests.length === 0 && (
        <div className="empty-state">
          <p>
            {filter === 'pending'
              ? 'No pending approvals. Nice and clear.'
              : 'Nothing in this filter yet.'}
          </p>
        </div>
      )}

      <div className="card-stack">
        {requests.map((req) => (
          <article key={req.id} className="request-card">
            <div className="request-card__top">
              <div>
                <p className="feed-title">
                  <strong>{req.employee_name}</strong>
                  {req.request_type === 'fix_time'
                    ? ' wants a punch fix'
                    : ' wants a missing punch added'}
                </p>
                <p className="activity-meta">
                  {req.punch_type.toUpperCase()} ·{' '}
                  {new Date(req.proposed_timestamp).toLocaleString()}
                </p>
              </div>
              <span className={`status-pill status-pill--${req.status}`}>
                {req.status}
              </span>
            </div>

            <p className="request-reason">“{req.reason}”</p>

            {req.original_event && (
              <p className="activity-meta">
                Original: {req.original_event.type} at{' '}
                {new Date(req.original_event.timestamp).toLocaleString()}
              </p>
            )}

            {req.status === 'pending' && (
              <div className="request-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={busyId === req.id}
                  onClick={() => review(req.id, 'approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ghost-btn danger-outline"
                  disabled={busyId === req.id}
                  onClick={() => review(req.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
