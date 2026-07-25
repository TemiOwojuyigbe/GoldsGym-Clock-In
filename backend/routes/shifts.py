"""
routes/shifts.py — Manager shift scheduling (Admin portal).

GET    /api/shifts              — list (optional ?date=YYYY-MM-DD&role=employee|admin)
POST   /api/shifts              — create
PUT    /api/shifts/<id>         — edit
DELETE /api/shifts/<id>         — delete
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, time

from models import db, Employee, Shift
from auth import require_admin_portal

shift_bp = Blueprint("shifts", __name__, url_prefix="/api")


def _parse_iso_datetime(value, field_name):
    if not value:
        return None, f"{field_name} is required"
    text = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text), None
    except ValueError:
        return None, f"{field_name} must be a valid ISO datetime"


def _parse_shift_fields(data, partial=False):
    """Validate create/update body. partial=True allows missing fields on edit."""
    result = {}

    if "employee_id" in data or not partial:
        employee_id = data.get("employee_id")
        if employee_id is None:
            return None, "employee_id is required"
        employee = db.session.get(Employee, employee_id)
        if employee is None:
            return None, f"Employee {employee_id} not found"
        result["employee_id"] = employee_id

    if "start_time" in data or not partial:
        start_time, err = _parse_iso_datetime(data.get("start_time"), "start_time")
        if err:
            return None, err
        result["start_time"] = start_time

    if "end_time" in data or not partial:
        end_time, err = _parse_iso_datetime(data.get("end_time"), "end_time")
        if err:
            return None, err
        result["end_time"] = end_time

    if "notes" in data:
        result["notes"] = data.get("notes") or None
    elif not partial:
        result["notes"] = data.get("notes") or None

    return result, None


@shift_bp.route("/shifts", methods=["GET"])
@require_admin_portal
def get_shifts():
    """
    List shifts. Filters:
      ?date=2026-07-26  → shifts overlapping that local calendar day
      ?role=employee|admin → only shifts for staff with that role
    """
    query = Shift.query.join(Employee)

    role = (request.args.get("role") or "").strip().lower()
    if role in ("employee", "admin"):
        query = query.filter(Employee.role == role)

    date_str = (request.args.get("date") or "").strip()
    if date_str:
        try:
            day = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "date must be YYYY-MM-DD"}), 400
        day_start = datetime.combine(day, time.min)
        day_end = datetime.combine(day, time.max)
        # Shift overlaps the day if it starts before day ends AND ends after day starts
        query = query.filter(Shift.start_time <= day_end, Shift.end_time >= day_start)

    shifts = query.order_by(Shift.start_time.asc()).all()
    return jsonify({"shifts": [s.to_dict() for s in shifts]})


@shift_bp.route("/shifts", methods=["POST"])
@require_admin_portal
def create_shift():
    data = request.get_json() or {}
    fields, err = _parse_shift_fields(data, partial=False)
    if err:
        return jsonify({"error": err}), 400
    if fields["end_time"] <= fields["start_time"]:
        return jsonify({"error": "end_time must be after start_time"}), 400

    shift = Shift(**fields)
    db.session.add(shift)
    db.session.commit()
    return jsonify({"message": "Shift created", "shift": shift.to_dict()}), 201


@shift_bp.route("/shifts/<int:shift_id>", methods=["PUT"])
@require_admin_portal
def update_shift(shift_id):
    shift = db.session.get(Shift, shift_id)
    if shift is None:
        return jsonify({"error": "Shift not found"}), 404

    data = request.get_json() or {}
    fields, err = _parse_shift_fields(data, partial=True)
    if err:
        return jsonify({"error": err}), 400

    for key, value in fields.items():
        setattr(shift, key, value)

    start = shift.start_time
    end = shift.end_time
    if end <= start:
        return jsonify({"error": "end_time must be after start_time"}), 400

    db.session.commit()
    return jsonify({"message": "Shift updated", "shift": shift.to_dict()})


@shift_bp.route("/shifts/<int:shift_id>", methods=["DELETE"])
@require_admin_portal
def delete_shift(shift_id):
    shift = db.session.get(Shift, shift_id)
    if shift is None:
        return jsonify({"error": "Shift not found"}), 404

    db.session.delete(shift)
    db.session.commit()
    return jsonify({"message": "Shift deleted", "id": shift_id})
