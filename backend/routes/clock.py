"""
routes/clock.py — Clock-in, clock-out, and timesheet (Employee portal).

Requires Employee Login token.
employee_id always comes from the token (you cannot punch as someone else).
Geofence: punches only succeed within ~200m of Gold's Gym Bowie.
"""

from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone

from models import db, ClockEvent
from auth import require_employee_portal
from geofence import check_at_gym

clock_bp = Blueprint("clock", __name__, url_prefix="/api")


def _parse_location(data):
    """Pull lat/long from the JSON body (API uses \"long\", not \"lng\")."""
    return data.get("lat"), data.get("long")


@clock_bp.route("/clock-in", methods=["POST"])
@require_employee_portal
def clock_in():
    """
    POST /api/clock-in
    Body: { "lat": 38.96, "long": -76.78 }
    Auth: Bearer employee-portal token
    """
    data = request.get_json() or {}
    employee = g.current_employee
    employee_id = employee.id

    # Block double clock-in
    last_event = (
        ClockEvent.query.filter_by(employee_id=employee_id)
        .order_by(ClockEvent.timestamp.desc())
        .first()
    )
    if last_event and last_event.type == "in":
        return jsonify({"error": "Already clocked in. Clock out first."}), 400

    lat, lng = _parse_location(data)
    ok, geo = check_at_gym(lat, lng)
    if not ok:
        return jsonify(geo), 403

    event = ClockEvent(
        employee_id=employee_id,
        type="in",
        timestamp=datetime.now(timezone.utc),
        latitude=float(lat),
        longitude=float(lng),
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({
        "message": "Clocked in",
        "event": event.to_dict(),
        "distance_meters": geo.get("distance_meters"),
    }), 201


@clock_bp.route("/clock-out", methods=["POST"])
@require_employee_portal
def clock_out():
    """
    POST /api/clock-out
    Body: { "lat": 38.96, "long": -76.78 }
    Auth: Bearer employee-portal token
    """
    data = request.get_json() or {}
    employee = g.current_employee
    employee_id = employee.id

    last_event = (
        ClockEvent.query.filter_by(employee_id=employee_id)
        .order_by(ClockEvent.timestamp.desc())
        .first()
    )
    if last_event is None or last_event.type != "in":
        return jsonify({"error": "Not currently clocked in."}), 400

    lat, lng = _parse_location(data)
    ok, geo = check_at_gym(lat, lng)
    if not ok:
        return jsonify(geo), 403

    event = ClockEvent(
        employee_id=employee_id,
        type="out",
        timestamp=datetime.now(timezone.utc),
        latitude=float(lat),
        longitude=float(lng),
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({
        "message": "Clocked out",
        "event": event.to_dict(),
        "distance_meters": geo.get("distance_meters"),
    }), 201


@clock_bp.route("/timesheet", methods=["GET"])
@require_employee_portal
def timesheet():
    """GET /api/timesheet — punches for the logged-in employee only."""
    employee = g.current_employee

    events = (
        ClockEvent.query.filter_by(employee_id=employee.id)
        .order_by(ClockEvent.timestamp.desc())
        .all()
    )

    return jsonify(
        {
            "employee": employee.to_dict(),
            "events": [e.to_dict() for e in events],
        }
    )


@clock_bp.route("/timesheet/<int:employee_id>", methods=["GET"])
@require_employee_portal
def timesheet_by_id(employee_id):
    """
    Kept for compatibility — employees may only view their own timesheet.
    """
    if employee_id != g.current_employee.id:
        return jsonify({"error": "You can only view your own timesheet."}), 403

    return timesheet()
