/**
 * WeekBoard.jsx — Full week grid of all staff shifts + print button.
 */

import { useMemo } from 'react'
import {
  parseDateInput,
  toDatetimeLocalValue,
  hoursBetween,
  todayInputValue,
} from './dateHelpers'

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function WeekBoard({ week, shifts, onSelectDay, onEdit }) {
  const byDay = useMemo(() => {
    const map = {}
    for (const day of week) map[day] = []
    for (const shift of shifts) {
      const key = toDatetimeLocalValue(shift.start_time).slice(0, 10)
      if (key in map) map[key].push(shift)
    }
    for (const day of week) {
      map[day].sort(
        (a, b) => new Date(a.start_time) - new Date(b.start_time)
      )
    }
    return map
  }, [week, shifts])

  const weekLabel = (() => {
    const start = parseDateInput(week[0])
    const end = parseDateInput(week[6])
    const opts = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(
      undefined,
      { ...opts, year: 'numeric' }
    )}`
  })()

  function handlePrint() {
    window.print()
  }

  return (
    <section className="week-board panel">
      <div className="panel-head no-print-hide">
        <div>
          <h2>Week view</h2>
          <p className="hint panel-subhint">{weekLabel}</p>
        </div>
        <button type="button" className="primary-btn" onClick={handlePrint}>
          Print week
        </button>
      </div>

      <div className="print-only print-title">
        <h1>Gold&apos;s Gym — Staff Schedule</h1>
        <p>{weekLabel}</p>
      </div>

      <div className="week-grid">
        {week.map((day) => {
          const d = parseDateInput(day)
          const isToday = day === todayInputValue()
          const dayShifts = byDay[day] || []
          return (
            <div
              key={day}
              className={`week-col ${isToday ? 'week-col--today' : ''}`}
            >
              <button
                type="button"
                className="week-col__head"
                onClick={() => onSelectDay && onSelectDay(day)}
              >
                <span>
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <strong>
                  {d.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </strong>
              </button>

              <div className="week-col__body">
                {dayShifts.length === 0 && (
                  <p className="week-empty">Open</p>
                )}
                {dayShifts.map((shift) => {
                  const hrs = hoursBetween(shift.start_time, shift.end_time)
                  return (
                    <button
                      key={shift.id}
                      type="button"
                      className="week-chip"
                      onClick={() => onEdit && onEdit(shift)}
                      title="Edit shift"
                    >
                      <strong>{shift.employee_name}</strong>
                      <span>
                        {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
                      </span>
                      <span className="week-chip__meta">{hrs}h</span>
                      {shift.notes ? (
                        <span className="week-chip__notes">{shift.notes}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
