"""
routes/requests.py — Punch edit requests + manager approvals.

Employee portal:
  GET  /api/edit-requests
  POST /api/edit-requests

Admin portal:
  GET  /api/admin/edit-requests?status=pending
  POST /api/admin/edit-requests/<id>/approve
  POST /api/admin/edit-requests/<id>/reject
"""

from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone

from models import db, ClockEvent, EditRequest
from auth import require_employee_portal, require_admin_portal

requests_bp = Blueprint("requests", __name__, url_prefix="/api")


def _parse_iso_datetime(value, field_name):
    if not value:
        return None, f"{field_name} is required"
    text = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text), None
    except ValueError:
        return None, f"{field_name} must be a valid ISO datetime"


@requests_bp.route("/edit-requests", methods=["GET"])
@require_employee_portal
def my_edit_requests():
    """List the logged-in employee's own requests (newest first)."""
    rows = (
        EditRequest.query.filter_by(employee_id=g.current_employee.id)
        .order_by(EditRequest.created_at.desc())
        .all()
    )
    return jsonify({"requests": [r.to_dict() for r in rows]})


@requests_bp.route("/edit-requests", methods=["POST"])
@require_employee_portal
def create_edit_request():
    """
    Body:
      {
        "request_type": "fix_time" | "add_punch",
        "punch_type": "in" | "out",
        "proposed_timestamp": "2026-07-24T09:00:00",
        "reason": "Forgot to clock in",
        "clock_event_id": 12   // required for fix_time
      }
    """
    data = request.get_json() or {}
    employee = g.current_employee

    request_type = (data.get("request_type") or "").strip()
    if request_type not in ("fix_time", "add_punch"):
        return jsonify({"error": "request_type must be fix_time or add_punch"}), 400

    punch_type = (data.get("punch_type") or "").strip()
    if punch_type not in ("in", "out"):
        return jsonify({"error": "punch_type must be in or out"}), 400

    proposed, err = _parse_iso_datetime(data.get("proposed_timestamp"), "proposed_timestamp")
    if err:
        return jsonify({"error": err}), 400

    reason = (data.get("reason") or "").strip()
    if not reason:
        return jsonify({"error": "reason is required"}), 400

    clock_event_id = data.get("clock_event_id")
    if request_type == "fix_time":
        if clock_event_id is None:
            return jsonify({"error": "clock_event_id is required for fix_time"}), 400
        event = db.session.get(ClockEvent, clock_event_id)
        if event is None or event.employee_id != employee.id:
            return jsonify({"error": "Clock event not found"}), 404
    else:
        clock_event_id = None

    row = EditRequest(
        employee_id=employee.id,
        clock_event_id=clock_event_id,
        request_type=request_type,
        punch_type=punch_type,
        proposed_timestamp=proposed,
        reason=reason,
        status="pending",
    )
    db.session.add(row)
    db.session.commit()

    return jsonify({"message": "Request submitted", "request": row.to_dict()}), 201


@requests_bp.route("/admin/edit-requests", methods=["GET"])
@require_admin_portal
def list_edit_requests():
    """Admin list — default pending only. ?status=all|pending|approved|rejected"""
    status = (request.args.get("status") or "pending").strip().lower()
    query = EditRequest.query
    if status != "all":
        if status not in ("pending", "approved", "rejected"):
            return jsonify({"error": "invalid status filter"}), 400
        query = query.filter_by(status=status)

    rows = query.order_by(EditRequest.created_at.desc()).all()
    return jsonify({"requests": [r.to_dict() for r in rows]})


def _review_request(req_id, new_status):
    row = db.session.get(EditRequest, req_id)
    if row is None:
        return None, (jsonify({"error": "Request not found"}), 404)
    if row.status != "pending":
        return None, (jsonify({"error": f"Request already {row.status}"}), 400)

    row.status = new_status
    row.reviewer_id = g.current_employee.id
    row.reviewed_at = datetime.now(timezone.utc)

    if new_status == "approved":
        if row.request_type == "fix_time":
            event = db.session.get(ClockEvent, row.clock_event_id)
            if event is None:
                return None, (jsonify({"error": "Original punch no longer exists"}), 400)
            event.timestamp = row.proposed_timestamp
            event.type = row.punch_type
        elif row.request_type == "add_punch":
            event = ClockEvent(
                employee_id=row.employee_id,
                type=row.punch_type,
                timestamp=row.proposed_timestamp,
                latitude=None,
                longitude=None,
            )
            db.session.add(event)

    db.session.commit()
    return row, None


@requests_bp.route("/admin/edit-requests/<int:req_id>/approve", methods=["POST"])
@require_admin_portal
def approve_edit_request(req_id):
    row, err = _review_request(req_id, "approved")
    if err:
        return err
    return jsonify({"message": "Request approved", "request": row.to_dict()})


@requests_bp.route("/admin/edit-requests/<int:req_id>/reject", methods=["POST"])
@require_admin_portal
def reject_edit_request(req_id):
    row, err = _review_request(req_id, "rejected")
    if err:
        return err
    return jsonify({"message": "Request rejected", "request": row.to_dict()})
