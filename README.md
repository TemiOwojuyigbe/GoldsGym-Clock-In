# Gold's Gym Clock-In

MVP web app for gym staff clock-in/out **and** manager shift scheduling.

- **Frontend:** React (Vite)
- **Backend:** Flask
- **Database:** SQLite (easy to swap for Postgres later)
- **Auth:** none yet — uses hardcoded test employee `Alex Trainer` (id `1`)

## Folder structure

```
GoldsGym-Clock-In/
├── README.md
├── backend/
│   ├── app.py              # Flask entry point
│   ├── models.py           # Employee, ClockEvent, Shift tables
│   ├── requirements.txt
│   └── routes/
│       ├── clock.py        # clock-in, clock-out, timesheet
│       └── shifts.py       # GET + POST /api/shifts
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js      # proxies /api → Flask :5000
    └── src/
        ├── App.jsx
        ├── ClockButton.jsx # Geolocation + clock punches
        ├── Schedule.jsx    # manager create/list shifts
        └── Timesheet.jsx   # punch history
```

## How the features work together

| Who | Action | API |
|-----|--------|-----|
| Manager | Create a shift | `POST /api/shifts` |
| Manager | View schedule | `GET /api/shifts` |
| Employee | Clock in (with GPS) | `POST /api/clock-in` |
| Employee | Clock out (with GPS) | `POST /api/clock-out` |
| Anyone | View punches | `GET /api/timesheet/1` |

**Shifts** = planned schedule. **Clock events** = actual punches. They are separate on purpose for this MVP.

## API endpoints

| Method | Path | Body |
|--------|------|------|
| `POST` | `/api/clock-in` | `{ "employee_id", "lat", "long" }` |
| `POST` | `/api/clock-out` | `{ "employee_id", "lat", "long" }` |
| `GET` | `/api/timesheet/:employee_id` | — |
| `GET` | `/api/shifts` | — |
| `POST` | `/api/shifts` | `{ "employee_id", "start_time", "end_time", "notes?" }` |

## How to run locally

### 1. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

API: http://127.0.0.1:5000

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173 — allow location when prompted.

## Quick API smoke tests (PowerShell)

With the backend running:

```powershell
# List shifts (empty at first)
Invoke-RestMethod http://127.0.0.1:5000/api/shifts

# Create a shift
$body = @{
  employee_id = 1
  start_time  = "2026-07-25T09:00:00"
  end_time    = "2026-07-25T17:00:00"
  notes       = "Front desk"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri http://127.0.0.1:5000/api/shifts `
  -ContentType "application/json" -Body $body

# List again — new shift should appear
Invoke-RestMethod http://127.0.0.1:5000/api/shifts
```

## Notes

- Geolocation works on `localhost` without HTTPS; production needs HTTPS.
- Comments in the code explain each major block for learning.
- To use Postgres later, change `SQLALCHEMY_DATABASE_URI` in `backend/app.py`.
