"""
routes/shifts.py — Manager shift scheduling endpoints.

GET  /api/shifts  — list all scheduled shifts (earliest first)
POST /api/shifts  — create a new shift for an employee

Manager flow:
  1. POST a shift (who, start, end, optional notes) → saved in DB
  2. GET /api/shifts → schedule view shows every shift
Employees still clock in/out separately via /api/clock-in and /api/clock-out.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime

from models import db, Employee, Shift

shift_bp = Blueprint("shifts", __name__, url_prefix="/api")


def _parse_iso_datetime(value, field_name):
    """
    Parse an ISO datetime string from the client.
    Accepts both \"2026-07-25T09:00:00\" and with a trailing Z.
    """
    if not value:
        return None, f"{field_name} is required"

    text = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text), None
    except ValueError:
        return None, f"{field_name} must be a valid ISO datetime"


@shift_bp.route("/shifts", methods=["GET"])
def get_shifts():
    """Return all shifts ordered by start_time ascending."""
    shifts = Shift.query.order_by(Shift.start_time.asc()).all()
    return jsonify({"shifts": [shift.to_dict() for shift in shifts]})


@shift_bp.route("/shifts", methods=["POST"])
def create_shift():
    """
    POST /api/shifts
    Body JSON:
      {
        "employee_id": 1,
        "start_time": "2026-07-25T09:00:00",
        "end_time": "2026-07-25T17:00:00",
        "notes": "Front desk"   # optional
      }
    """
    data = request.get_json() or {}

    # --- Validate employee ---
    employee_id = data.get("employee_id")
    if employee_id is None:
        return jsonify({"error": "employee_id is required"}), 400

    employee = db.session.get(Employee, employee_id)
    if employee is None:
        return jsonify({"error": f"Employee {employee_id} not found"}), 404

    # --- Validate times ---
    start_time, err = _parse_iso_datetime(data.get("start_time"), "start_time")
    if err:
        return jsonify({"error": err}), 400

    end_time, err = _parse_iso_datetime(data.get("end_time"), "end_time")
    if err:
        return jsonify({"error": err}), 400

    if end_time <= start_time:
        return jsonify({"error": "end_time must be after start_time"}), 400

    notes = data.get("notes") or None

    shift = Shift(
        employee_id=employee_id,
        start_time=start_time,
        end_time=end_time,
        notes=notes,
    )
    db.session.add(shift)
    db.session.commit()

    return jsonify({"message": "Shift created", "shift": shift.to_dict()}), 201
