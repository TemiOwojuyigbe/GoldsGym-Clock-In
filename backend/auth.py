"""
auth.py — Login tokens and route guards.

Two portals share the same accounts:
  - Employee login → token with portal="employee" (clock in/out only)
  - Admin login    → token with portal="admin" (scheduling only; role must be admin)

Managers (role=admin) use Employee Login to punch, Admin Login to schedule.
"""

from functools import wraps

from flask import current_app, request, jsonify, g
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from models import db, Employee

# Tokens expire after 12 hours (learning MVP — tune later)
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12


def hash_password(plain):
    """Turn a plain password into a stored hash."""
    return generate_password_hash(plain)


def verify_password(password_hash, plain):
    """Return True if plain password matches the hash."""
    if not password_hash:
        return False
    return check_password_hash(password_hash, plain)


def _serializer():
    """Build a signer using the Flask app secret key."""
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="gym-auth")


def create_token(employee, portal):
    """
    Create a signed token for this user + portal.
    portal is \"employee\" or \"admin\".
    """
    payload = {
        "employee_id": employee.id,
        "role": employee.role,
        "portal": portal,
    }
    return _serializer().dumps(payload)


def decode_token(token):
    """Return payload dict or None if invalid/expired."""
    try:
        return _serializer().loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None


def _extract_bearer_token():
    """Read Authorization: Bearer <token> from the request."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return None


def require_employee_portal(view):
    """
    Decorator: must be logged in via Employee Login.
    Sets g.current_employee and g.portal.
    """

    @wraps(view)
    def wrapped(*args, **kwargs):
        token = _extract_bearer_token()
        if not token:
            return jsonify({"error": "Login required (Employee portal)."}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token. Please log in again."}), 401

        if payload.get("portal") != "employee":
            return jsonify({
                "error": "Use Employee Login to clock in/out.",
            }), 403

        employee = db.session.get(Employee, payload["employee_id"])
        if employee is None:
            return jsonify({"error": "Employee not found."}), 401

        g.current_employee = employee
        g.portal = "employee"
        return view(*args, **kwargs)

    return wrapped


def require_admin_portal(view):
    """
    Decorator: must be logged in via Admin Login AND have role=admin.
    Sets g.current_employee and g.portal.
    """

    @wraps(view)
    def wrapped(*args, **kwargs):
        token = _extract_bearer_token()
        if not token:
            return jsonify({"error": "Login required (Admin portal)."}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token. Please log in again."}), 401

        if payload.get("portal") != "admin":
            return jsonify({
                "error": "Use Admin Login to manage the schedule.",
            }), 403

        if payload.get("role") != "admin":
            return jsonify({"error": "Admin privileges required."}), 403

        employee = db.session.get(Employee, payload["employee_id"])
        if employee is None or employee.role != "admin":
            return jsonify({"error": "Admin privileges required."}), 403

        g.current_employee = employee
        g.portal = "admin"
        return view(*args, **kwargs)

    return wrapped
