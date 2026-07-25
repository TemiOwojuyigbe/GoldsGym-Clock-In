/**
 * dateHelpers.js — small date utilities for forms + filters.
 */

/** Today as YYYY-MM-DD (local). */
export function todayInputValue() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** ISO / Date → value for <input type="datetime-local"> */
export function toDatetimeLocalValue(isoOrDate) {
  if (!isoOrDate) return ''
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

/** datetime-local → ISO-ish string Flask can parse */
export function toIso(localValue) {
  if (!localValue) return null
  return localValue.length === 16 ? `${localValue}:00` : localValue
}
