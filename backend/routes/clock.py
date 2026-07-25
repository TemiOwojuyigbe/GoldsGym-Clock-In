"""
routes/clock.py — Clock-in/out, breaks, session status, timesheet.

Event types: in | out | break_start | break_end

Break policy (Crofton staff):
  ≤ 4 hour shift → 10 min break
  > 4 hour shift → 30 min break
"""

from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone

from models import db, ClockEvent
from auth import require_employee_portal
from geofence import check_at_gym
from break_policy import open_session_events, build_session_payload

clock_bp = Blueprint("clock", __name__, url_prefix="/api")


def _parse_location(data):
    return data.get("lat"), data.get("long")


def _last_session_event(employee_id):
    session = open_session_events(employee_id)
    return session[-1] if session else None


@clock_bp.route("/session", methods=["GET"])
@require_employee_portal
def session_status():
    """Current clock/break status + break entitlement for the logged-in employee."""
    return jsonify(build_session_payload(g.current_employee.id))


@clock_bp.route("/clock-in", methods=["POST"])
@require_employee_portal
def clock_in():
    data = request.get_json() or {}
    employee_id = g.current_employee.id

    if open_session_events(employee_id):
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
        "session": build_session_payload(employee_id),
    }), 201


@clock_bp.route("/clock-out", methods=["POST"])
@require_employee_portal
def clock_out():
    data = request.get_json() or {}
    employee_id = g.current_employee.id

    last = _last_session_event(employee_id)
    if last is None:
        return jsonify({"error": "Not currently clocked in."}), 400
    if last.type == "break_start":
        return jsonify({"error": "End your break before clocking out."}), 400

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
        "session": build_session_payload(employee_id),
    }), 201


@clock_bp.route("/break-start", methods=["POST"])
@require_employee_portal
def break_start():
    """Start a break during an active shift (no GPS required)."""
    employee_id = g.current_employee.id
    last = _last_session_event(employee_id)

    if last is None:
        return jsonify({"error": "Clock in before starting a break."}), 400
    if last.type == "break_start":
        return jsonify({"error": "Already on break."}), 400

    session = build_session_payload(employee_id)
    remaining = session["break"]["remaining_minutes"]
    if remaining <= 0:
        return jsonify({
            "error": (
                f"No break time left "
                f"({session['break']['entitled_minutes']} min entitled for this shift)."
            ),
            "session": session,
        }), 400

    event = ClockEvent(
        employee_id=employee_id,
        type="break_start",
        timestamp=datetime.now(timezone.utc),
        latitude=None,
        longitude=None,
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({
        "message": "Break started",
        "event": event.to_dict(),
        "session": build_session_payload(employee_id),
    }), 201


@clock_bp.route("/break-end", methods=["POST"])
@require_employee_portal
def break_end():
    """End the current break and return to working."""
    employee_id = g.current_employee.id
    last = _last_session_event(employee_id)

    if last is None:
        return jsonify({"error": "Not currently clocked in."}), 400
    if last.type != "break_start":
        return jsonify({"error": "You are not on break."}), 400

    event = ClockEvent(
        employee_id=employee_id,
        type="break_end",
        timestamp=datetime.now(timezone.utc),
        latitude=None,
        longitude=None,
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({
        "message": "Break ended",
        "event": event.to_dict(),
        "session": build_session_payload(employee_id),
    }), 201


@clock_bp.route("/timesheet", methods=["GET"])
@require_employee_portal
def timesheet():
    employee = g.current_employee
    events = (
        ClockEvent.query.filter_by(employee_id=employee.id)
        .order_by(ClockEvent.timestamp.desc())
        .all()
    )
    return jsonify({
        "employee": employee.to_dict(),
        "events": [e.to_dict() for e in events],
        "session": build_session_payload(employee.id),
    })


@clock_bp.route("/timesheet/<int:employee_id>", methods=["GET"])
@require_employee_portal
def timesheet_by_id(employee_id):
    if employee_id != g.current_employee.id:
        return jsonify({"error": "You can only view your own timesheet."}), 403
    return timesheet()
