/**
 * ThemeToggle.jsx — Light / dark mode switch (SVG icons, no emoji).
 */

import { useTheme } from './theme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Dark mode' : 'Light mode'}
    >
      {isLight ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
