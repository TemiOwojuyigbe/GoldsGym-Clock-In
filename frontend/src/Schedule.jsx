/**
 * Schedule.jsx — Admin schedule with day/role filters, edit + delete.
 */

import { useEffect, useState } from 'react'
import { apiFetch } from './authStorage'
import { todayInputValue, toDatetimeLocalValue, toIso } from './dateHelpers'

const emptyForm = {
  employeeId: '',
  startTime: '',
  endTime: '',
  notes: '',
}

export default function Schedule({ refreshKey, onChanged }) {
  const [shifts, setShifts] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [dayFilter, setDayFilter] = useState(todayInputValue())
  const [roleFilter, setRoleFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (dayFilter) params.set('date', dayFilter)
        if (roleFilter !== 'all') params.set('role', roleFilter)

        const [shiftData, empData] = await Promise.all([
          apiFetch(`/api/shifts?${params.toString()}`),
          apiFetch('/api/employees'),
        ])
        if (!cancelled) {
          setShifts(shiftData.shifts || [])
          setEmployees(empData.employees || [])
          setForm((prev) => ({
            ...prev,
            employeeId:
              prev.employeeId ||
              (empData.employees?.[0] ? String(empData.employees[0].id) : ''),
          }))
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
  }, [refreshKey, dayFilter, roleFilter])

  function openCreate() {
    setEditingId(null)
    setForm({
      ...emptyForm,
      employeeId: employees[0] ? String(employees[0].id) : '',
    })
    setShowForm(true)
    setStatus('')
  }

  function openEdit(shift) {
    setEditingId(shift.id)
    setForm({
      employeeId: String(shift.employee_id),
      startTime: toDatetimeLocalValue(shift.start_time),
      endTime: toDatetimeLocalValue(shift.end_time),
      notes: shift.notes || '',
    })
    setShowForm(true)
    setStatus('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setStatus('')
    setError('')

    const body = {
      employee_id: Number(form.employeeId),
      start_time: toIso(form.startTime),
      end_time: toIso(form.endTime),
      notes: form.notes.trim() || null,
    }

    try {
      if (editingId) {
        const data = await apiFetch(`/api/shifts/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        setStatus(`Updated shift for ${data.shift.employee_name}`)
      } else {
        const data = await apiFetch('/api/shifts', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        setStatus(`Added shift for ${data.shift.employee_name}`)
      }
      setShowForm(false)
      setEditingId(null)
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(shift) {
    const ok = window.confirm(
      `Delete ${shift.employee_name}'s shift on ${new Date(
        shift.start_time
      ).toLocaleString()}?`
    )
    if (!ok) return
    setError('')
    try {
      await apiFetch(`/api/shifts/${shift.id}`, { method: 'DELETE' })
      setStatus('Shift deleted')
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredEmployees =
    roleFilter === 'all'
      ? employees
      : employees.filter((e) => e.role === roleFilter)

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Schedule</h2>
          <p className="hint panel-subhint">
            Filter by day or role · edit or remove anytime
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={openCreate}>
          + Add shift
        </button>
      </div>

      <div className="toolbar">
        <label className="filter-label">
          Day
          <input
            type="date"
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
          />
        </label>
        <div className="chip-row" aria-label="Filter by role">
          {[
            { id: 'all', label: 'All roles' },
            { id: 'employee', label: 'Employees' },
            { id: 'admin', label: 'Managers' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={roleFilter === opt.id ? 'chip chip--active' : 'chip'}
              onClick={() => setRoleFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <form className="schedule-form composer" onSubmit={handleSubmit}>
          <div className="composer-head">
            <strong>{editingId ? 'Edit shift' : 'New shift'}</strong>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              Cancel
            </button>
          </div>

          <label className="notes-field">
            Employee
            <select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              required
            >
              {(filteredEmployees.length ? filteredEmployees : employees).map(
                (emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                )
              )}
            </select>
          </label>
          <label>
            Start
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
            />
          </label>
          <label>
            End
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              required
            />
          </label>
          <label className="notes-field">
            Notes (optional)
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Front desk, floor, etc."
              maxLength={255}
            />
          </label>
          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Create shift'}
          </button>
        </form>
      )}

      {status && <p className="status">{status}</p>}
      {error && <p className="status status--error">Error: {error}</p>}
      {loading && <p className="hint">Loading schedule…</p>}

      {!loading && shifts.length === 0 && (
        <div className="empty-state">
          <p>No shifts for this filter. Add one or pick another day.</p>
        </div>
      )}

      <div className="card-stack">
        {shifts.map((shift) => (
          <article key={shift.id} className="shift-card">
            <div className="shift-card__main">
              <p className="feed-title">
                <strong>{shift.employee_name}</strong>
                <span className="role-tag">{shift.employee_role}</span>
              </p>
              <p className="shift-when">
                {new Date(shift.start_time).toLocaleString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {' → '}
                {new Date(shift.end_time).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              {shift.notes && <p className="activity-meta">{shift.notes}</p>}
            </div>
            <div className="shift-card__actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => openEdit(shift)}
              >
                Edit
              </button>
              <button
                type="button"
                className="ghost-btn danger-outline"
                onClick={() => handleDelete(shift)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
