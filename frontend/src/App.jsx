/**
 * App.jsx — Gold's Gym Clock-In layout.
 *
 * Sections:
 * 1. ClockButton — employee punches in/out with GPS
 * 2. Schedule — manager creates + views shifts
 * 3. Timesheet — punch history for the test employee
 *
 * refreshKey bumps after clock or schedule changes so lists reload.
 */

import { useState } from 'react'
import ClockButton from './ClockButton'
import Schedule from './Schedule'
import Timesheet from './Timesheet'
import './App.css'

function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  function handleRefresh() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="app">
      <header className="app-header">
        <p className="brand">Gold&apos;s Gym</p>
        <h1>Staff Clock-In</h1>
        <p className="tagline">
          Clock in/out with location · managers schedule shifts
        </p>
      </header>

      <main className="app-main">
        <ClockButton onClocked={handleRefresh} />
        <Schedule refreshKey={refreshKey} onChanged={handleRefresh} />
        <Timesheet refreshKey={refreshKey} />
      </main>
    </div>
  )
}

export default App
