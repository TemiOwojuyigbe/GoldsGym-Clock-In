"""
routes/auth.py — Employee Login and Admin Login endpoints.

POST /api/login/employee  — any staff account → employee portal token
POST /api/login/admin     — admin accounts only → admin portal token
GET  /api/me              — who am I? (needs Bearer token)
GET  /api/gym             — public gym geofence info (for the UI)
"""

from flask import Blueprint, request, jsonify, g

from models import db, Employee
from auth import (
    verify_password,
    create_token,
    decode_token,
    require_admin_portal,
)
from geofence import (
    GYM_NAME,
    GYM_ADDRESS,
    GYM_LATITUDE,
    GYM_LONGITUDE,
    GYM_RADIUS_METERS,
    TESTING_BYPASS_GEOFENCE,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api")


def _login(portal):
    """
    Shared login logic.
    portal=\"employee\" → any valid account
    portal=\"admin\"    → only role=admin accounts
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    employee = Employee.query.filter_by(email=email).first()
    if employee is None or not verify_password(employee.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    if portal == "admin" and employee.role != "admin":
        return jsonify({
            "error": "This account does not have admin access. Use Employee Login.",
        }), 403

    token = create_token(employee, portal=portal)
    return jsonify({
        "message": f"Logged in to {portal} portal",
        "token": token,
        "portal": portal,
        "employee": employee.to_dict(),
    })


@auth_bp.route("/login/employee", methods=["POST"])
def login_employee():
    """Employee portal — clock in/out. Managers use this to punch too."""
    return _login("employee")


@auth_bp.route("/login/admin", methods=["POST"])
def login_admin():
    """Admin portal — scheduling only. Requires role=admin."""
    return _login("admin")


@auth_bp.route("/me", methods=["GET"])
def me():
    """Return the logged-in user from the Bearer token (either portal)."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return jsonify({"error": "Login required"}), 401

    payload = decode_token(header[7:].strip())
    if not payload:
        return jsonify({"error": "Invalid or expired token"}), 401

    employee = db.session.get(Employee, payload["employee_id"])
    if employee is None:
        return jsonify({"error": "Employee not found"}), 401

    return jsonify({
        "employee": employee.to_dict(),
        "portal": payload.get("portal"),
    })


@auth_bp.route("/gym", methods=["GET"])
def gym_info():
    """Public info about the geofence (shown on the employee portal)."""
    return jsonify({
        "name": GYM_NAME,
        "address": GYM_ADDRESS,
        "latitude": GYM_LATITUDE,
        "longitude": GYM_LONGITUDE,
        "radius_meters": GYM_RADIUS_METERS,
        "testing_bypass": TESTING_BYPASS_GEOFENCE,
    })


@auth_bp.route("/employees", methods=["GET"])
@require_admin_portal
def list_employees():
    """Admin only — list staff. Optional ?role=employee|admin."""
    query = Employee.query
    role = (request.args.get("role") or "").strip().lower()
    if role in ("employee", "admin"):
        query = query.filter_by(role=role)
    employees = query.order_by(Employee.name.asc()).all()
    return jsonify({"employees": [e.to_dict() for e in employees]})
