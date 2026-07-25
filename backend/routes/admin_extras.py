"""
routes/admin_extras.py — Admin activity feed + shared helpers.

GET /api/admin/activity?date=YYYY-MM-DD  — team clock-in/out feed (default: today)
GET /api/admin/summary                   — pending approvals count + today's punch count
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, time

from models import ClockEvent, EditRequest
from auth import require_admin_portal

admin_bp = Blueprint("admin_extras", __name__, url_prefix="/api")


def _parse_day(date_str):
    """Return (day_start, day_end) naive datetimes for filtering stored timestamps."""
    if date_str:
        try:
            day = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return None, None, "date must be YYYY-MM-DD"
    else:
        day = datetime.now().date()

    return datetime.combine(day, time.min), datetime.combine(day, time.max), None


@admin_bp.route("/admin/activity", methods=["GET"])
@require_admin_portal
def team_activity():
    """
    Who clocked in/out on a given day (default today), newest first.
    """
    day_start, day_end, err = _parse_day((request.args.get("date") or "").strip())
    if err:
        return jsonify({"error": err}), 400

    events = (
        ClockEvent.query.filter(
            ClockEvent.timestamp >= day_start,
            ClockEvent.timestamp <= day_end,
        )
        .order_by(ClockEvent.timestamp.desc())
        .all()
    )

    return jsonify({
        "date": day_start.date().isoformat(),
        "events": [e.to_dict() for e in events],
    })


@admin_bp.route("/admin/summary", methods=["GET"])
@require_admin_portal
def admin_summary():
    """Quick counts for the admin home header."""
    day_start, day_end, _ = _parse_day("")
    punches_today = ClockEvent.query.filter(
        ClockEvent.timestamp >= day_start,
        ClockEvent.timestamp <= day_end,
    ).count()
    pending = EditRequest.query.filter_by(status="pending").count()

    return jsonify({
        "punches_today": punches_today,
        "pending_approvals": pending,
    })
