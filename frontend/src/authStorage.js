/**
 * authStorage.js — Save / read / clear the login session in localStorage.
 *
 * We store: token, portal ("employee" | "admin"), and employee profile.
 */

const STORAGE_KEY = "goldsgym_auth"

export function saveAuth({ token, portal, employee }) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ token, portal, employee })
  )
}

export function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY)
}

/** fetch() wrapper that attaches the Bearer token automatically. */
export async function apiFetch(path, options = {}) {
  const auth = loadAuth()
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  }
  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`
  }

  const response = await fetch(path, { ...options, headers })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const err = new Error(data.error || "Request failed")
    err.status = response.status
    err.data = data
    throw err
  }

  return data
}
