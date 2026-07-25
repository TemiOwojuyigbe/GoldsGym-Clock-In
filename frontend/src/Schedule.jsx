/**
 * Schedule.jsx — Friendlier manager scheduling (Tester).
 *
 * - Week strip to jump days
 * - Add shift with date + time + length presets (4h / 8h)
 * - Cards show duration + break allowance
 */

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './authStorage'
import {
  todayInputValue,
  toDatetimeLocalValue,
  toIso,
  addDays,
  weekDatesContaining,
  combineDateAndTime,
  hoursBetween,
  breakMinutesForHours,
  parseDateInput,
} from './dateHelpers'

const PRESETS = [
  { id: 'morn', label: 'Morning 9–1', start: '09:00', hours: 4 },
  { id: 'mid', label: 'Mid 1–5', start: '13:00', hours: 4 },
  { id: 'eve', label: 'Evening 5–9', start: '17:00', hours: 4 },
  { id: 'double', label: 'Double 9–5', start: '09:00', hours: 8 },
]

const emptyForm = {
  employeeId: '',
  date: todayInputValue(),
  startClock: '09:00',
  hours: 4,
  notes: '',
}

function endFromStart(date, startClock, hours) {
  const start = new Date(`${date}T${startClock}:00`)
  start.setMinutes(start.getMinutes() + Math.round(hours * 60))
  return toDatetimeLocalValue(start)
}

