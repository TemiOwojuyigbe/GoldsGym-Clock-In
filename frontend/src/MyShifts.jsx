/**
 * MyShifts.jsx — Employee read-only view of assigned shifts.
 */

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './authStorage'
import {
  todayInputValue,
  addDays,
  weekDatesContaining,
  toDatetimeLocalValue,
  hoursBetween,
  breakMinutesForHours,
  parseDateInput,
} from './dateHelpers'

export default function MyShifts({ refreshKey }) {
  const [shifts, setShifts] = useState([])
  const [dayFilter, setDayFilter] = useState(todayInputValue())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const week = useMemo(() => weekDatesContaining(dayFilter), [dayFilter])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        // Load all of my shifts so the week strip can show counts
        const data = await apiFetch('/api/my-shifts')
        if (!cancelled) setShifts(data.shifts || [])
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
  }, [refreshKey])

  const dayShifts = useMemo(() => {
    return shifts.filter((s) => {
      const key = toDatetimeLocalValue(s.start_time).slice(0, 10)
      return key === dayFilter
    })
  }, [shifts, dayFilter])

  const countsByDay = useMemo(() => {
    const map = {}
    for (const day of week) map[day] = 0
    for (const s of shifts) {
      const key = toDatetimeLocalValue(s.start_time).slice(0, 10)
      if (key in map) map[key] += 1
    }
    return map
  }, [shifts, week])

  const dayLabel = parseDateInput(dayFilter).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>My shifts</h2>
          <p className="hint panel-subhint">Your assigned schedule</p>
        </div>
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

      {loading && <p className="hint">Loading your shifts…</p>}
      {error && <p className="status status--error">Error: {error}</p>}

      {!loading && dayShifts.length === 0 && (
        <div className="empty-state">
          <p>No shifts for you on this day.</p>
        </div>
      )}

      <div className="card-stack">
        {dayShifts.map((shift) => {
          const hrs = hoursBetween(shift.start_time, shift.end_time)
          const brk = breakMinutesForHours(hrs)
          return (
            <article key={shift.id} className="shift-card">
              <div className="shift-card__main">
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
            </article>
          )
        })}
      </div>
    </section>
  )
}
