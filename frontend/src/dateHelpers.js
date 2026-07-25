/**
 * dateHelpers.js — date utilities for forms + schedule week strip.
 */

export function todayInputValue() {
  return toDateInputValue(new Date())
}

export function toDateInputValue(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function parseDateInput(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateInput, days) {
  const d = parseDateInput(dateInput)
  d.setDate(d.getDate() + days)
  return toDateInputValue(d)
}

/** Sunday-start week containing the selected day (7 YYYY-MM-DD strings). */
export function weekDatesContaining(dateInput) {
  const d = parseDateInput(dateInput)
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    return toDateInputValue(day)
  })
}

export function toDatetimeLocalValue(isoOrDate) {
  if (!isoOrDate) return ''
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  return `${toDateInputValue(d)}T${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}

export function toIso(localValue) {
  if (!localValue) return null
  return localValue.length === 16 ? `${localValue}:00` : localValue
}

/** Build datetime-local from date + "HH:MM" */
export function combineDateAndTime(dateInput, timeInput) {
  if (!dateInput || !timeInput) return ''
  return `${dateInput}T${timeInput}`
}

export function hoursBetween(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso)
  return Math.round((ms / 3600000) * 10) / 10
}

export function breakMinutesForHours(hours) {
  return hours > 4 ? 30 : 10
}