export default function Schedule({ refreshKey, onChanged }) {
  const [allShifts, setAllShifts] = useState([])
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

  const week = useMemo(() => weekDatesContaining(dayFilter), [dayFilter])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (roleFilter !== 'all') params.set('role', roleFilter)
        // Load all (or role-filtered) so the week strip can show counts
        const [shiftData, empData] = await Promise.all([
          apiFetch(`/api/shifts?${params.toString()}`),
          apiFetch('/api/employees'),
        ])
        if (!cancelled) {
          setAllShifts(shiftData.shifts || [])
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
  }, [refreshKey, roleFilter])

  const dayShifts = useMemo(() => {
    return allShifts.filter((s) => {
      const local = toDatetimeLocalValue(s.start_time).slice(0, 10)
      return local === dayFilter
    })
  }, [allShifts, dayFilter])

  const countsByDay = useMemo(() => {
    const map = {}
    for (const day of week) map[day] = 0
    for (const s of allShifts) {
      const key = toDatetimeLocalValue(s.start_time).slice(0, 10)
      if (key in map) map[key] += 1
    }
    return map
  }, [allShifts, week])

  const dayLabel = parseDateInput(dayFilter).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  function openCreate() {
    setEditingId(null)
    setForm({
      ...emptyForm,
      date: dayFilter,
      employeeId: employees[0] ? String(employees[0].id) : '',
    })
    setShowForm(true)
    setStatus('')
  }

  function openEdit(shift) {
    const startLocal = toDatetimeLocalValue(shift.start_time)
    const endLocal = toDatetimeLocalValue(shift.end_time)
    const hrs = hoursBetween(shift.start_time, shift.end_time)
    setEditingId(shift.id)
    setForm({
      employeeId: String(shift.employee_id),
      date: startLocal.slice(0, 10),
      startClock: startLocal.slice(11, 16),
      hours: hrs || 4,
      notes: shift.notes || '',
    })
    setShowForm(true)
    setStatus('')
  }

  function applyPreset(preset) {
    setForm((prev) => ({
      ...prev,
      startClock: preset.start,
      hours: preset.hours,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setStatus('')
    setError('')

    const startTime = combineDateAndTime(form.date, form.startClock)
    const endTime = endFromStart(form.date, form.startClock, Number(form.hours))

    const body = {
      employee_id: Number(form.employeeId),
      start_time: toIso(startTime),
      end_time: toIso(endTime),
      notes: form.notes.trim() || null,
    }

    try {
      if (editingId) {
        const data = await apiFetch(`/api/shifts/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        setStatus(`Updated ${data.shift.employee_name}'s shift`)
        setDayFilter(form.date)
      } else {
        const data = await apiFetch('/api/shifts', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        setStatus(`Scheduled ${data.shift.employee_name}`)
        setDayFilter(form.date)
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
      `Remove ${shift.employee_name}'s shift on ${new Date(
        shift.start_time
      ).toLocaleString()}?`
    )
    if (!ok) return
    setError('')
    try {
      await apiFetch(`/api/shifts/${shift.id}`, { method: 'DELETE' })
      setStatus('Shift removed')
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  async function duplicateShift(shift) {
    const startLocal = toDatetimeLocalValue(shift.start_time)
    const hrs = hoursBetween(shift.start_time, shift.end_time)
    setEditingId(null)
    setForm({
      employeeId: String(shift.employee_id),
      date: dayFilter,
      startClock: startLocal.slice(11, 16),
      hours: hrs || 4,
      notes: shift.notes || '',
    })
    setShowForm(true)
    setStatus('Review and save to duplicate onto this day')
  }

  const filteredEmployees =
    roleFilter === 'all'
      ? employees
      : employees.filter((e) => e.role === roleFilter)

  const previewHours = Number(form.hours) || 0
  const previewBreak = breakMinutesForHours(previewHours)

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Schedule</h2>
          <p className="hint panel-subhint">
            Pick a day, then add a shift in a few taps
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={openCreate}>
          + Add shift
        </button>
      </div>

      <div className="day-nav">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setDayFilter(addDays(dayFilter, -1))}
        >
          ←
        </button>
        <div className="day-nav__center">
          <strong>{dayLabel}</strong>
          <button
            type="button"
            className="linkish"
            onClick={() => setDayFilter(todayInputValue())}
          >
            Jump to today
          </button>
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setDayFilter(addDays(dayFilter, 1))}
        >
          →
        </button>
      </div>

      <div className="week-strip" role="tablist" aria-label="Week">
        {week.map((day) => {
          const d = parseDateInput(day)
          const isActive = day === dayFilter
          const isToday = day === todayInputValue()
          return (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`week-day ${isActive ? 'week-day--active' : ''} ${
                isToday ? 'week-day--today' : ''
              }`}
              onClick={() => setDayFilter(day)}
            >
              <span className="week-day__name">
                {d.toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className="week-day__num">{d.getDate()}</span>
              <span className="week-day__count">
                {countsByDay[day] ? `${countsByDay[day]}` : '·'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="chip-row" aria-label="Filter by role">
        {[
          { id: 'all', label: 'Everyone' },
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
            Who
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

          <div className="notes-field">
            <span className="preset-label">Quick presets</span>
            <div className="chip-row">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            Day
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </label>
          <label>
            Start time
            <input
              type="time"
              value={form.startClock}
              onChange={(e) => setForm({ ...form, startClock: e.target.value })}
              required
            />
          </label>

          <div className="notes-field">
            <span className="preset-label">Length</span>
            <div className="chip-row">
              {[4, 8].map((h) => (
                <button
                  key={h}
                  type="button"
                  className={
                    Number(form.hours) === h ? 'chip chip--active' : 'chip'
                  }
                  onClick={() => setForm({ ...form, hours: h })}
                >
                  {h} hours
                </button>
              ))}
            </div>
            <label className="inline-hours">
              Or custom hours
              <input
                type="number"
                min="0.5"
                max="16"
                step="0.5"
                value={form.hours}
                onChange={(e) => setForm({ ...form, hours: e.target.value })}
                required
              />
            </label>
          </div>

          <p className="break-preview">
            Ends{' '}
            {new Date(
              toIso(endFromStart(form.date, form.startClock, previewHours))
            ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            {' · '}
            {previewBreak} min break for this length
          </p>

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

      {!loading && (
        <p className="day-summary">
          {dayShifts.length === 0
            ? 'No one scheduled this day yet.'
            : `${dayShifts.length} shift${dayShifts.length === 1 ? '' : 's'} on ${dayLabel}`}
        </p>
      )}

      <div className="card-stack">
        {dayShifts.map((shift) => {
          const hrs = hoursBetween(shift.start_time, shift.end_time)
          const brk = breakMinutesForHours(hrs)
          return (
            <article key={shift.id} className="shift-card">
              <div className="shift-card__main">
                <p className="feed-title">
                  <strong>{shift.employee_name}</strong>
                  <span className="role-tag">{shift.employee_role}</span>
                </p>
                <p className="shift-when">
                  {new Date(shift.start_time).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {' – '}
                  {new Date(shift.end_time).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  <span className="shift-duration">
                    {' '}
                    · {hrs}h · {brk} min break
                  </span>
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
                  className="ghost-btn"
                  onClick={() => duplicateShift(shift)}
                >
                  Copy
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
          )
        })}
      </div>
    </section>
  )
}
