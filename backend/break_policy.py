"""
break_policy.py - Crofton / Bowie staff break rules.

Typical shifts are 4 hours or less -> 10 minute break.
Longer shifts (e.g. 8 hours / extra shift) -> 30 minute break.

Entitlement comes from the employee's scheduled shift length when possible.
If no shift is on the schedule, we fall back to 10 minutes, then upgrade to
30 once the open clock-in session passes 4 hours.
"""

from datetime import datetime, time, timezone

from models import Shift, ClockEvent

FOUR_HOURS_SECONDS = 4 * 60 * 60
BREAK_SHORT_MINUTES = 10
BREAK_LONG_MINUTES = 30


def _as_naive(dt):
    """Compare SQLite-naive datetimes safely."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def find_overlapping_shift(employee_id, when=None):
    """
    Shift that covers 'when' (default: now), else any shift scheduled today.
    """
    when = _as_naive(when) or datetime.utcnow()
    day_start = datetime.combine(when.date(), time.min)
    day_end = datetime.combine(when.date(), time.max)

    overlapping = (
        Shift.query.filter(
            Shift.employee_id == employee_id,
            Shift.start_time <= when,
            Shift.end_time >= when,
        )
        .order_by(Shift.start_time.asc())
        .first()
    )
    if overlapping:
        return overlapping

    return (
        Shift.query.filter(
            Shift.employee_id == employee_id,
            Shift.start_time <= day_end,
            Shift.end_time >= day_start,
        )
        .order_by(Shift.start_time.asc())
        .first()
    )


def entitled_break_minutes(employee_id, session_start=None, now=None):
    """Return break minutes for the current shift/session."""
    now = _as_naive(now) or datetime.utcnow()
    shift = find_overlapping_shift(employee_id, now)

    if shift is not None:
        duration = (shift.end_time - shift.start_time).total_seconds()
        minutes = (
            BREAK_LONG_MINUTES
            if duration > FOUR_HOURS_SECONDS
            else BREAK_SHORT_MINUTES
        )
        return {
            "entitled_minutes": minutes,
            "rule": "long_shift" if minutes == BREAK_LONG_MINUTES else "standard_shift",
            "shift": shift.to_dict(),
            "shift_hours": round(duration / 3600, 2),
        }

    if session_start is not None:
        worked = (now - _as_naive(session_start)).total_seconds()
        if worked > FOUR_HOURS_SECONDS:
            return {
                "entitled_minutes": BREAK_LONG_MINUTES,
                "rule": "session_over_4h",
                "shift": None,
                "shift_hours": round(worked / 3600, 2),
            }

    return {
        "entitled_minutes": BREAK_SHORT_MINUTES,
        "rule": "default_standard",
        "shift": None,
        "shift_hours": None,
    }


def open_session_events(employee_id):
    """
    Events in the current open work session (after last completed out),
    oldest to newest. Empty list if not clocked in.
    """
    events = (
        ClockEvent.query.filter_by(employee_id=employee_id)
        .order_by(ClockEvent.timestamp.asc())
        .all()
    )

    session = []
    for event in events:
        if event.type == "in":
            session = [event]
        elif not session:
            continue
        elif event.type == "out":
            session = []
        else:
            session.append(event)
    return session


def break_seconds_used(session_events, now=None):
    """Total break seconds in this session (including an in-progress break)."""
    now = _as_naive(now) or datetime.utcnow()
    used = 0.0
    i = 0
    while i < len(session_events):
        event = session_events[i]
        if event.type != "break_start":
            i += 1
            continue
        start = _as_naive(event.timestamp)
        if i + 1 < len(session_events) and session_events[i + 1].type == "break_end":
            end = _as_naive(session_events[i + 1].timestamp)
            used += max(0.0, (end - start).total_seconds())
            i += 2
        else:
            used += max(0.0, (now - start).total_seconds())
            i += 1
    return used


def build_session_payload(employee_id):
    """Full status blob for GET /api/session and break responses."""
    session = open_session_events(employee_id)
    now = datetime.utcnow()

    if not session:
        policy = entitled_break_minutes(employee_id, session_start=None, now=now)
        return {
            "clocked_in": False,
            "on_break": False,
            "clock_in_at": None,
            "break_started_at": None,
            "break": {
                **policy,
                "used_seconds": 0,
                "used_minutes": 0,
                "remaining_minutes": policy["entitled_minutes"],
            },
            "events": [],
        }

    last = session[-1]
    on_break = last.type == "break_start"
    clock_in_at = session[0].timestamp
    policy = entitled_break_minutes(employee_id, session_start=clock_in_at, now=now)
    used_seconds = break_seconds_used(session, now=now)
    used_minutes = round(used_seconds / 60, 1)
    remaining = max(0.0, policy["entitled_minutes"] - used_minutes)

    return {
        "clocked_in": True,
        "on_break": on_break,
        "clock_in_at": clock_in_at.isoformat(),
        "break_started_at": last.timestamp.isoformat() if on_break else None,
        "break": {
            **policy,
            "used_seconds": int(used_seconds),
            "used_minutes": used_minutes,
            "remaining_minutes": round(remaining, 1),
        },
        "events": [e.to_dict() for e in session],
    }
