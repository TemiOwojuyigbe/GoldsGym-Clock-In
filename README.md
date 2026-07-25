# Gold's Gym Clock-In (Bowie)

MVP for staff clock-in/out **with geofencing** and **dual login portals** for employees vs managers.

- **Frontend:** React (Vite)
- **Backend:** Flask
- **Database:** SQLite
- **Gym pin:** Gold's Gym, 12510 Fairwood Pkwy, Bowie, MD 20720 (~200m radius)

## Dual portals

| Portal | Who | What they get |
|--------|-----|----------------|
| **Employee Login** | All staff (including managers) | Clock in/out, timesheet, punch edit requests. Must be near the gym. |
| **Admin Login** | `role=admin` only | Team activity feed, schedule (add/edit/delete + filters), approvals. |

Managers (like Jordan) use **Employee Login** to punch, then **Admin Login** when they need to manage schedules.

## Demo accounts

Password for both: `password123`

| Email | Role | Portals |
|-------|------|---------|
| `alex@goldsgym.local` | employee | Employee only |
| `jordan@goldsgym.local` | admin | Employee + Admin |

## Folder structure

```
GoldsGym-Clock-In/
├── backend/
│   ├── app.py           # Flask entry, seeds users
│   ├── auth.py          # tokens + portal guards
│   ├── geofence.py      # Bowie gym distance check
│   ├── models.py        # Employee (role/password), ClockEvent, Shift
│   └── routes/
│       ├── auth.py      # login/employee, login/admin, /me, /gym, /employees
│       ├── clock.py     # clock-in/out + timesheet (employee portal)
│       └── shifts.py    # schedule GET/POST (admin portal)
└── frontend/src/
    ├── LoginPage.jsx
    ├── EmployeePortal.jsx
    ├── AdminPortal.jsx
    ├── ClockButton.jsx
    ├── Schedule.jsx
    └── Timesheet.jsx
```

## How to run

### Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python app.py
```

If you had an older DB without passwords, the app rebuilds tables automatically once.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## API overview

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/login/employee` | — | Any staff account |
| `POST` | `/api/login/admin` | — | Admin accounts only |
| `GET` | `/api/me` | Bearer | Current user + portal |
| `GET` | `/api/gym` | — | Geofence info |
| `POST` | `/api/clock-in` | Employee portal | Requires lat/long near gym |
| `POST` | `/api/clock-out` | Employee portal | Requires lat/long near gym |
| `GET` | `/api/timesheet` | Employee portal | Own punches |
| `GET` | `/api/shifts` | Admin portal | List schedule |
| `POST` | `/api/shifts` | Admin portal | Create shift |
| `GET` | `/api/employees` | Admin portal | Staff list for assigning shifts |

Send the token as: `Authorization: Bearer <token>`

## Geofencing note

Clock punches are rejected if you are more than **200 meters** from the Bowie gym coordinates. Testing from home will fail on purpose — go to the gym (or temporarily raise `GYM_RADIUS_METERS` in `backend/geofence.py` for remote demos).
