"""
routes/clock.py — Clock-in, clock-out, and timesheet endpoints.

POST /api/clock-in
POST /api/clock-out
GET  /api/timesheet/<employee_id>
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timezone

from models import db, Employee, ClockEvent

clock_bp = Blueprint("clock", __name__, url_prefix="/api")


def _get_employee_or_404(employee_id):
    """Look up an employee by id. Returns (employee, None) or (None, error)."""
    employee = db.session.get(Employee, employee_id)
    if employee is None:
        return None, (jsonify({"error": f"Employee {employee_id} not found"}), 404)
    return employee, None


def _parse_location(data):
    """Pull lat/long from the JSON body (API uses \"long\", not \"lng\")."""
    return data.get("lat"), data.get("long")


@clock_bp.route("/clock-in", methods=["POST"])
def clock_in():
    """
    POST /api/clock-in
    Body: { "employee_id": 1, "lat": 40.7, "long": -74.0 }
    """
    data = request.get_json() or {}

    employee_id = data.get("employee_id")
    if employee_id is None:
        return jsonify({"error": "employee_id is required"}), 400

    employee, err = _get_employee_or_404(employee_id)
    if err:
        return err

    # Block double clock-in
    last_event = (
        ClockEvent.query.filter_by(employee_id=employee_id)
        .order_by(ClockEvent.timestamp.desc())
        .first()
    )
    if last_event and last_event.type == "in":
        return jsonify({"error": "Already clocked in. Clock out first."}), 400

    lat, lng = _parse_location(data)
    event = ClockEvent(
        employee_id=employee_id,
        type="in",
        timestamp=datetime.now(timezone.utc),
        latitude=lat,
        longitude=lng,
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({"message": "Clocked in", "event": event.to_dict()}), 201


@clock_bp.route("/clock-out", methods=["POST"])
def clock_out():
    """
    POST /api/clock-out
    Body: { "employee_id": 1, "lat": 40.7, "long": -74.0 }
    """
    data = request.get_json() or {}

    employee_id = data.get("employee_id")
    if employee_id is None:
        return jsonify({"error": "employee_id is required"}), 400

    employee, err = _get_employee_or_404(employee_id)
    if err:
        return err

    last_event = (
        ClockEvent.query.filter_by(employee_id=employee_id)
        .order_by(ClockEvent.timestamp.desc())
        .first()
    )
    if last_event is None or last_event.type != "in":
        return jsonify({"error": "Not currently clocked in."}), 400

    lat, lng = _parse_location(data)
    event = ClockEvent(
        employee_id=employee_id,
        type="out",
        timestamp=datetime.now(timezone.utc),
        latitude=lat,
        longitude=lng,
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({"message": "Clocked out", "event": event.to_dict()}), 201


@clock_bp.route("/timesheet/<int:employee_id>", methods=["GET"])
def timesheet(employee_id):
    """GET /api/timesheet/:employee_id — all punches for that employee."""
    employee, err = _get_employee_or_404(employee_id)
    if err:
        return err

    events = (
        ClockEvent.query.filter_by(employee_id=employee_id)
        .order_by(ClockEvent.timestamp.desc())
        .all()
    )

    return jsonify(
        {
            "employee": employee.to_dict(),
            "events": [e.to_dict() for e in events],
        }
    )
